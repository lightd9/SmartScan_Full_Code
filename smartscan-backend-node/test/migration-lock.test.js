const test = require('node:test');
const assert = require('node:assert/strict');
const { MIGRATION_LOCK_KEY, runMigrations } = require('../migrate');

test('migration runner refuses a concurrent migration and releases its client', async () => {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{ locked: false }] };
    },
    release() { released = true; },
  };
  const pool = { async connect() { return client; } };

  await assert.rejects(runMigrations(pool), /Another migration process is already running/);
  assert.equal(released, true);
  assert.deepEqual(calls[0], {
    sql: 'SELECT pg_try_advisory_lock($1) AS locked',
    params: [MIGRATION_LOCK_KEY],
  });
});
