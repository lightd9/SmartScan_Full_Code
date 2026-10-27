const test = require('node:test');
const assert = require('node:assert/strict');
const { acquireLock, LOCK_CLASS, LOCK_ID } = require('../reconcile-worker');

test('reconciliation worker keeps its database session while holding the advisory lock', async () => {
  let released = false;
  let query;
  const client = { query: async (...args) => { query = args; return { rows: [{ locked: true }] }; }, release: () => { released = true; } };
  const lock = await acquireLock({ connect: async () => client });
  assert.equal(lock, client);
  assert.equal(released, false);
  assert.match(query[0], /pg_try_advisory_lock/);
  assert.deepEqual(query[1], [LOCK_CLASS, LOCK_ID]);
});

test('duplicate reconciliation worker releases its connection when another worker owns the lock', async () => {
  let released = false;
  const client = { query: async () => ({ rows: [{ locked: false }] }), release: () => { released = true; } };
  const lock = await acquireLock({ connect: async () => client });
  assert.equal(lock, null);
  assert.equal(released, true);
});

test('reconciliation worker releases its connection if lock acquisition errors', async () => {
  let released = false;
  const client = { query: async () => { throw new Error('database unavailable'); }, release: () => { released = true; } };
  await assert.rejects(() => acquireLock({ connect: async () => client }), /database unavailable/);
  assert.equal(released, true);
});
