const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();
const { Pool } = require('pg');

const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

let pool = null;

if (missingVars.length > 0) {
  console.warn(
    `[Database] Warning: Missing database environment variables: ${missingVars.join(', ')}.\n` +
    `[Database] Database operations will fail until these are configured in your server/.env file.`
  );
} else {
  pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[Database Pool Error] Unexpected error on idle client:', err.message);
  });
}

/**
 * Executes a parameterized SQL query against the PostgreSQL pool.
 * @param {string} text - The SQL query text.
 * @param {Array} [params] - Query parameters.
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  if (missingVars.length > 0) {
    const error = new Error(
      `Database connection is unconfigured. Missing environment variable(s): ${missingVars.join(', ')}`
    );
    error.code = 'DATABASE_UNCONFIGURED';
    error.status = 503;
    throw error;
  }

  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SQL Query] Executed in ${duration}ms, rows: ${res.rowCount}`);
    }
    return res;
  } catch (err) {
    console.error('[SQL Query Error]:', err.message);
    throw err;
  }
}

/**
 * Checks PostgreSQL database connectivity safely without exposing secrets.
 * @returns {Promise<{ ok: boolean, message: string, timestamp?: string }>}
 */
async function checkConnection() {
  if (missingVars.length > 0) {
    return {
      ok: false,
      message: `Database credentials incomplete. Missing environment variable(s): ${missingVars.join(', ')}`,
    };
  }

  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT NOW() AS current_time, current_database() AS db_name');
      return {
        ok: true,
        message: 'Connected to PostgreSQL database successfully.',
        timestamp: res.rows[0].current_time,
        database: res.rows[0].db_name,
      };
    } finally {
      client.release();
    }
  } catch (err) {
    return {
      ok: false,
      message: `Connection failed: ${err.message}`,
    };
  }
}

module.exports = {
  pool,
  query,
  checkConnection,
  missingVars,
};
