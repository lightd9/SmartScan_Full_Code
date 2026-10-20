const { Pool } = require('pg');

function createPool(connectionString = process.env.DATABASE_URL) {
  const sslDisabled = ['1', 'true', 'yes'].includes(
    String(process.env.PGSSL_DISABLE).toLowerCase()
  );
  return new Pool({
    connectionString,
    ssl: sslDisabled ? false : { require: true, rejectUnauthorized: false },
  });
}

module.exports = { createPool };
