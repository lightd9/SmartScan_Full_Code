require('dotenv').config();

const { createPool } = require('./db');
const { loadRuntimeConfig } = require('./runtime-config');
const { deleteExpiredScans } = require('./scan-retention');
const { waitForInterval } = require('./worker-timer');
const { assertLatestMigration } = require('./schema-readiness');
const { loadScanRetentionWorkerSettings } = require('./worker-config');

const LOCK_CLASS = 7100;
const LOCK_ID = 2;

async function acquireLock(pool) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT pg_try_advisory_lock($1, $2) AS locked', [LOCK_CLASS, LOCK_ID]);
    if (!result.rows[0]?.locked) {
      client.release();
      return null;
    }
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

async function assertRetentionMigration(pool) {
  const result = await pool.query("SELECT to_regclass('public.product_scans_retention_idx') AS index_name");
  if (!result.rows[0]?.index_name) throw new Error('Apply migration 007_scan_retention_index.sql before starting the scan-retention worker');
}

async function main() {
  const config = loadRuntimeConfig();
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required to run scan retention');
  if (!config.scanRetentionDays) throw new Error('Set SCAN_RETENTION_DAYS to the approved data-retention policy before running this worker');
  const workerSettings = loadScanRetentionWorkerSettings();
  const { batchSize, intervalMs } = workerSettings;

  const pool = createPool(config.databaseUrl);
  let lockClient;
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    await assertLatestMigration(pool);
    await assertRetentionMigration(pool);
    lockClient = await acquireLock(pool);
    if (!lockClient) {
      console.log('Another scan-retention worker holds the database lock; this worker will exit.');
      return;
    }
    console.log(`Scan-retention worker started (retention ${config.scanRetentionDays} days, interval ${intervalMs} ms)`);
    while (!shutdown.signal.aborted) {
      try {
        const deleted = await deleteExpiredScans(pool, config.scanRetentionDays, batchSize);
        console.log(`Scan-retention pass completed; deleted ${deleted} expired scan rows`);
      } catch (error) {
        console.error('Scan-retention pass failed:', error.message);
      }
      if (!shutdown.signal.aborted) await waitForInterval(intervalMs, shutdown.signal);
    }
  } finally {
    if (lockClient) {
      try { await lockClient.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_CLASS, LOCK_ID]); } catch (_error) { /* connection close releases it */ }
      lockClient.release();
    }
    await pool.end();
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { acquireLock, assertRetentionMigration, LOCK_CLASS, LOCK_ID };
