import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  getClaudeSummary,
  getClaudeRequests,
  testClaudeConnection,
  downloadClaudeUsageExport,
} from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

const STATUS_FILTERS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'completed', label: '✓ Provider Success (200)' },
  { id: 'fallback_completed', label: '⚙ Internal Fallback Engine' },
  { id: 'auth_error', label: '🔒 Auth Errors (401)' },
  { id: 'failed', label: '✗ API Failures' },
  { id: 'budget_exhausted', label: '🛑 Budget Exhausted' },
];

const EXECUTION_TYPE_FILTERS = [
  { id: 'all', label: 'All Execution Types' },
  { id: 'provider_api', label: 'Verified Claude API Only' },
  { id: 'internal_engine', label: 'StockWise Internal Engine (Local)' },
];

export function BiApiUsageView({ dateRange }) {
  const [summary, setSummary] = useState(null);
  const [requestsData, setRequestsData] = useState({ requests: [], pagination: { page: 1, limit: 15, total: 0, pages: 1 } });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [exportingFormat, setExportingFormat] = useState(null);

  // Table filters
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [executionTypeFilter, setExecutionTypeFilter] = useState('all');
  const [featureFilter, setFeatureFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await getClaudeSummary({
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      });
      setSummary(data);
    } catch (err) {
      console.warn('[BiApiUsageView] Failed to fetch summary:', err.message);
    }
  }, [dateRange]);

  const fetchRequests = useCallback(async (page = 1) => {
    try {
      const data = await getClaudeRequests({
        page,
        limit: 15,
        search: searchQuery,
        status: statusFilter,
        executionType: executionTypeFilter,
        feature: featureFilter,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      });
      setRequestsData(data);
      setCurrentPage(page);
    } catch (err) {
      console.warn('[BiApiUsageView] Failed to fetch requests:', err.message);
    }
  }, [searchQuery, statusFilter, executionTypeFilter, featureFilter, dateRange]);

  const loadAll = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    await Promise.all([fetchSummary(), fetchRequests(1)]);

    setIsLoading(false);
    setIsRefreshing(false);
  }, [fetchSummary, fetchRequests]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testClaudeConnection();
      setTestResult(res);
      // Refresh summary and table after test probe
      await Promise.all([fetchSummary(), fetchRequests(1)]);
    } catch (err) {
      setTestResult({
        ok: false,
        statusCode: 500,
        message: err.message || 'Connection test failed to execute.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleExport = async (format) => {
    setExportingFormat(format);
    try {
      await downloadClaudeUsageExport(format, {
        status: statusFilter,
        executionType: executionTypeFilter,
        feature: featureFilter,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
      });
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingFormat(null);
    }
  };

  const budget = summary?.budget || {
    totalBudgetUsd: 5.0,
    usedBudgetUsd: 0,
    remainingBudgetUsd: 5.0,
    usagePercentage: 0,
    isExhausted: false,
    color: '#10b981',
    warningLevel: 'normal',
    warningMessage: null,
  };

  const internalEngine = summary?.budget?.internalEngine || {
    totalRuns: 0,
    estimatedTokensProcessed: 0,
    avgLatencyMs: 0,
    costUsd: 0,
  };

  const conn = summary?.connectionStatus || {};

  return (
    <div className="bi-api-usage-view">
      {/* 1. Header Toolbar */}
      <div className="usage-header-toolbar">
        <div>
          <h2 className="usage-page-title" style={{ color: '#ffffff', fontWeight: 700 }}>
            <span className="title-icon">⚡</span> AI Usage & Budget Monitor
          </h2>
          <p className="usage-page-subtitle" style={{ color: '#cbd5e1' }}>
            Enterprise token telemetry, USD cost accounting, and spending pool limits grounded in PostgreSQL.
          </p>
        </div>

        <div className="usage-actions-group">
          <button
            type="button"
            className="usage-btn btn-secondary"
            onClick={() => loadAll(true)}
            disabled={isRefreshing || isLoading}
            title="Refresh monitor telemetry"
          >
            {isRefreshing ? 'Refreshing...' : '🔄 Refresh'}
          </button>

          <button
            type="button"
            className="usage-btn btn-test-conn"
            onClick={handleTestConnection}
            disabled={isTesting}
            title="Trigger a real-time credential probe against Anthropic API"
          >
            {isTesting ? 'Testing Probe...' : '🧪 Test API Key'}
          </button>

          <button
            type="button"
            className="usage-btn btn-export-csv"
            onClick={() => handleExport('csv')}
            disabled={Boolean(exportingFormat)}
            title="Download full token accounting ledger as CSV / Excel"
          >
            {exportingFormat === 'csv' ? 'Exporting...' : '📥 Export Excel / CSV'}
          </button>

          <button
            type="button"
            className="usage-btn btn-secondary"
            onClick={() => handleExport('json')}
            disabled={Boolean(exportingFormat)}
            title="Export usage records as JSON"
          >
            {exportingFormat === 'json' ? 'Exporting...' : '📥 JSON'}
          </button>
        </div>
      </div>

      {/* 2. Connection Diagnostics Banner */}
      <div
        className={`usage-diagnostic-banner ${
          testResult ? (testResult.ok ? 'banner-success' : 'banner-warning') : 'banner-info'
        }`}
      >
        <div className="banner-left">
          <span className="banner-badge-icon">
            {testResult ? (testResult.ok ? '✅' : '⚠️') : '🔒'}
          </span>
          <div>
            <div className="banner-title-line">
              <strong>Provider Connection Status:</strong>{' '}
              {testResult ? (
                testResult.ok ? (
                  <span className="text-success font-bold">Authenticated & Live (200 OK)</span>
                ) : (
                  <span className="text-danger font-bold">
                    Provider Rejected Credential ({testResult.statusCode}: {testResult.errorType || 'Invalid Key'})
                  </span>
                )
              ) : conn.configured ? (
                <span className="text-warning font-bold">
                  Credential Configured ({conn.maskedKey || 'sk-ant-api03...****'})
                </span>
              ) : (
                <span className="text-danger font-bold">No API Key Found</span>
              )}
            </div>
            <p className="banner-desc">
              {testResult?.message ||
                (conn.configured
                  ? `Active model pricing tiers loaded. To verify your current API key, click 'Test API Key' above.`
                  : `Please configure ANTHROPIC_API_KEY in server/.env to enable live Claude intelligence.`)}
            </p>
          </div>
        </div>

        {conn.maskedKey && (
          <div className="banner-key-tag">
            <span className="key-label">Key:</span>
            <code>{conn.maskedKey}</code>
          </div>
        )}
      </div>

      {/* Budget Warning Banner if elevated */}
      {budget.warningMessage && (
        <div className="budget-alert-banner" style={{ borderColor: budget.color }}>
          <span>{budget.warningMessage}</span>
        </div>
      )}

      {/* 3. Top Ribbon KPI Cards */}
      <div className="usage-kpi-ribbon">
        {/* Card 1: Budget Pool */}
        <div className="usage-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-title">Claude API Spending Pool</span>
            <span className="kpi-card-icon">💳</span>
          </div>
          <div className="kpi-card-main-value">
            ${budget.totalBudgetUsd.toFixed(2)} USD
          </div>
          <div className="kpi-budget-progress-track">
            <div
              className="kpi-budget-progress-fill"
              style={{
                width: `${budget.usagePercentage}%`,
                backgroundColor: budget.color || '#10b981',
              }}
            />
          </div>
          <div className="kpi-card-footer">
            <span>{budget.usagePercentage}% consumed</span>
            <span className="font-bold text-success">${budget.remainingBudgetUsd.toFixed(4)} left</span>
          </div>
        </div>

        {/* Card 2: Tracked Cost */}
        <div className="usage-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-title">Estimated Provider Cost</span>
            <span className="kpi-card-icon">💰</span>
          </div>
          <div className="kpi-card-main-value font-mono">
            ${budget.usedBudgetUsd.toFixed(6)}
          </div>
          <div className="kpi-card-subtext">
            ≈ ₹{(budget.usedBudgetUsd * 86.5).toFixed(2)} INR (Estimated from model rates)
          </div>
          <div className="kpi-card-footer">
            <span>Verified Provider Usage Only</span>
          </div>
        </div>

        {/* Card 3: Total Requests */}
        <div className="usage-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-title">Verified Provider Requests</span>
            <span className="kpi-card-icon">📡</span>
          </div>
          <div className="kpi-card-main-value">
            {summary?.budget?.totalRequests ?? 0}
          </div>
          <div className="kpi-card-breakdown-row">
            <span className="text-success font-semibold">
              ✓ {summary?.budget?.successfulRequests ?? 0} successful
            </span>
            <span className="text-danger font-semibold">
              ✗ {summary?.budget?.failedRequests ?? 0} auth/failed
            </span>
          </div>
          <div className="kpi-card-footer">
            <span>Sent to Anthropic provider</span>
          </div>
        </div>

        {/* Card 4: Token Consumption */}
        <div className="usage-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-title">Verified Provider Tokens</span>
            <span className="kpi-card-icon">🔤</span>
          </div>
          <div className="kpi-card-main-value">
            {Number(budget.totalTokens || 0).toLocaleString()}
          </div>
          <div className="kpi-card-breakdown-row">
            <span>In: {Number(budget.totalInputTokens || 0).toLocaleString()}</span>
            <span>Out: {Number(budget.totalOutputTokens || 0).toLocaleString()}</span>
          </div>
          <div className="kpi-card-footer">
            <span>Cache Read: {Number(budget.cacheReadTokens || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Internal Engine Local Execution Telemetry Banner */}
      <div className="internal-telemetry-banner">
        <div className="internal-telemetry-header">
          <span style={{ fontSize: '22px' }}>⚙️</span>
          <div>
            <div className="internal-telemetry-title">
              StockWise Retail BI Engine Telemetry (Local & Offline Fallback)
            </div>
            <p className="internal-telemetry-sub">
              Deterministic PostgreSQL intelligence engine running on local store data. Operates offline at $0.00 Claude cost.
            </p>
          </div>
        </div>
        <div className="internal-telemetry-metrics">
          <div className="internal-metric-item">
            <span>Fallback Engine Runs</span>
            <strong>{internalEngine.totalRuns} runs</strong>
          </div>
          <div className="internal-metric-item">
            <span>Internal Compute Est.</span>
            <strong>{Number(internalEngine.estimatedTokensProcessed || 0).toLocaleString()} tokens (est)</strong>
          </div>
          <div className="internal-metric-item">
            <span>Claude API Cost</span>
            <strong className="text-success">$0.000000 USD</strong>
          </div>
          <div className="internal-metric-item">
            <span>Avg Latency</span>
            <strong>{internalEngine.avgLatencyMs} ms</strong>
          </div>
        </div>
      </div>

      {/* 4. Interactive Graphical Charts */}
      <div className="usage-charts-grid">
        {/* Chart 1: Token Usage Over Time */}
        <div className="usage-chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">
                📈 Daily Provider Token Consumption Trend
              </h3>
              <p className="chart-card-sub">
                Verified input vs output token volume sent to Anthropic
              </p>
            </div>
          </div>

          <div className="chart-body">
            {isLoading ? (
              <LoadingSpinner message="Loading token telemetry..." />
            ) : !summary?.usageOverTime || summary.usageOverTime.length === 0 ? (
              <EmptyState
                title="No Verified Provider Usage Yet"
                message="Charts display verified Anthropic provider calls only. Internal fallback runs do not incur Claude tokens or costs."
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={summary.usageOverTime} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tokenInputGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="tokenOutputGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#0f172a', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="inputTokens" name="Input Tokens" stroke="#3b82f6" fill="url(#tokenInputGrad)" />
                  <Area type="monotone" dataKey="outputTokens" name="Output Tokens" stroke="#10b981" fill="url(#tokenOutputGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Cost Over Time */}
        <div className="usage-chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">
                💵 Daily Accrued AI Cost ($ USD)
              </h3>
              <p className="chart-card-sub">
                Estimated dollar consumption based on verified Anthropic model pricing
              </p>
            </div>
          </div>

          <div className="chart-body">
            {isLoading ? (
              <LoadingSpinner message="Calculating cost breakdown..." />
            ) : !summary?.usageOverTime || summary.usageOverTime.length === 0 ? (
              <EmptyState
                title="No Provider Cost Accrued"
                message="Cost graph reflects verified provider API usage. Internal fallback responses operate at $0 cost."
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={summary.usageOverTime} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#0f172a', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                    formatter={(val) => [`$${Number(val).toFixed(6)} USD`, 'Estimated Cost']}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="cost" name="Estimated Cost (USD)" stroke="#8b5cf6" fill="url(#costGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Feature Breakdown Table / Cards */}
      {summary?.featureBreakdown && summary.featureBreakdown.length > 0 && (
        <div className="usage-section-card">
          <div className="section-card-header">
            <h3 className="section-card-title">
              🧩 AI Usage by Feature
            </h3>
          </div>
          <div className="feature-breakdown-grid">
            {summary.featureBreakdown.map((f) => (
              <div key={f.feature} className="feature-pill-card">
                <div className="feature-pill-title">
                  {f.feature}
                </div>
                <div className="feature-pill-metrics">
                  <span><strong>{f.requests}</strong> provider calls</span>
                  {f.fallbackRuns > 0 && <span><strong>{f.fallbackRuns}</strong> fallbacks</span>}
                  <span><strong>{Number(f.totalTokens).toLocaleString()}</strong> tokens</span>
                  <span className="text-success font-mono"><strong>${f.totalCost.toFixed(6)}</strong></span>
                  <span>{f.avgProcessingTimeMs}ms avg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Request History & Ledger */}
      <div className="usage-section-card">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">
              📜 API Request History & Audit Ledger
            </h3>
            <p className="section-card-sub">
              Total {requestsData.pagination.total} records logged with immutable database audit trail.
            </p>
          </div>

          <div className="history-filters-bar">
            {/* Search */}
            <input
              type="text"
              className="history-search-input"
              placeholder="Search request ID, prompt, error..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchRequests(1);
              }}
            />

            {/* Execution Type Filter */}
            <select
              className="history-filter-select"
              value={executionTypeFilter}
              onChange={(e) => {
                setExecutionTypeFilter(e.target.value);
              }}
            >
              {EXECUTION_TYPE_FILTERS.map((ef) => (
                <option key={ef.id} value={ef.id}>
                  {ef.label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="history-filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
              }}
            >
              {STATUS_FILTERS.map((sf) => (
                <option key={sf.id} value={sf.id}>
                  {sf.label}
                </option>
              ))}
            </select>

            {/* Feature Filter */}
            <select
              className="history-filter-select"
              value={featureFilter}
              onChange={(e) => {
                setFeatureFilter(e.target.value);
              }}
            >
              <option value="all">All Features</option>
              <option value="Executive Briefing">Executive Briefing</option>
              <option value="AI Chat Q&A">AI Chat Q&A</option>
              <option value="API Health Probe">API Health Probe</option>
            </select>
          </div>
        </div>

        {/* Requests Table */}
        <div className="usage-table-wrapper">
          <table className="usage-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Request ID</th>
                <th>Type</th>
                <th>Feature</th>
                <th>Model / Engine</th>
                <th>Tokens (In / Out / Total)</th>
                <th>Estimated Cost</th>
                <th>Latency</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {requestsData.requests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-empty-cell">
                    <EmptyState
                      title="No Request Records Found"
                      message="No API usage logs match your selected filter criteria."
                    />
                  </td>
                </tr>
              ) : (
                requestsData.requests.map((r) => {
                  const isSuccess = r.status === 'completed';
                  const isFallback = r.status === 'fallback_completed';
                  const isAuth = r.status === 'auth_error';
                  const isBudget = r.status === 'budget_exhausted';
                  const isInternal = r.executionType === 'internal_engine';

                  return (
                    <tr key={r.id || r.requestId}>
                      <td className="cell-timestamp font-mono text-xs">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="cell-req-id font-mono font-semibold text-xs text-primary">
                        <div>{r.requestId}</div>
                        {r.providerRequestId && (
                          <div className="text-muted" style={{ fontSize: '10px' }}>
                            PID: {r.providerRequestId}
                          </div>
                        )}
                      </td>
                      <td>
                        {isInternal ? (
                          <span className="badge-internal-engine">⚙ Local Engine</span>
                        ) : (
                          <span className="badge-provider-api">☁ Claude API</span>
                        )}
                      </td>
                      <td>{r.feature}</td>
                      <td>
                        <span className="model-chip" title={r.model}>
                          {isInternal ? 'Retail BI (Local)' : (r.model || 'Claude')}
                        </span>
                      </td>
                      <td className="font-mono text-xs">
                        {isInternal ? (
                          <span className="text-muted">
                            {Number(r.internalTokensEst || 0).toLocaleString()} (Local Est.)
                          </span>
                        ) : r.isProviderVerified ? (
                          `${r.inputTokens} / ${r.outputTokens} (${r.totalTokens})`
                        ) : (
                          <span className="text-muted">0 (Unverified)</span>
                        )}
                      </td>
                      <td className="font-mono text-xs font-semibold text-success">
                        ${Number(r.estimatedCostUsd).toFixed(6)}
                      </td>
                      <td className="font-mono text-xs text-muted">
                        {r.processingTimeMs}ms
                      </td>
                      <td>
                        <span
                          className={`status-pill-badge ${
                            isSuccess
                              ? 'status-success'
                              : isFallback
                              ? 'status-fallback'
                              : isAuth
                              ? 'status-auth-error'
                              : isBudget
                              ? 'status-budget'
                              : 'status-failed'
                          }`}
                        >
                          {isSuccess
                            ? '✓ Provider 200'
                            : isFallback
                            ? '⚙ Fallback'
                            : isAuth
                            ? '🔒 401 Auth'
                            : isBudget
                            ? '🛑 Budget'
                            : '✗ Failed'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-inspect-req"
                          onClick={() => setSelectedRequest(r)}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {requestsData.pagination.pages > 1 && (
          <div className="usage-pagination-bar">
            <span className="pagination-info">
              Showing page {requestsData.pagination.page} of {requestsData.pagination.pages} ({requestsData.pagination.total} records)
            </span>
            <div className="pagination-buttons">
              <button
                type="button"
                className="usage-btn btn-secondary btn-sm"
                disabled={currentPage <= 1}
                onClick={() => fetchRequests(currentPage - 1)}
              >
                ← Prev
              </button>
              <button
                type="button"
                className="usage-btn btn-secondary btn-sm"
                disabled={currentPage >= requestsData.pagination.pages}
                onClick={() => fetchRequests(currentPage + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Request Detail Modal */}
      {selectedRequest && (
        <div className="modal-backdrop" onClick={() => setSelectedRequest(null)} role="dialog">
          <div className="modal-card usage-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 className="modal-title">Request Audit Detail</h3>
                <span className="font-mono text-xs text-primary">{selectedRequest.requestId}</span>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setSelectedRequest(null)}>
                &times;
              </button>
            </div>

            <div className="modal-body usage-detail-body">
              <div className="detail-meta-grid">
                <div>
                  <span className="meta-label">Timestamp:</span>
                  <span className="meta-value">{new Date(selectedRequest.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="meta-label">Execution Type:</span>
                  <span className="meta-value font-semibold">
                    {selectedRequest.executionType === 'internal_engine'
                      ? 'StockWise Internal Engine (Local SQL)'
                      : 'Third-Party Provider (Claude API)'}
                  </span>
                </div>
                <div>
                  <span className="meta-label">Provider Verified:</span>
                  <span className="meta-value font-semibold">
                    {selectedRequest.isProviderVerified ? '✅ Yes (Anthropic Verified)' : '❌ No (Local / Failed)'}
                  </span>
                </div>
                {selectedRequest.providerRequestId && (
                  <div>
                    <span className="meta-label">Provider Request ID:</span>
                    <span className="meta-value font-mono">{selectedRequest.providerRequestId}</span>
                  </div>
                )}
                <div>
                  <span className="meta-label">Feature:</span>
                  <span className="meta-value font-semibold">{selectedRequest.feature}</span>
                </div>
                <div>
                  <span className="meta-label">Model / Engine:</span>
                  <span className="meta-value font-mono">{selectedRequest.model || 'Claude'}</span>
                </div>
                <div>
                  <span className="meta-label">Status:</span>
                  <span className="meta-value font-bold">{selectedRequest.status}</span>
                </div>
                <div>
                  <span className="meta-label">Actual Input Tokens:</span>
                  <span className="meta-value font-mono">{selectedRequest.inputTokens}</span>
                </div>
                <div>
                  <span className="meta-label">Actual Output Tokens:</span>
                  <span className="meta-value font-mono">{selectedRequest.outputTokens}</span>
                </div>
                {selectedRequest.internalTokensEst > 0 && (
                  <div>
                    <span className="meta-label">Internal Tokens Est:</span>
                    <span className="meta-value font-mono">{selectedRequest.internalTokensEst}</span>
                  </div>
                )}
                <div>
                  <span className="meta-label">Estimated Claude Cost:</span>
                  <span className="meta-value font-mono font-bold text-success">${selectedRequest.estimatedCostUsd} USD</span>
                </div>
                <div>
                  <span className="meta-label">Processing Time:</span>
                  <span className="meta-value font-mono">{selectedRequest.processingTimeMs} ms</span>
                </div>
              </div>

              {selectedRequest.errorMessage && (
                <div className="detail-error-box">
                  <span className="error-box-title">⚠️ Error / Diagnostic:</span>
                  <p className="font-mono text-xs">{selectedRequest.errorMessage}</p>
                </div>
              )}

              {selectedRequest.promptSnippet && (
                <div className="detail-snippet-section">
                  <span className="snippet-title">Prompt Snippet:</span>
                  <pre className="snippet-box">{selectedRequest.promptSnippet}</pre>
                </div>
              )}

              {selectedRequest.responseSnippet && (
                <div className="detail-snippet-section">
                  <span className="snippet-title">Response Snippet:</span>
                  <pre className="snippet-box">{selectedRequest.responseSnippet}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default BiApiUsageView;
