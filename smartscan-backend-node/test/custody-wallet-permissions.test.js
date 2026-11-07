const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../app');

const serial = 'SS-00000000-0000-4000-8000-000000000001';
const jwtSecret = 'isolated-wallet-permission-tests';
function setup(facility) {
  const queries = [];
  const pool = { async query(sql, params) {
    queries.push({ sql, params });
    if (sql.startsWith('SELECT token_version')) return { rows: [{ token_version: 0 }] };
    if (sql.startsWith('SELECT * FROM facility_subaccounts')) {
      assert.match(sql, /LOWER\(parent_username\) = LOWER\(\$2\)/);
      assert.deepEqual(params, [42, 'supplier']);
      return { rows: facility ? [facility] : [] };
    }
    throw new Error('Unexpected database write or query');
  } };
  const app = createApp({ pool, jwtSecret, rpcUrl: '', contractAddress: '', logger: { error() {} } });
  const token = jwt.sign({ username: 'supplier', role: 'supplier', tokenVersion: 0 }, jwtSecret);
  const execute = () => request(app).post('/api/custody/auto-execute')
    .set('Authorization', `Bearer ${token}`)
    .send({ serialNumber: serial, action: 'dispatch', subaccountId: 42 });
  return { execute, queries };
}

for (const status of ['pending_approval', 'suspended', 'revoked']) {
  test(`automatic signing cannot reactivate a ${status} wallet`, async () => {
    const t = setup({ id: 42, role: 'supplier', status });
    const response = await t.execute();
    assert.equal(response.status, 403);
    assert.match(response.body.error, /not active/);
    assert.equal(t.queries.length, 2); // No role grant, gas top-up, or private-key access.
  });
}
test('automatic signing rejects a facility role that differs from the business account', async () => {
  const response = await setup({ id: 42, role: 'manufacturer', status: 'active' }).execute();
  assert.equal(response.status, 403);
  assert.match(response.body.error, /role does not match/);
});
test('a business cannot select another business wallet by ID', async () => {
  const response = await setup(null).execute();
  assert.equal(response.status, 400);
});

test('already-approved wallet responses never expose encrypted wallet material', async () => {
  const pool = { async query(sql) {
    if (sql.startsWith('SELECT token_version')) return { rows: [{ token_version: 0 }] };
    return { rows: [{ id: 42, role: 'manufacturer', status: 'active', wallet_address: '0x1111111111111111111111111111111111111111',
      encrypted_private_key: 'secret-ciphertext', key_iv: 'secret-iv', key_auth_tag: 'secret-tag' }] };
  } };
  const app = createApp({ pool, jwtSecret, rpcUrl: '', contractAddress: '' });
  const token = jwt.sign({ username: 'admin', role: 'admin', tokenVersion: 0 }, jwtSecret);
  const response = await request(app).post('/api/subaccounts/42/approve').set('Authorization', `Bearer ${token}`).send({});
  assert.equal(response.status, 200);
  assert.equal(response.body.subaccountId, 42);
  assert.doesNotMatch(JSON.stringify(response.body), /secret|encrypted|key_iv|auth_tag/);
});
