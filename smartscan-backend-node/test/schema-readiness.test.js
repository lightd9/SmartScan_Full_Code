const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { latestMigrationName, assertLatestMigration } = require('../schema-readiness');

test('readiness requires the latest migration shipped with this code', async () => {
  const required = latestMigrationName(path.join(__dirname, '..', 'migrations'));
  assert.match(required, /^\d+_[a-z0-9_-]+\.sql$/i);
  let query;
  await assertLatestMigration({ async query(...args) { query = args; return { rows: [{ '?column?': 1 }] }; } }, required);
  assert.match(query[0], /schema_migrations/);
  assert.deepEqual(query[1], [required]);
});

test('readiness rejects a database missing the latest migration', async () => {
  await assert.rejects(
    assertLatestMigration({ async query() { return { rows: [] }; } }, '010_legacy_product_identity_rekeys.sql'),
    /Required database migration is not applied/,
  );
});
