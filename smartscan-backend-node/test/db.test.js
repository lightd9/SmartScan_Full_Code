const test = require('node:test');
const assert = require('node:assert/strict');
const { createPool, isLoopbackDatabaseUrl } = require('../db');
const ConnectionParameters = require('pg/lib/connection-parameters');

const productionUrl = 'postgresql://app:secret@db.example.com:5432/smartscan';
const localUrl = 'postgresql://app:secret@127.0.0.1:5432/smartscan';

test('production pool always enables TLS and certificate verification', async () => {
  const pool = createPool(productionUrl, { NODE_ENV: 'production' });
  try {
    assert.deepEqual(pool.options.ssl, { require: true, rejectUnauthorized: true });
  } finally {
    await pool.end();
  }
});

test('production pool refuses URL and environment settings that disable TLS verification', () => {
  assert.throws(
    () => createPool(`${productionUrl}?sslmode=disable`, { NODE_ENV: 'production' }),
    /DATABASE_URL must not contain SSL query parameters/,
  );
  assert.throws(
    () => createPool(productionUrl, { NODE_ENV: 'production', PGSSL_DISABLE: 'true' }),
    /PGSSL_DISABLE cannot be enabled/,
  );
  assert.throws(
    () => createPool(productionUrl, { NODE_ENV: 'production', PGSSL_REJECT_UNAUTHORIZED: 'false' }),
    /PGSSL_REJECT_UNAUTHORIZED cannot be disabled/,
  );
});

test('non-local database targets keep TLS verification even when a CLI omits NODE_ENV', async () => {
  assert.equal(isLoopbackDatabaseUrl(localUrl), true);
  assert.equal(isLoopbackDatabaseUrl(productionUrl), false);
  const pool = createPool(productionUrl, {});
  try {
    const connection = new ConnectionParameters({ connectionString: productionUrl, ssl: pool.options.ssl });
    assert.deepEqual(connection.ssl, { require: true, rejectUnauthorized: true });
  } finally {
    await pool.end();
  }
  assert.throws(() => createPool(`${productionUrl}?sslmode=disable`, {}), /DATABASE_URL must not contain SSL query parameters/);
  assert.throws(() => createPool(productionUrl, { PGSSL_DISABLE: 'true' }), /PGSSL_DISABLE cannot be enabled/);
});

test('local development can still use an explicit local SSL override', async () => {
  const databaseUrl = `${localUrl}?sslmode=disable`;
  const pool = createPool(databaseUrl, { NODE_ENV: 'development' });
  try {
    const connection = new ConnectionParameters({ connectionString: databaseUrl, ssl: pool.options.ssl });
    assert.equal(connection.ssl, false);
  } finally {
    await pool.end();
  }
});
