const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { getJwtSecret } = require('../middleware/auth');
const activityService = require('./activity.service');

class AuthService {
  /**
   * Authenticates a shop administrator and logs the activity event.
   *
   * @param {Object} credentials
   * @param {string} credentials.usernameOrEmail
   * @param {string} credentials.password
   * @param {string|null} [credentials.ipAddress]
   * @param {string|null} [credentials.userAgent]
   */
  async login({ usernameOrEmail, password, ipAddress = null, userAgent = null }) {
    if (!usernameOrEmail || !password) {
      const error = new Error('Username/Email and Password are required.');
      error.status = 400;
      error.code = 'CREDENTIALS_REQUIRED';
      throw error;
    }

    const cleanInput = String(usernameOrEmail).trim().toLowerCase();

    // Query admin by username or email
    const sql = `
      SELECT admin_id, username, email, password_hash, full_name, role, status, last_login_at
      FROM admins
      WHERE (LOWER(username) = $1 OR LOWER(email) = $1);
    `;
    const result = await query(sql, [cleanInput]);

    if (result.rows.length === 0) {
      await activityService.log({
        adminId: null,
        action: 'AUTH_LOGIN_FAILED',
        details: { reason: 'Account not found', attemptedIdentifier: cleanInput },
        ipAddress,
        userAgent,
        status: 'FAILURE',
      });

      const error = new Error('Invalid username/email or password.');
      error.status = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const admin = result.rows[0];

    if (admin.status !== 1) {
      await activityService.log({
        adminId: admin.admin_id,
        action: 'AUTH_LOGIN_FAILED',
        details: { reason: 'Account disabled', username: admin.username },
        ipAddress,
        userAgent,
        status: 'FAILURE',
      });

      const error = new Error('This administrator account has been disabled. Please contact support.');
      error.status = 403;
      error.code = 'ACCOUNT_DISABLED';
      throw error;
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      await activityService.log({
        adminId: admin.admin_id,
        action: 'AUTH_LOGIN_FAILED',
        details: { reason: 'Incorrect password', username: admin.username },
        ipAddress,
        userAgent,
        status: 'FAILURE',
      });

      const error = new Error('Invalid username/email or password.');
      error.status = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // Update last_login_at
    await query('UPDATE admins SET last_login_at = NOW(), updated_at = NOW() WHERE admin_id = $1;', [
      admin.admin_id,
    ]);

    // Record successful login in activity_logs
    await activityService.log({
      adminId: admin.admin_id,
      action: 'AUTH_LOGIN_SUCCESS',
      details: { username: admin.username, role: admin.role },
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });

    const adminPayload = {
      adminId: admin.admin_id,
      username: admin.username,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
    };

    const token = jwt.sign(adminPayload, getJwtSecret(), { expiresIn: '24h' });

    return {
      token,
      admin: {
        ...adminPayload,
        lastLoginAt: admin.last_login_at,
      },
    };
  }

  /**
   * Logs out an administrator and records the event in the database.
   */
  async logout({ adminId, ipAddress = null, userAgent = null }) {
    if (adminId) {
      await activityService.log({
        adminId,
        action: 'AUTH_LOGOUT',
        details: { note: 'Administrator signed out' },
        ipAddress,
        userAgent,
        status: 'SUCCESS',
      });
    }
    return { ok: true };
  }

  /**
   * Retrieves current authenticated admin profile.
   */
  async getMe(adminId) {
    const sql = `
      SELECT admin_id, username, email, full_name, role, status, last_login_at, created_at
      FROM admins
      WHERE admin_id = $1 AND status = 1;
    `;
    const res = await query(sql, [adminId]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      adminId: row.admin_id,
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
    };
  }
}

module.exports = new AuthService();
