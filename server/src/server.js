require('dotenv').config();
const app = require('./app');
const { checkConnection } = require('./db/pool');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  console.log('====================================================');
  console.log(`🚀 StockWise AI Backend running at http://localhost:${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   Dashboard Summary: http://localhost:${PORT}/api/dashboard/summary`);
  console.log('====================================================');

  // Verify database connectivity on startup
  const dbStatus = await checkConnection();
  if (dbStatus.ok) {
    console.log(`✅ [Database] ${dbStatus.message} (Database: ${dbStatus.database})`);
    try {
      const { initMonitorSchema } = require('./db/init-monitor');
      await initMonitorSchema();
    } catch (schemaErr) {
      console.warn('⚠️  [Database Warning] Monitor schema check:', schemaErr.message);
    }
  } else {
    console.warn(`⚠️  [Database Warning] ${dbStatus.message}`);
    console.warn(`   Ensure DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD are set in server/.env`);
  }
});

// Graceful shutdown handling
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = server;
