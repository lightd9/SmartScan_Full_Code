const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
const { recordObservation } = require('../scan-observation');

const connectionString = process.env.SMARTSCAN_TEST_DATABASE_URL;
test('PostgreSQL scan migration, concurrent retries, rollback and contract isolation', { skip: !connectionString }, async () => {
  const target = new URL(connectionString);
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname), 'Use an isolated local test database');
  const schema = `assessment_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}`, max: 12 });
  try {
    for (const file of ['002_scan_monitoring.sql', '006_scan_location_source.sql', '014_scan_idempotency.sql']) {
      await pool.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', file), 'utf8'));
    }
    // Additive migration can safely be applied again.
    await pool.query(fs.readFileSync(path.join(__dirname, '..', 'migrations', '014_scan_idempotency.sql'), 'utf8'));
    const input = { eventId: randomUUID(), serialNumber: 'SS-test', contractAddress: '0x0000000000000000000000000000000000000011', visitorHash: 'a'.repeat(64), outcome: 'valid', purpose: 'consumer', latitude: 6.5, longitude: 3.3 };
    const retries = await Promise.all(Array.from({ length: 10 }, () => recordObservation(pool, input)));
    assert.equal(retries.filter(r => !r.replayed).length, 1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM product_scans')).rows[0].n, 1);
    await assert.rejects(recordObservation(pool, { ...input, longitude: 4 }), error => error.status === 409);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM product_scans')).rows[0].n, 1);
    const observations = await Promise.all(Array.from({ length: 9 }, () => recordObservation(pool, { ...input, eventId: randomUUID() })));
    assert.equal(observations.filter(r => r.flags.includes('unusual_frequency')).length, 1);
    const otherContract = await recordObservation(pool, { ...input, eventId: randomUUID(), contractAddress: '0x0000000000000000000000000000000000000022', latitude: 51.5, longitude: 0 });
    assert.deepEqual(otherContract.flags, []);
    const distant = await recordObservation(pool, { ...input, eventId: randomUUID(), latitude: 51.5, longitude: 0 });
    assert.ok(distant.flags.includes('suspicious_location'));
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
