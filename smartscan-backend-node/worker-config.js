const MAX_TIMER_DELAY_MS = 2_147_483_647;
const MAX_WORKFLOW_TIMEOUT_MS = 365 * 24 * 60 * 60 * 1000;

function readIntegerSetting(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const value = String(raw).trim();
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${name} must be a whole, non-negative decimal integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

function loadReconciliationWorkerSettings(env = process.env) {
  return {
    intervalMs: readIntegerSetting(env, 'RECONCILE_INTERVAL_MS', 60_000, 10_000, MAX_TIMER_DELAY_MS),
    hashlessTimeoutMs: readIntegerSetting(env, 'RECONCILE_HASHLESS_TIMEOUT_MS', 15 * 60 * 1000, 60_000, MAX_WORKFLOW_TIMEOUT_MS),
    submittedTimeoutMs: readIntegerSetting(env, 'RECONCILE_SUBMITTED_TIMEOUT_MS', 24 * 60 * 60 * 1000, 60_000, MAX_WORKFLOW_TIMEOUT_MS),
    confirmations: readIntegerSetting(env, 'RECONCILE_CONFIRMATIONS', 2, 1, 100_000),
  };
}

function loadScanRetentionWorkerSettings(env = process.env) {
  return {
    batchSize: readIntegerSetting(env, 'SCAN_RETENTION_BATCH_SIZE', 5_000, 1, 50_000),
    intervalMs: readIntegerSetting(env, 'SCAN_RETENTION_INTERVAL_MS', 24 * 60 * 60 * 1000, 60_000, MAX_TIMER_DELAY_MS),
  };
}

module.exports = {
  MAX_TIMER_DELAY_MS,
  MAX_WORKFLOW_TIMEOUT_MS,
  loadReconciliationWorkerSettings,
  loadScanRetentionWorkerSettings,
};
