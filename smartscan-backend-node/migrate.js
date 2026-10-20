require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createPool } = require('./db');

async function main() {
  const pool = createPool();
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename varchar(255) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const files = fs.readdirSync(path.join(__dirname, 'migrations'))
      .filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (applied.rowCount > 0) continue;
      console.log(`Applying ${file}`);
      await pool.query('BEGIN');
      try {
        await pool.query(fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8'));
        await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await pool.query('COMMIT');
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
