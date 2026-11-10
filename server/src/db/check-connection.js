require('dotenv').config();
const { checkConnection } = require('./pool');

async function run() {
  console.log('[StockWise AI] Testing database connectivity...');
  const result = await checkConnection();

  if (result.ok) {
    console.log('✅ SUCCESS:', result.message);
    console.log('   Database:', result.database);
    console.log('   Database Server Time:', result.timestamp);
    process.exit(0);
  } else {
    console.error('❌ FAILED:', result.message);
    console.error('\nPlease verify your server/.env settings:');
    console.error('- DB_HOST');
    console.error('- DB_PORT');
    console.error('- DB_NAME');
    console.error('- DB_USER');
    console.error('- DB_PASSWORD');
    process.exit(1);
  }
}

run();
