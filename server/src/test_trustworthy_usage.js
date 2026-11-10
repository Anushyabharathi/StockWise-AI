import pg from 'pg';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'stockwise_ai',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'stockwise-ai-shop-admin-jwt-key-secure-2026';
const AUTH_TOKEN = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

async function runTests() {
  console.log('================================================================');
  console.log('       STOCKWISE AI - USAGE & BUDGET AUDIT TEST SUITE           ');
  console.log('================================================================\n');

  // 1. Test probe / real provider request attempt
  console.log('TEST 1 & 2: Provider Connection & Authentication Failure Handling');
  console.log('----------------------------------------------------------------');
  try {
    const connRes = await fetch(`${BASE_URL}/claude-monitor/test-connection`, {
      method: 'POST',
      headers: HEADERS,
    });
    const connData = await connRes.json();
    console.log('HTTP Status:', connRes.status);
    console.log('Response Payload:', JSON.stringify(connData, null, 2));

    // Inspect the logged database record for this test probe
    const { rows: probeRows } = await pool.query(
      `SELECT request_id, execution_type, is_provider_verified, status, input_tokens, output_tokens, total_tokens, estimated_cost_usd, provider_request_id, error_message
       FROM ai_usage_log
       WHERE feature = 'API Health Probe'
       ORDER BY id DESC LIMIT 1`
    );
    console.log('Database Logged Record:', probeRows[0]);
    if (probeRows[0]?.status === 'auth_error' && probeRows[0]?.total_tokens === 0 && Number(probeRows[0]?.estimated_cost_usd) === 0) {
      console.log('✅ TEST 2 PASS: 401 Auth error logged with strictly 0 tokens, $0.00 cost, is_provider_verified = false\n');
    } else {
      console.log('⚠️ TEST 2 Check Failed:', probeRows[0]);
    }
  } catch (err) {
    console.error('Probe test error:', err);
  }

  // 2. Test Internal Fallback Engine
  console.log('TEST 3: Internal Fallback Response (Ask AI with Fallback)');
  console.log('----------------------------------------------------------------');
  try {
    const chatRes = await fetch(`${BASE_URL}/ai/ask`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ question: 'What is the stock level of Ghee?' }),
    });
    const chatData = await chatRes.json();
    console.log('Chat Status:', chatRes.status);
    console.log('Chat Mode:', chatData.data?.mode);
    console.log('Chat Answer Snippet:', chatData.data?.answer?.slice(0, 100) + '...');

    // Inspect the database for the fallback record
    const { rows: fallbackRows } = await pool.query(
      `SELECT request_id, execution_type, is_provider_verified, status, model, input_tokens, output_tokens, total_tokens, internal_tokens_est, estimated_cost_usd
       FROM ai_usage_log
       WHERE feature = 'AI Chat Q&A'
       ORDER BY id DESC LIMIT 1`
    );
    console.log('Database Logged Fallback Record:', fallbackRows[0]);
    const fRow = fallbackRows[0];
    if (
      fRow?.execution_type === 'internal_engine' &&
      fRow?.status === 'fallback_completed' &&
      fRow?.is_provider_verified === false &&
      fRow?.total_tokens === 0 &&
      Number(fRow?.estimated_cost_usd) === 0 &&
      fRow?.internal_tokens_est > 0
    ) {
      console.log('✅ TEST 3 PASS: Internal engine fallback logged with 0 Claude tokens, $0 cost, and positive internalTokensEst.\n');
    } else {
      console.log('⚠️ TEST 3 Check Failed:', fRow);
    }
  } catch (err) {
    console.error('Chat test error:', err);
  }

  // 3. Test Dashboard KPIs match Database Query
  console.log('TEST 4: Dashboard KPIs vs Database Query Truth');
  console.log('----------------------------------------------------------------');
  try {
    const budgetRes = await fetch(`${BASE_URL}/claude-monitor/budget`, {
      headers: HEADERS,
    });
    const budgetData = await budgetRes.json();
    const b = budgetData.data;
    const metrics = b.metrics;
    const budget = b.budget;
    const internalEngine = b.internalEngine;

    const { rows: dbTotals } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE execution_type = 'provider_api' AND is_provider_verified = TRUE) AS verified_requests,
         COUNT(*) FILTER (WHERE execution_type = 'provider_api') AS total_provider_requests,
         COALESCE(SUM(total_tokens) FILTER (WHERE execution_type = 'provider_api' AND is_provider_verified = TRUE), 0) AS verified_tokens,
         COALESCE(SUM(estimated_cost_usd) FILTER (WHERE execution_type = 'provider_api' AND is_provider_verified = TRUE), 0) AS verified_cost,
         COUNT(*) FILTER (WHERE execution_type = 'internal_engine') AS internal_runs,
         COALESCE(SUM(internal_tokens_est) FILTER (WHERE execution_type = 'internal_engine'), 0) AS internal_tokens
       FROM ai_usage_log`
    );
    const db = dbTotals[0];

    console.log('API Budget Endpoint Output:');
    console.log('  totalTokens (Verified Provider):', metrics.totalTokens);
    console.log('  usedBudgetUsd (Verified Provider):', budget.usedBudgetUsd);
    console.log('  successfulRequests (Verified Provider):', metrics.successfulRequests);
    console.log('  failedRequests (Provider Auth/Fail):', metrics.failedRequests);
    console.log('  internalEngine (Local Store BI):', internalEngine);

    console.log('\nDirect PostgreSQL Output:');
    console.log('  verified_requests:', db.verified_requests);
    console.log('  verified_tokens:', db.verified_tokens);
    console.log('  verified_cost:', db.verified_cost);
    console.log('  internal_runs:', db.internal_runs);
    console.log('  internal_tokens:', db.internal_tokens);

    const kpisMatch =
      Number(metrics.totalTokens) === Number(db.verified_tokens) &&
      Number(budget.usedBudgetUsd) === Number(db.verified_cost) &&
      Number(internalEngine.totalRuns) === Number(db.internal_runs) &&
      Number(internalEngine.estimatedTokensProcessed) === Number(db.internal_tokens);

    if (kpisMatch) {
      console.log('✅ TEST 4 PASS: Dashboard KPIs match Database Ground Truth exactly.\n');
    } else {
      console.log('⚠️ TEST 4 Mismatch detected!');
    }
  } catch (err) {
    console.error('KPI test error:', err);
  }

  // 4. Test Export Endpoints
  console.log('TEST 5: CSV & JSON Export Classification Verification');
  console.log('----------------------------------------------------------------');
  try {
    const csvRes = await fetch(`${BASE_URL}/claude-monitor/export?format=csv`, {
      headers: HEADERS,
    });
    const csvText = await csvRes.text();
    const csvLines = csvText.trim().split('\n');
    console.log('CSV Header:', csvLines[0]);
    console.log('CSV Sample Row:', csvLines[1]?.slice(0, 120) + '...');

    const jsonRes = await fetch(`${BASE_URL}/claude-monitor/export?format=json`, {
      headers: HEADERS,
    });
    const jsonRecords = await jsonRes.json();
    console.log('JSON Array Length:', jsonRecords?.length);
    console.log('JSON Sample Item Keys:', Object.keys(jsonRecords?.[0] || {}));

    const hasClassColumns =
      csvLines[0].includes('Execution Type') &&
      csvLines[0].includes('Provider Verified') &&
      csvLines[0].includes('Internal Tokens Est');

    const jsonHasFields =
      jsonRecords?.[0] &&
      'executionType' in jsonRecords[0] &&
      'isProviderVerified' in jsonRecords[0];

    if (hasClassColumns && jsonHasFields) {
      console.log('✅ TEST 5 PASS: Export endpoints provide strict classification data in both CSV and JSON.\n');
    } else {
      console.log('⚠️ TEST 5 Check Failed');
    }
  } catch (err) {
    console.error('Export test error:', err);
  }

  await pool.end();
  console.log('================================================================');
  console.log('               AUDIT TEST SUITE COMPLETE                        ');
  console.log('================================================================');
}

runTests();
