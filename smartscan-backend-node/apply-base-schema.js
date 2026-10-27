require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createPool } = require('./db');

async function main() {
  const pool = createPool();
  try {
    const schemaPath = path.join(__dirname, '..', 'smartscan-postgres-database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Base schema file not found at ${schemaPath}`);
    }
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('Base schema applied successfully: auth, profile, and product tables created.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed to apply base schema:', err.message);
  process.exitCode = 1;
});
