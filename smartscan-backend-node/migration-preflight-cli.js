require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createPool } = require('./db');
const { runMigrationPreflight } = require('./migration-preflight');

async function main() {
  const pool = createPool();
  try {
    await runMigrationPreflight(pool);
    const availableMigrations = fs.readdirSync(path.join(__dirname, 'migrations')).filter((file) => file.endsWith('.sql')).sort();
    const tracking = await pool.query(`SELECT to_regclass('schema_migrations') AS table_name`);
    let appliedMigrations = [];
    if (tracking.rows[0].table_name) {
      const migrations = await pool.query(`SELECT filename FROM schema_migrations ORDER BY filename`);
      appliedMigrations = migrations.rows.map((row) => row.filename);
    }
    const appliedSet = new Set(appliedMigrations);
    const pendingMigrations = availableMigrations.filter((file) => !appliedSet.has(file));
    console.log(`Applied migrations: ${appliedMigrations.join(', ') || 'none'}`);
    console.log(`Pending migrations: ${pendingMigrations.join(', ') || 'none'}`);
    const scanRetentionIndex = await pool.query(`SELECT to_regclass('public.product_scans_retention_idx') AS index_name`);
    console.log(`Scan-retention batching index: ${scanRetentionIndex.rows[0].index_name ? 'available' : 'missing (required before starting scan-retention worker)'}`);
    const attemptsTable = await pool.query(`SELECT to_regclass('product_chain_attempts') AS table_name`);
    if (attemptsTable.rows[0].table_name) {
      const attempts = await pool.query(`SELECT status, count(*)::int AS count FROM product_chain_attempts GROUP BY status ORDER BY status`);
      console.log(`Product chain attempts: ${attempts.rows.map((row) => `${row.status}=${row.count}`).join(', ') || 'none'}`);
    }
    const roleAudit = await pool.query(`SELECT to_regclass('contract_role_audit') AS table_name`);
    console.log(`Contract role audit storage: ${roleAudit.rows[0].table_name ? 'available' : 'missing'}`);
    const statusDefault = await pool.query(`SELECT column_default FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'product' AND column_name = 'chain_status'`);
    if (statusDefault.rows[0]) console.log(`New product chain-status default: ${statusDefault.rows[0].column_default}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
