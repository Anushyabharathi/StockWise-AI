const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();
const { query } = require('./pool');

/**
 * Initializes the AI Usage & Budget Monitor schema in PostgreSQL.
 * Creates 'ai_usage_log' and 'ai_download_log' tables with high-performance indexes.
 */
async function initMonitorSchema() {
  console.log('[StockWise AI Monitor] Initializing AI usage and budget monitoring schema...');

  const createTablesSql = `
    -- 1. AI Usage & Token Accounting Log Table
    CREATE TABLE IF NOT EXISTS ai_usage_log (
      id BIGSERIAL PRIMARY KEY,
      request_id VARCHAR(100) UNIQUE NOT NULL,
      user_id VARCHAR(50),
      user_name VARCHAR(100) DEFAULT 'Store Administrator',
      user_email VARCHAR(255) DEFAULT '',
      user_role VARCHAR(50) DEFAULT 'admin',
      feature VARCHAR(100) DEFAULT 'Claude AI General',
      prompt_snippet TEXT,
      response_snippet TEXT,
      model VARCHAR(100),
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_write_tokens INTEGER DEFAULT 0,
      estimated_cost_usd NUMERIC(12, 6) DEFAULT 0,
      processing_time_ms INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'completed',
      execution_type VARCHAR(50) DEFAULT 'provider_api' NOT NULL,
      provider_request_id VARCHAR(100),
      is_provider_verified BOOLEAN DEFAULT FALSE NOT NULL,
      internal_tokens_est INTEGER DEFAULT 0,
      error_message TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    -- 2. AI Download & Export Audit Log Table
    CREATE TABLE IF NOT EXISTS ai_download_log (
      id BIGSERIAL PRIMARY KEY,
      download_id VARCHAR(100) UNIQUE NOT NULL,
      user_name VARCHAR(100) DEFAULT 'Administrator',
      user_email VARCHAR(255) DEFAULT '',
      download_type VARCHAR(50) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      record_count INTEGER DEFAULT 0,
      download_time TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    -- Indexes for fast analytics, time-series aggregation, and history search
    CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_log (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_status ON ai_usage_log (status);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage_log (feature);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_request_id ON ai_usage_log (request_id);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_exec_type ON ai_usage_log (execution_type);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_is_provider_verified ON ai_usage_log (is_provider_verified);
    CREATE INDEX IF NOT EXISTS idx_ai_download_time ON ai_download_log (download_time DESC);
  `;

  await query(createTablesSql);
  console.log('✅ [StockWise AI Monitor] Schema tables and indexes verified successfully.');
  return { ok: true };
}

if (require.main === module) {
  initMonitorSchema()
    .then(() => {
      console.log('Monitor schema setup complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Monitor schema setup failed:', err);
      process.exit(1);
    });
}

module.exports = { initMonitorSchema };
