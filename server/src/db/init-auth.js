const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./pool');

/**
 * Initializes the authentication and activity log schema in PostgreSQL.
 * Creates 'admins' and 'activity_logs' tables and seeds an initial shop admin.
 */
async function initAuthSchema() {
  console.log('[StockWise Auth] Initializing admin authentication and activity logging schema...');

  const createTablesSql = `
    -- 1. Shop Admins Table
    CREATE TABLE IF NOT EXISTS admins (
      admin_id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin' NOT NULL,
      status SMALLINT DEFAULT 1 NOT NULL,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    -- 2. Database Activity & Audit Logs Table
    CREATE TABLE IF NOT EXISTS activity_logs (
      log_id BIGSERIAL PRIMARY KEY,
      admin_id INTEGER REFERENCES admins(admin_id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      details JSONB DEFAULT '{}'::jsonb,
      ip_address VARCHAR(45),
      user_agent TEXT,
      status VARCHAR(20) DEFAULT 'SUCCESS' NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );

    -- Indexes for high-performance querying and reporting
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_admin_id ON activity_logs (admin_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs (action);
    CREATE INDEX IF NOT EXISTS idx_admins_username ON admins (username);
    CREATE INDEX IF NOT EXISTS idx_admins_email ON admins (email);
  `;

  await query(createTablesSql);
  console.log('✅ [StockWise Auth] Tables and indexes created successfully.');

  // Check if default admin exists
  const checkAdminRes = await query('SELECT admin_id, username, email FROM admins LIMIT 1;');
  if (checkAdminRes.rows.length === 0) {
    const saltRounds = 10;
    const defaultPassword = 'AdminPassword123!';
    const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

    const insertAdminSql = `
      INSERT INTO admins (username, email, password_hash, full_name, role, status)
      VALUES ($1, $2, $3, $4, $5, 1)
      RETURNING admin_id, username, email, full_name, role;
    `;
    const newAdmin = await query(insertAdminSql, [
      'admin',
      'admin@stockwise.ai',
      passwordHash,
      'Store Administrator',
      'super_admin',
    ]);

    console.log('✅ [StockWise Auth] Default shop admin seeded successfully:');
    console.log(`   Username: ${newAdmin.rows[0].username}`);
    console.log(`   Email: ${newAdmin.rows[0].email}`);
    console.log(`   Initial Password: ${defaultPassword}`);

    // Log seed activity
    await query(
      `INSERT INTO activity_logs (admin_id, action, details, status)
       VALUES ($1, $2, $3, $4);`,
      [
        newAdmin.rows[0].admin_id,
        'SYSTEM_ADMIN_SEEDED',
        JSON.stringify({ note: 'Initial admin account provisioned during setup' }),
        'SUCCESS',
      ]
    );
  } else {
    console.log(`ℹ️ [StockWise Auth] Existing shop admin found (${checkAdminRes.rows[0].username}). Skipping seed.`);
  }

  return { ok: true };
}

if (require.main === module) {
  initAuthSchema()
    .then(() => {
      console.log('Schema initialization complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Schema initialization failed:', err);
      process.exit(1);
    });
}

module.exports = { initAuthSchema };
