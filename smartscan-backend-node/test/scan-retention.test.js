const test = require('node:test');
const assert = require('node:assert/strict');
const { DELETE_EXPIRED_SCAN_BATCH, deleteExpiredScans } = require('../scan-retention');
const { acquireLock, assertRetentionMigration, LOCK_CLASS, LOCK_ID } = require('../scan-retention-worker');

test('expired scan deletion is ordered and bounded to small locked batches', async () => {
  const batches = [2, 2, 1];
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rowCount: batches.shift() };
    },
  };
  assert.equal(await deleteExpiredScans(pool, 120, 2), 5);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.values[0] === 120 && call.values[1] === 2));
  assert.match(DELETE_EXPIRED_SCAN_BATCH, /ORDER BY scanned_at, id/);
  assert.match(DELETE_EXPIRED_SCAN_BATCH, /LIMIT \$2\s+FOR UPDATE SKIP LOCKED/);
  assert.match(DELETE_EXPIRED_SCAN_BATCH, /scanned_at < now\(\) - \(\$1::integer \* interval '1 day'\)/);
});

test('retention worker retains an exclusive DB advisory lock during its work', async () => {
  const calls = [];
  const client = {
    async query(sql, params) { calls.push({ sql, params }); return { rows: [{ locked: true }] }; },
    release() { calls.push({ released: true }); },
  };
  const pool = { async connect() { return client; } };
  assert.equal(await acquireLock(pool), client);
  assert.deepEqual(calls[0].params, [LOCK_CLASS, LOCK_ID]);
  assert.equal(calls.some((call) => call.released), false);
});

test('retention worker refuses to start until migration 007 created its batching index', async () => {
  await assertRetentionMigration({ async query() { return { rows: [{ index_name: 'product_scans_retention_idx' }] }; } });
  await assert.rejects(
    assertRetentionMigration({ async query() { return { rows: [{ index_name: null }] }; } }),
    /Apply migration 007_scan_retention_index/,
  );
});

test('duplicate retention worker releases its connection without entering the critical section', async () => {
  let released = false;
  const pool = { async connect() { return {
    async query() { return { rows: [{ locked: false }] }; },
    release() { released = true; },
  }; } };
  assert.equal(await acquireLock(pool), null);
  assert.equal(released, true);
});

test('scan retention refuses missing, fractional, and unbounded values', async () => {
  const pool = { async query() { throw new Error('should not query'); } };
  await assert.rejects(deleteExpiredScans(pool, 0), /SCAN_RETENTION_DAYS/);
  await assert.rejects(deleteExpiredScans(pool, 2.5), /SCAN_RETENTION_DAYS/);
  await assert.rejects(deleteExpiredScans(pool, 10, 0), /SCAN_RETENTION_BATCH_SIZE/);
});
