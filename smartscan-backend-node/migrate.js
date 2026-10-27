require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createPool } = require('./db');
const { runMigrationPreflight } = require('./migration-preflight');

// A session-level advisory lock prevents two release processes from applying
// the same migration concurrently. The key is intentionally stable and is
// unrelated to application/user data.
const MIGRATION_LOCK_KEY = 824638417;

async function runMigrations(pool, { log = console.log } = {}) {
  const client = await pool.connect();
  let lockHeld = false;
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [MIGRATION_LOCK_KEY]);
    if (!lock.rows[0]?.locked) {
      throw new Error('Another migration process is already running; aborting this migration attempt');
    }
    lockHeld = true;

    await runMigrationPreflight(client);
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename varchar(255) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const files = fs.readdirSync(path.join(__dirname, 'migrations'))
      .filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (applied.rowCount > 0) continue;
      log(`Applying ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try {
      if (lockHeld) {
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  }
}

async function main() {
  const pool = createPool();
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { MIGRATION_LOCK_KEY, runMigrations };
