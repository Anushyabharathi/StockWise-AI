const { query } = require('../db/pool');

/**
 * Enterprise Activity & Audit Logging Service.
 * Persists all critical shop admin actions, security events, and reports in PostgreSQL.
 */
class ActivityService {
  /**
   * Logs an activity or security event into the activity_logs table.
   *
   * @param {Object} params
   * @param {number|null} [params.adminId]
   * @param {string} params.action - e.g., 'AUTH_LOGIN_SUCCESS', 'SALES_CSV_EXPORT'
   * @param {Object} [params.details={}] - Contextual metadata
   * @param {string|null} [params.ipAddress]
   * @param {string|null} [params.userAgent]
   * @param {'SUCCESS'|'FAILURE'|'WARNING'} [params.status='SUCCESS']
   */
  async log({
    adminId = null,
    action,
    details = {},
    ipAddress = null,
    userAgent = null,
    status = 'SUCCESS',
  }) {
    try {
      const sql = `
        INSERT INTO activity_logs (admin_id, action, details, ip_address, user_agent, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING log_id, created_at;
      `;
      const res = await query(sql, [
        adminId,
        action,
        JSON.stringify(details),
        ipAddress,
        userAgent ? userAgent.slice(0, 500) : null,
        status,
      ]);
      return res.rows[0];
    } catch (err) {
      // Don't let an audit log failure crash the primary business operation, but report it
      console.error('[ActivityService Error] Failed to record activity log:', err.message);
      return null;
    }
  }

  /**
   * Retrieves paginated audit activity logs.
   *
   * @param {Object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @param {string|null} [options.action]
   * @param {number|null} [options.adminId]
   * @param {string|null} [options.startDate]
   * @param {string|null} [options.endDate]
   */
  async getLogs({
    page = 1,
    limit = 20,
    action = null,
    adminId = null,
    startDate = null,
    endDate = null,
  } = {}) {
    const offset = (page - 1) * limit;
    const whereConditions = [];
    const params = [];

    if (action) {
      params.push(`%${action}%`);
      whereConditions.push(`al.action ILIKE $${params.length}`);
    }

    if (adminId) {
      params.push(adminId);
      whereConditions.push(`al.admin_id = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      whereConditions.push(`al.created_at >= $${params.length}::TIMESTAMPTZ`);
    }

    if (endDate) {
      params.push(endDate);
      whereConditions.push(`al.created_at <= $${params.length}::TIMESTAMPTZ`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*)::BIGINT AS total_records
      FROM activity_logs al
      ${whereClause};
    `;

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const dataSql = `
      SELECT
        al.log_id,
        al.admin_id,
        COALESCE(a.username, 'System / Anonymous') AS username,
        COALESCE(a.full_name, 'System') AS full_name,
        COALESCE(a.role, 'system') AS role,
        al.action,
        al.details,
        al.ip_address,
        al.user_agent,
        al.status,
        al.created_at
      FROM activity_logs al
      LEFT JOIN admins a ON a.admin_id = al.admin_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam};
    `;

    const [countRes, dataRes] = await Promise.all([
      query(countSql, params.slice(0, params.length - 2)),
      query(dataSql, params),
    ]);

    const totalRecords = parseInt(countRes.rows[0]?.total_records || '0', 10);
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return {
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
      data: dataRes.rows.map((r) => ({
        logId: r.log_id,
        adminId: r.admin_id,
        username: r.username,
        fullName: r.full_name,
        role: r.role,
        action: r.action,
        details: r.details,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        status: r.status,
        createdAt: r.created_at,
      })),
    };
  }
}

module.exports = new ActivityService();
