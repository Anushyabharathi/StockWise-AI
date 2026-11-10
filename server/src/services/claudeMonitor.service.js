const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../db/pool');

// ---------------------------------------------------------------------------
// Pricing (USD per 1,000,000 tokens). Rates based on Anthropic official pricing:
// https://www.anthropic.com/pricing
// ---------------------------------------------------------------------------
const TIERS = {
  sonnet: { name: 'Claude 3.5 / 3.7 Sonnet', in: 3.0, out: 15.0, cw: 3.75, cr: 0.30 },
  opus: { name: 'Claude 3 / 3.5 Opus', in: 15.0, out: 75.0, cw: 18.75, cr: 1.50 },
  haiku: { name: 'Claude 3.5 Haiku', in: 0.80, out: 4.0, cw: 1.0, cr: 0.08 },
};

const MODEL_PRICING = {
  'claude-3-haiku-20240307': { name: 'Claude 3 Haiku', in: 0.25, out: 1.25, cw: 0.30, cr: 0.03 },
  'claude-3-5-haiku-20241022': { name: 'Claude 3.5 Haiku', in: 0.80, out: 4.0, cw: 1.0, cr: 0.08 },
  'claude-3-5-sonnet-20241022': { name: 'Claude 3.5 Sonnet', in: 3.0, out: 15.0, cw: 3.75, cr: 0.30 },
  'claude-3-7-sonnet-20250219': { name: 'Claude 3.7 Sonnet', in: 3.0, out: 15.0, cw: 3.75, cr: 0.30 },
  'claude-3-opus-20240229': { name: 'Claude 3 Opus', in: 15.0, out: 75.0, cw: 18.75, cr: 1.50 },
};

function getPricing(model) {
  const m = String(model || '').toLowerCase().trim();
  if (MODEL_PRICING[m]) return MODEL_PRICING[m];
  for (const tier of ['opus', 'haiku', 'sonnet']) {
    if (m.includes(tier)) return TIERS[tier];
  }
  return TIERS.sonnet;
}

/**
 * Calculates estimated cost from provider token categories without double-counting cache tokens.
 */
function calculateCost(model, inputTokens = 0, outputTokens = 0, cacheRead = 0, cacheWrite = 0) {
  const p = getPricing(model);
  const cost =
    (Math.max(0, inputTokens) * p.in +
      Math.max(0, outputTokens) * p.out +
      Math.max(0, cacheRead) * p.cr +
      Math.max(0, cacheWrite) * p.cw) /
    1000000;
  return { cost: Number(cost.toFixed(6)), pricing: p };
}

class BudgetExhaustedError extends Error {
  constructor(status) {
    super(
      `Claude AI budget exhausted. The configured $${status.totalBudgetUsd.toFixed(2)} USD spending limit has been reached.`
    );
    this.name = 'BudgetExhaustedError';
    this.status = 429;
    this.code = 'AI_BUDGET_EXHAUSTED';
    this.budgetStatus = status;
  }
}

class ClaudeMonitorService {
  constructor() {
    this.cachedStatus = null;
    this.lastConnectionCheck = null;
  }

  /**
   * Reads configured budget from environment variable (default: $5.00 USD).
   */
  getTotalBudget() {
    const raw = process.env.AI_BUDGET_USD;
    const parsed = raw ? parseFloat(raw) : 5.0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5.0;
  }

  /**
   * Warning level helper matching SaaS reference design.
   */
  getWarningInfo(pct) {
    if (pct >= 100) {
      return {
        level: 'exhausted',
        message: '🛑 Claude AI budget exhausted. New AI requests are disabled.',
        color: '#ef4444',
      };
    }
    if (pct >= 90) {
      return {
        level: 'critical',
        message: '🔴 Critical: 90% of the Claude AI budget has been used.',
        color: '#f97316',
      };
    }
    if (pct >= 80) {
      return {
        level: 'warning',
        message: '⚠️ 80% of the Claude AI budget has been used.',
        color: '#eab308',
      };
    }
    return {
      level: 'normal',
      message: null,
      color: '#10b981',
    };
  }

  /**
   * Retrieves live budget status grounded strictly in verified provider usage records.
   * Internal engine metrics and fallback executions are tracked separately and excluded from Claude cost.
   */
  async getBudgetStatus({ startDate = null, endDate = null } = {}) {
    // 1. Provider API metrics (actual Claude requests)
    const providerSql = `
      SELECT
        COUNT(*) AS total_provider_requests,
        COUNT(*) FILTER (WHERE status = 'completed' AND is_provider_verified = TRUE) AS successful_requests,
        COUNT(*) FILTER (WHERE status = 'auth_error') AS auth_errors,
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'fallback_completed')) AS failed_requests,
        COALESCE(SUM(input_tokens) FILTER (WHERE status = 'completed' AND is_provider_verified = TRUE), 0) AS input_tokens,
        COALESCE(SUM(output_tokens) FILTER (WHERE status = 'completed' AND is_provider_verified = TRUE), 0) AS output_tokens,
        COALESCE(SUM(total_tokens) FILTER (WHERE status = 'completed' AND is_provider_verified = TRUE), 0) AS total_tokens,
        COALESCE(SUM(cache_read_tokens) FILTER (WHERE status = 'completed' AND is_provider_verified = TRUE), 0) AS cache_read_tokens,
        COALESCE(SUM(cache_write_tokens) FILTER (WHERE status = 'completed' AND is_provider_verified = TRUE), 0) AS cache_write_tokens,
        COALESCE(SUM(estimated_cost_usd) FILTER (WHERE status = 'completed' AND is_provider_verified = TRUE), 0) AS total_cost
      FROM ai_usage_log
      WHERE execution_type = 'provider_api'
        AND ($1::TIMESTAMPTZ IS NULL OR created_at >= $1::TIMESTAMPTZ)
        AND ($2::TIMESTAMPTZ IS NULL OR created_at <= $2::TIMESTAMPTZ);
    `;

    // 2. Internal engine metrics (tracked separately, $0 Claude cost)
    const internalSql = `
      SELECT
        COUNT(*) AS total_internal_runs,
        COALESCE(SUM(internal_tokens_est), 0) AS estimated_internal_tokens,
        COALESCE(AVG(processing_time_ms), 0) AS avg_internal_ms
      FROM ai_usage_log
      WHERE execution_type = 'internal_engine'
        AND ($1::TIMESTAMPTZ IS NULL OR created_at >= $1::TIMESTAMPTZ)
        AND ($2::TIMESTAMPTZ IS NULL OR created_at <= $2::TIMESTAMPTZ);
    `;

    const [providerRes, internalRes] = await Promise.all([
      query(providerSql, [startDate, endDate]),
      query(internalSql, [startDate, endDate]),
    ]);

    const pRow = providerRes.rows[0] || {};
    const iRow = internalRes.rows[0] || {};

    const totalBudget = this.getTotalBudget();
    const usedCost = Number(parseFloat(pRow.total_cost || 0).toFixed(6));
    const remaining = Math.max(0, Number((totalBudget - usedCost).toFixed(6)));
    const pct = totalBudget > 0 ? Math.min(100, Number(((usedCost / totalBudget) * 100).toFixed(2))) : 100;
    const warning = this.getWarningInfo(pct);

    return {
      totalBudgetUsd: totalBudget,
      usedBudgetUsd: usedCost,
      remainingBudgetUsd: remaining,
      usagePercentage: pct,
      isExhausted: remaining <= 0,
      warningLevel: warning.level,
      warningMessage: warning.message,
      color: warning.color,
      totalRequests: parseInt(pRow.total_provider_requests || 0, 10),
      successfulRequests: parseInt(pRow.successful_requests || 0, 10),
      failedRequests: parseInt(pRow.failed_requests || 0, 10),
      authErrors: parseInt(pRow.auth_errors || 0, 10),
      totalInputTokens: parseInt(pRow.input_tokens || 0, 10),
      totalOutputTokens: parseInt(pRow.output_tokens || 0, 10),
      totalTokens: parseInt(pRow.total_tokens || 0, 10),
      cacheReadTokens: parseInt(pRow.cache_read_tokens || 0, 10),
      cacheWriteTokens: parseInt(pRow.cache_write_tokens || 0, 10),
      costCalculationNote: 'Estimated based on official Anthropic token rates',
      internalEngine: {
        totalRuns: parseInt(iRow.total_internal_runs || 0, 10),
        estimatedTokensProcessed: parseInt(iRow.estimated_internal_tokens || 0, 10),
        avgLatencyMs: Math.round(parseFloat(iRow.avg_internal_ms || 0)),
        costUsd: 0.0,
        description: 'StockWise Retail BI Logic Engine (Local PostgreSQL synthesis)',
      },
    };
  }

  /**
   * Call BEFORE every Claude API request. Raises BudgetExhaustedError when limit reached.
   */
  async checkBudget(feature = 'Claude AI General', prompt = '', admin = null) {
    const status = await this.getBudgetStatus();
    if (status.isExhausted) {
      await this.logUsage({
        feature,
        model: 'claude-3-5-sonnet',
        executionType: 'provider_api',
        isProviderVerified: false,
        usage: null,
        prompt,
        response: '',
        durationMs: 0,
        status: 'budget_exhausted',
        error: `Configured application AI spending pool limit reached ($${status.totalBudgetUsd.toFixed(2)} USD)`,
        admin,
      });
      throw new BudgetExhaustedError(status);
    }
    return status;
  }

  /**
   * Records usage metrics into PostgreSQL.
   * Separates verified Claude API usage from internal fallback logic.
   */
  async logUsage({
    feature = 'Claude AI General',
    model = '',
    executionType = 'provider_api', // 'provider_api' | 'internal_engine'
    isProviderVerified = false,
    providerRequestId = null,
    internalTokensEst = 0,
    usage = null,
    prompt = '',
    response = '',
    durationMs = 0,
    status = 'completed',
    error = null,
    admin = null,
    fileInfo = null,
    metadata = {},
    requestId = null,
  }) {
    const reqId =
      requestId || `REQ-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Actual Claude tokens are ONLY counted when isProviderVerified is true and status is completed
    const isVerifiedCall = isProviderVerified === true && status === 'completed';
    const inputTokens = isVerifiedCall ? parseInt(usage?.input_tokens || usage?.inputTokens || 0, 10) : 0;
    const outputTokens = isVerifiedCall ? parseInt(usage?.output_tokens || usage?.outputTokens || 0, 10) : 0;
    const cacheRead = isVerifiedCall
      ? parseInt(usage?.cache_read_input_tokens || usage?.cacheReadTokens || 0, 10)
      : 0;
    const cacheWrite = isVerifiedCall
      ? parseInt(usage?.cache_creation_input_tokens || usage?.cacheWriteTokens || 0, 10)
      : 0;
    const totalTokens = inputTokens + outputTokens;

    let cost = 0;
    let rates = getPricing(model);
    if (isVerifiedCall && (inputTokens > 0 || outputTokens > 0)) {
      const calc = calculateCost(model, inputTokens, outputTokens, cacheRead, cacheWrite);
      cost = calc.cost;
      rates = calc.pricing;
    }

    const promptSnippet = prompt ? String(prompt).slice(0, 500) : '';
    const responseSnippet = response ? String(response).slice(0, 500) : '';

    const enrichedMeta = {
      ...(metadata || {}),
      executionType,
      isProviderVerified: Boolean(isProviderVerified),
      pricingTier: rates.name,
      inputRatePerMillion: rates.in,
      outputRatePerMillion: rates.out,
    };
    if (providerRequestId) enrichedMeta.providerRequestId = providerRequestId;
    if (fileInfo) enrichedMeta.fileInfo = fileInfo;
    if (internalTokensEst > 0) enrichedMeta.estimatedInternalTokens = internalTokensEst;

    const sql = `
      INSERT INTO ai_usage_log (
        request_id, user_id, user_name, user_email, user_role,
        feature, prompt_snippet, response_snippet, model,
        execution_type, provider_request_id, is_provider_verified, internal_tokens_est,
        input_tokens, output_tokens, total_tokens,
        cache_read_tokens, cache_write_tokens, estimated_cost_usd,
        processing_time_ms, status, error_message, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19,
        $20, $21, $22, $23, NOW()
      )
      RETURNING id, request_id, estimated_cost_usd, total_tokens, status, created_at;
    `;

    const values = [
      reqId,
      admin?.adminId || admin?.admin_id || admin?.username || 'admin',
      admin?.fullName || admin?.username || 'Store Administrator',
      admin?.email || '',
      admin?.role || 'admin',
      feature,
      promptSnippet,
      responseSnippet,
      model || '',
      executionType,
      providerRequestId || null,
      Boolean(isProviderVerified),
      parseInt(internalTokensEst || 0, 10),
      inputTokens,
      outputTokens,
      totalTokens,
      cacheRead,
      cacheWrite,
      cost,
      Math.max(0, parseInt(durationMs || 0, 10)),
      status,
      error ? String(error).slice(0, 500) : null,
      JSON.stringify(enrichedMeta),
    ];

    try {
      const res = await query(sql, values);
      return res.rows[0];
    } catch (insertErr) {
      console.error('[ClaudeMonitor Error] Failed to insert usage log:', insertErr.message);
      return null;
    }
  }

  /**
   * Safely inspects the Anthropic credential and provides real-time diagnostics WITHOUT leaking secrets.
   */
  getConnectionStatus() {
    const rawKey = process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.trim() : null;
    const hasKey = Boolean(rawKey && rawKey.length > 10);

    let maskedKey = null;
    let formatValid = false;
    if (hasKey) {
      const prefix = rawKey.substring(0, 12);
      maskedKey = `${prefix}...${rawKey.slice(-4)}`;
      formatValid = rawKey.startsWith('sk-ant-') && rawKey.length >= 40;
    }

    return {
      configured: hasKey,
      maskedKey,
      formatValid,
      provider: 'Anthropic Claude',
      configuredBudgetUsd: this.getTotalBudget(),
      lastCheck: this.lastConnectionCheck,
      pricingTiers: Object.keys(MODEL_PRICING).map((m) => ({
        model: m,
        name: MODEL_PRICING[m].name,
        inputPerMillion: MODEL_PRICING[m].in,
        outputPerMillion: MODEL_PRICING[m].out,
      })),
    };
  }

  /**
   * Executes a safe real-time diagnostic probe against the Anthropic Claude API.
   * Logs failures accurately without fabricating usage or exposing keys.
   */
  async testConnection(admin = null) {
    const rawKey = process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.trim() : null;
    const t0 = Date.now();

    if (!rawKey || rawKey.length < 10) {
      const checkResult = {
        ok: false,
        statusCode: 400,
        errorType: 'missing_credential',
        message: 'No ANTHROPIC_API_KEY found in server/.env. Please configure your key.',
        timestamp: new Date().toISOString(),
        latencyMs: 0,
      };
      this.lastConnectionCheck = checkResult;
      return checkResult;
    }

    try {
      const client = new Anthropic({ apiKey: rawKey });
      const testModel = 'claude-3-haiku-20240307';

      const response = await client.messages.create({
        model: testModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Connection test ping.' }],
      });

      const durationMs = Date.now() - t0;
      const usage = response.usage || {};

      // Log genuine test usage
      await this.logUsage({
        feature: 'API Health Probe',
        model: testModel,
        executionType: 'provider_api',
        isProviderVerified: true,
        providerRequestId: response.id || null,
        usage,
        prompt: 'Connection test ping.',
        response: response.content?.[0]?.text || 'OK',
        durationMs,
        status: 'completed',
        admin,
        requestId: response.id || null,
      });

      const checkResult = {
        ok: true,
        statusCode: 200,
        message: 'Connected to Anthropic Claude successfully! Live credentials verified.',
        model: testModel,
        latencyMs: durationMs,
        tokensUsed: (usage.input_tokens || 0) + (usage.output_tokens || 0),
        providerRequestId: response.id || null,
        timestamp: new Date().toISOString(),
      };
      this.lastConnectionCheck = checkResult;
      return checkResult;
    } catch (err) {
      const durationMs = Date.now() - t0;
      const status = err.status || 500;
      let errorType = err.error?.type || 'api_error';
      let safeMsg = err.message || 'Anthropic API request failed.';
      const providerReqId = err.request_id || err.error?.request_id || null;

      if (status === 401) {
        errorType = 'authentication_error';
        safeMsg = '401 authentication_error: invalid x-api-key. The provider rejected the credential in server/.env.';
      }

      // Log accurate failure to PostgreSQL (0 actual tokens, 0 cost)
      await this.logUsage({
        feature: 'API Health Probe',
        model: 'claude-3-haiku-20240307',
        executionType: 'provider_api',
        isProviderVerified: false,
        providerRequestId: providerReqId,
        usage: null,
        prompt: 'Connection test ping.',
        response: '',
        durationMs,
        status: status === 401 ? 'auth_error' : 'failed',
        error: safeMsg,
        admin,
      });

      const checkResult = {
        ok: false,
        statusCode: status,
        errorType,
        message: safeMsg,
        providerRequestId: providerReqId,
        timestamp: new Date().toISOString(),
        latencyMs: durationMs,
      };
      this.lastConnectionCheck = checkResult;
      return checkResult;
    }
  }

  /**
   * Retrieves summary analytics for the dashboard ribbon and overview cards.
   * Separates verified provider usage from internal engine fallback metrics.
   */
  async getSummary({ startDate = null, endDate = null } = {}) {
    const budget = await this.getBudgetStatus({ startDate, endDate });

    let dateFilter = '1=1';
    const params = [];
    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND created_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND created_at <= $${params.length}`;
    }

    // Feature breakdown (separates actual provider metrics from internal engine fallback)
    const featureSql = `
      SELECT
        feature,
        COUNT(*) AS total_requests,
        COUNT(*) FILTER (WHERE execution_type = 'provider_api') AS provider_requests,
        COUNT(*) FILTER (WHERE execution_type = 'provider_api' AND status = 'completed' AND is_provider_verified = TRUE) AS successful_provider_requests,
        COUNT(*) FILTER (WHERE execution_type = 'internal_engine' OR status = 'fallback_completed') AS fallback_runs,
        COALESCE(SUM(total_tokens) FILTER (WHERE execution_type = 'provider_api' AND is_provider_verified = TRUE), 0) AS total_tokens,
        COALESCE(SUM(input_tokens) FILTER (WHERE execution_type = 'provider_api' AND is_provider_verified = TRUE), 0) AS input_tokens,
        COALESCE(SUM(output_tokens) FILTER (WHERE execution_type = 'provider_api' AND is_provider_verified = TRUE), 0) AS output_tokens,
        COALESCE(SUM(estimated_cost_usd) FILTER (WHERE execution_type = 'provider_api' AND is_provider_verified = TRUE), 0) AS total_cost,
        COALESCE(AVG(processing_time_ms), 0) AS avg_ms
      FROM ai_usage_log
      WHERE ${dateFilter}
      GROUP BY feature
      ORDER BY total_requests DESC;
    `;

    // Status breakdown across all logged events
    const statusSql = `
      SELECT
        status,
        COUNT(*) AS count
      FROM ai_usage_log
      WHERE ${dateFilter}
      GROUP BY status;
    `;

    // 14-day Time series timeline for ACTUAL VERIFIED PROVIDER CALLS ONLY
    const timelineSql = `
      SELECT
        TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
        COUNT(*) FILTER (WHERE execution_type = 'provider_api') AS requests,
        COUNT(*) FILTER (WHERE execution_type = 'provider_api' AND status = 'completed' AND is_provider_verified = TRUE) AS successful_requests,
        COALESCE(SUM(input_tokens) FILTER (WHERE execution_type = 'provider_api' AND is_provider_verified = TRUE), 0) AS input_tokens,
        COALESCE(SUM(output_tokens) FILTER (WHERE execution_type = 'provider_api' AND is_provider_verified = TRUE), 0) AS output_tokens,
        COALESCE(SUM(total_tokens) FILTER (WHERE execution_type = 'provider_api' AND is_provider_verified = TRUE), 0) AS total_tokens,
        COALESCE(SUM(estimated_cost_usd) FILTER (WHERE execution_type = 'provider_api' AND is_provider_verified = TRUE), 0) AS cost
      FROM ai_usage_log
      WHERE created_at >= NOW() - INTERVAL '14 days'
        AND execution_type = 'provider_api'
        AND is_provider_verified = TRUE
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
      ORDER BY date ASC;
    `;

    // Export downloads count
    const downloadsSql = `SELECT COUNT(*) AS count FROM ai_download_log;`;

    const [featRes, statusRes, timeRes, dlRes] = await Promise.all([
      query(featureSql, params),
      query(statusSql, params),
      query(timelineSql),
      query(downloadsSql),
    ]);

    const statusCounts = {};
    statusRes.rows.forEach((r) => {
      statusCounts[r.status] = parseInt(r.count, 10);
    });

    return {
      budget,
      featureBreakdown: featRes.rows.map((f) => ({
        feature: f.feature,
        totalRequests: parseInt(f.total_requests, 10),
        providerRequests: parseInt(f.provider_requests, 10),
        successfulProviderRequests: parseInt(f.successful_provider_requests, 10),
        fallbackRuns: parseInt(f.fallback_runs, 10),
        totalTokens: parseInt(f.total_tokens, 10),
        inputTokens: parseInt(f.input_tokens, 10),
        outputTokens: parseInt(f.output_tokens, 10),
        totalCost: Number(parseFloat(f.total_cost || 0).toFixed(6)),
        avgProcessingTimeMs: Math.round(parseFloat(f.avg_ms || 0)),
      })),
      usageOverTime: timeRes.rows.map((t) => ({
        date: t.date,
        requests: parseInt(t.requests, 10),
        successfulRequests: parseInt(t.successful_requests, 10),
        inputTokens: parseInt(t.input_tokens, 10),
        outputTokens: parseInt(t.output_tokens, 10),
        totalTokens: parseInt(t.total_tokens, 10),
        cost: Number(parseFloat(t.cost || 0).toFixed(6)),
      })),
      statusCounts,
      downloadsCount: parseInt(dlRes.rows[0]?.count || 0, 10),
      connectionStatus: this.getConnectionStatus(),
    };
  }

  /**
   * Retrieves paginated request logs with search and multi-column filtering.
   */
  async getRequests({
    page = 1,
    limit = 20,
    search = '',
    status = '',
    feature = '',
    executionType = '',
    startDate = null,
    endDate = null,
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ['1=1'];
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(request_id ILIKE $${idx} OR provider_request_id ILIKE $${idx} OR prompt_snippet ILIKE $${idx} OR response_snippet ILIKE $${idx} OR error_message ILIKE $${idx} OR user_name ILIKE $${idx})`
      );
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (feature && feature !== 'all') {
      params.push(feature);
      conditions.push(`feature = $${params.length}`);
    }

    if (executionType && executionType !== 'all') {
      params.push(executionType);
      conditions.push(`execution_type = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      conditions.push(`created_at >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`created_at <= $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    // Count total records
    const countSql = `SELECT COUNT(*) AS total FROM ai_usage_log WHERE ${whereClause};`;
    const countRes = await query(countSql, params);
    const totalRecords = parseInt(countRes.rows[0]?.total || 0, 10);

    // Fetch paginated rows
    const queryParams = [...params, limitNum, offset];
    const dataSql = `
      SELECT
        id,
        request_id AS "requestId",
        provider_request_id AS "providerRequestId",
        execution_type AS "executionType",
        is_provider_verified AS "isProviderVerified",
        user_id AS "userId",
        user_name AS "userName",
        user_email AS "userEmail",
        user_role AS "userRole",
        feature,
        model,
        input_tokens AS "inputTokens",
        output_tokens AS "outputTokens",
        total_tokens AS "totalTokens",
        internal_tokens_est AS "internalTokensEst",
        cache_read_tokens AS "cacheReadTokens",
        cache_write_tokens AS "cacheWriteTokens",
        estimated_cost_usd AS "estimatedCostUsd",
        processing_time_ms AS "processingTimeMs",
        status,
        prompt_snippet AS "promptSnippet",
        response_snippet AS "responseSnippet",
        error_message AS "errorMessage",
        metadata,
        created_at AS "createdAt"
      FROM ai_usage_log
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const dataRes = await query(dataSql, queryParams);

    return {
      requests: dataRes.rows.map((r) => ({
        ...r,
        estimatedCostUsd: Number(parseFloat(r.estimatedCostUsd || 0).toFixed(6)),
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRecords,
        pages: Math.ceil(totalRecords / limitNum) || 1,
      },
    };
  }

  /**
   * Aggregates usage grouped by admin user.
   */
  async getByUser() {
    const sql = `
      SELECT
        user_id AS "userId",
        MAX(user_name) AS "userName",
        MAX(user_email) AS "userEmail",
        MAX(user_role) AS "userRole",
        COUNT(*) AS requests,
        COUNT(*) FILTER (WHERE status = 'completed' AND is_provider_verified = TRUE) AS "successfulRequests",
        COALESCE(SUM(input_tokens) FILTER (WHERE is_provider_verified = TRUE), 0) AS "totalInputTokens",
        COALESCE(SUM(output_tokens) FILTER (WHERE is_provider_verified = TRUE), 0) AS "totalOutputTokens",
        COALESCE(SUM(total_tokens) FILTER (WHERE is_provider_verified = TRUE), 0) AS "totalTokens",
        COALESCE(SUM(estimated_cost_usd) FILTER (WHERE is_provider_verified = TRUE), 0) AS "totalCost",
        MAX(created_at) AS "lastUsedAt"
      FROM ai_usage_log
      GROUP BY user_id
      ORDER BY "totalCost" DESC, requests DESC
      LIMIT 100;
    `;
    const res = await query(sql);
    return res.rows.map((r) => ({
      ...r,
      totalCost: Number(parseFloat(r.totalCost || 0).toFixed(6)),
    }));
  }

  /**
   * Aggregates usage grouped by feature.
   */
  async getByFeature() {
    const sql = `
      SELECT
        feature,
        COUNT(*) AS requests,
        COUNT(*) FILTER (WHERE status = 'completed' AND is_provider_verified = TRUE) AS "successfulRequests",
        COUNT(*) FILTER (WHERE execution_type = 'internal_engine' OR status = 'fallback_completed') AS "fallbackRuns",
        COALESCE(SUM(input_tokens) FILTER (WHERE is_provider_verified = TRUE), 0) AS "totalInputTokens",
        COALESCE(SUM(output_tokens) FILTER (WHERE is_provider_verified = TRUE), 0) AS "totalOutputTokens",
        COALESCE(SUM(total_tokens) FILTER (WHERE is_provider_verified = TRUE), 0) AS "totalTokens",
        COALESCE(SUM(estimated_cost_usd) FILTER (WHERE is_provider_verified = TRUE), 0) AS "totalCost",
        COALESCE(AVG(processing_time_ms), 0) AS "avgProcessingTimeMs"
      FROM ai_usage_log
      GROUP BY feature
      ORDER BY requests DESC;
    `;
    const res = await query(sql);
    return res.rows.map((r) => ({
      ...r,
      totalCost: Number(parseFloat(r.totalCost || 0).toFixed(6)),
      avgProcessingTimeMs: Math.round(parseFloat(r.avgProcessingTimeMs || 0)),
    }));
  }

  /**
   * Exports logs as CSV or JSON and audits the download in PostgreSQL.
   */
  async exportUsage({
    format = 'csv',
    startDate = null,
    endDate = null,
    status = '',
    feature = '',
    executionType = '',
    limit = 5000,
    admin = null,
  } = {}) {
    const limitNum = Math.min(10000, Math.max(1, parseInt(limit, 10) || 5000));
    const conditions = ['1=1'];
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (feature && feature !== 'all') {
      params.push(feature);
      conditions.push(`feature = $${params.length}`);
    }
    if (executionType && executionType !== 'all') {
      params.push(executionType);
      conditions.push(`execution_type = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`created_at <= $${params.length}`);
    }

    params.push(limitNum);
    const sql = `
      SELECT
        request_id AS "requestId",
        provider_request_id AS "providerRequestId",
        execution_type AS "executionType",
        is_provider_verified AS "isProviderVerified",
        created_at AS "createdAt",
        user_name AS "userName",
        user_email AS "userEmail",
        feature,
        model,
        input_tokens AS "inputTokens",
        output_tokens AS "outputTokens",
        total_tokens AS "totalTokens",
        internal_tokens_est AS "internalTokensEst",
        cache_read_tokens AS "cacheReadTokens",
        cache_write_tokens AS "cacheWriteTokens",
        estimated_cost_usd AS "estimatedCostUsd",
        processing_time_ms AS "processingTimeMs",
        status,
        prompt_snippet AS "promptSnippet",
        response_snippet AS "responseSnippet",
        error_message AS "errorMessage"
      FROM ai_usage_log
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${params.length};
    `;

    const res = await query(sql, params);
    const records = res.rows;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `stockwise_ai_usage_${stamp}.${format === 'json' ? 'json' : 'csv'}`;

    // Log the download audit
    const dlId = `DL-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    await query(
      `INSERT INTO ai_download_log (download_id, user_name, user_email, download_type, file_name, record_count, download_time)
       VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
      [
        dlId,
        admin?.fullName || admin?.username || 'Administrator',
        admin?.email || '',
        format === 'json' ? 'json_export' : 'csv_export',
        fileName,
        records.length,
      ]
    ).catch((err) => console.warn('[ClaudeMonitor Warning] Failed to log download:', err.message));

    if (format === 'json') {
      return {
        fileName,
        contentType: 'application/json',
        content: JSON.stringify(records, null, 2),
      };
    }

    // Generate RFC-compliant CSV
    const headers = [
      'Request ID',
      'Execution Type',
      'Provider Verified',
      'Provider Request ID',
      'Date (UTC)',
      'User Name',
      'User Email',
      'Feature',
      'Model',
      'Claude Input Tokens',
      'Claude Output Tokens',
      'Claude Total Tokens',
      'Internal Tokens Est',
      'Cache Read Tokens',
      'Cache Write Tokens',
      'Estimated Cost (USD)',
      'Processing Time (ms)',
      'Status',
      'Prompt Snippet',
      'Response Snippet',
      'Error Message',
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = [headers.join(',')];
    for (const r of records) {
      const row = [
        escapeCsv(r.requestId),
        escapeCsv(r.executionType || 'provider_api'),
        r.isProviderVerified ? '"Yes"' : '"No"',
        escapeCsv(r.providerRequestId || ''),
        escapeCsv(r.createdAt),
        escapeCsv(r.userName),
        escapeCsv(r.userEmail),
        escapeCsv(r.feature),
        escapeCsv(r.model),
        r.inputTokens || 0,
        r.outputTokens || 0,
        r.totalTokens || 0,
        r.internalTokensEst || 0,
        r.cacheReadTokens || 0,
        r.cacheWriteTokens || 0,
        Number(parseFloat(r.estimatedCostUsd || 0).toFixed(6)),
        r.processingTimeMs || 0,
        escapeCsv(r.status),
        escapeCsv(r.promptSnippet),
        escapeCsv(r.responseSnippet),
        escapeCsv(r.errorMessage),
      ];
      rows.push(row.join(','));
    }

    return {
      fileName,
      contentType: 'text/csv; charset=utf-8',
      content: rows.join('\r\n'),
    };
  }
}

const claudeMonitor = new ClaudeMonitorService();

module.exports = {
  claudeMonitor,
  ClaudeMonitorService,
  BudgetExhaustedError,
  calculateCost,
  getPricing,
};
