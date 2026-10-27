const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_TIMER_DELAY_MS,
  MAX_WORKFLOW_TIMEOUT_MS,
  loadReconciliationWorkerSettings,
  loadScanRetentionWorkerSettings,
} = require('../worker-config');

test('worker configuration supplies safe defaults and accepts deliberate decimal integers', () => {
  assert.deepEqual(loadReconciliationWorkerSettings({}), {
    intervalMs: 60_000,
    hashlessTimeoutMs: 900_000,
    submittedTimeoutMs: 86_400_000,
    confirmations: 2,
  });
  assert.deepEqual(loadReconciliationWorkerSettings({
    RECONCILE_INTERVAL_MS: '30000',
    RECONCILE_HASHLESS_TIMEOUT_MS: '60000',
    RECONCILE_SUBMITTED_TIMEOUT_MS: '60000',
    RECONCILE_CONFIRMATIONS: '12',
  }), {
    intervalMs: 30_000,
    hashlessTimeoutMs: 60_000,
    submittedTimeoutMs: 60_000,
    confirmations: 12,
  });
  assert.deepEqual(loadScanRetentionWorkerSettings({}), {
    batchSize: 5_000,
    intervalMs: 86_400_000,
  });
});

test('reconciliation settings reject malformed, fractional, negative, and unsafe timeout values', () => {
  for (const value of ['abc', '1.5', '-1', '+2', '1e3', 'Infinity', '0', '59999', String(Number.MAX_SAFE_INTEGER + 1), String(MAX_WORKFLOW_TIMEOUT_MS + 1)]) {
    assert.throws(() => loadReconciliationWorkerSettings({ RECONCILE_HASHLESS_TIMEOUT_MS: value }), /RECONCILE_HASHLESS_TIMEOUT_MS/);
  }
  for (const value of ['0', '2.5', '-1', '100001']) {
    assert.throws(() => loadReconciliationWorkerSettings({ RECONCILE_CONFIRMATIONS: value }), /RECONCILE_CONFIRMATIONS/);
  }
});

test('worker timer settings reject values outside safe Node.js timer bounds', () => {
  for (const value of ['9999', '2147483648', '1.25', '-1']) {
    assert.throws(() => loadReconciliationWorkerSettings({ RECONCILE_INTERVAL_MS: value }), /RECONCILE_INTERVAL_MS/);
  }
  for (const value of ['59999', String(MAX_TIMER_DELAY_MS + 1), '2.5']) {
    assert.throws(() => loadScanRetentionWorkerSettings({ SCAN_RETENTION_INTERVAL_MS: value }), /SCAN_RETENTION_INTERVAL_MS/);
  }
  for (const value of ['0', '50001', '1.2']) {
    assert.throws(() => loadScanRetentionWorkerSettings({ SCAN_RETENTION_BATCH_SIZE: value }), /SCAN_RETENTION_BATCH_SIZE/);
  }
});
