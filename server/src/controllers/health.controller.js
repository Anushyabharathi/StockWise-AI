const { checkConnection } = require('../db/pool');

/**
 * Health check controller.
 * Checks server health and database connectivity without exposing any secrets.
 */
async function getHealth(req, res, next) {
  try {
    const dbStatus = await checkConnection();
    const isDegraded = !dbStatus.ok;

    const response = {
      status: isDegraded ? 'degraded' : 'ok',
      service: 'stockwise-ai-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: dbStatus.ok,
        message: dbStatus.message,
        ...(dbStatus.database ? { databaseName: dbStatus.database } : {}),
      },
    };

    // Return 200 even when degraded, so monitoring tools get structured status
    res.status(isDegraded ? 503 : 200).json(response);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHealth,
};
