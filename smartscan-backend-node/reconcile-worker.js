require('dotenv').config();

const { ethers } = require('ethers');
const { createPool } = require('./db');
const { reconcile } = require('./reconcile');
const { loadRuntimeConfig } = require('./runtime-config');
const { waitForInterval } = require('./worker-timer');
const { assertLatestMigration } = require('./schema-readiness');
const { loadReconciliationWorkerSettings } = require('./worker-config');

const LOCK_CLASS = 7100;
const LOCK_ID = 1;

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

async function main() {
  const config = loadRuntimeConfig();
  if (!config.databaseUrl || !config.rpcUrl || !config.contractAddress || !config.contractDeploymentBlock) {
    throw new Error('DATABASE_URL, a chain RPC, CONTRACT_ADDRESS, and CONTRACT_DEPLOYMENT_BLOCK are required');
  }
  const workerSettings = loadReconciliationWorkerSettings();
  const { intervalMs } = workerSettings;

  const pool = createPool(config.databaseUrl);
  let lockClient;
  let provider;
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    await assertLatestMigration(pool);
    lockClient = await acquireLock(pool);
    if (!lockClient) {
      console.log('Another reconciliation worker holds the database lock; this worker will exit.');
      return;
    }
    console.log(`Reconciliation worker started (interval ${intervalMs} ms)`);
    provider = new ethers.JsonRpcProvider(config.rpcUrl);
    while (!shutdown.signal.aborted) {
      try {
        await reconcile({
          pool,
          provider,
          contractAddress: config.contractAddress,
          expectedChainId: Number(config.chainId),
          deploymentBlock: config.contractDeploymentBlock,
          hashlessTimeoutMs: workerSettings.hashlessTimeoutMs,
          submittedTimeoutMs: workerSettings.submittedTimeoutMs,
          confirmations: workerSettings.confirmations,
        });
      } catch (error) {
        console.error('Reconciliation pass failed:', error.message);
      }
      if (!shutdown.signal.aborted) await waitForInterval(intervalMs, shutdown.signal);
    }
  } finally {
    if (lockClient) {
      try { await lockClient.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_CLASS, LOCK_ID]); } catch (_error) { /* connection close releases it */ }
      lockClient.release();
    }
    provider?.destroy();
    await pool.end();
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { acquireLock, LOCK_CLASS, LOCK_ID };
