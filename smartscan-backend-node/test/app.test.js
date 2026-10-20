const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const request = require('supertest');

const { createApp } = require('../app');
const { hashPassword } = require('../password');

function createFakePool() {
  const state = {
    auth: [
      { id: 1, username: 'admin', password: hashPassword('admin'), role: 'admin' },
      { id: 2, username: 'manu', password: hashPassword('manu'), role: 'manufacturer' },
    ],
    profile: [],
    product: [],
  };

  return {
    state,
    async query(sql, params = []) {
      const s = sql.trim().toLowerCase();

      if (s.startsWith('select username, password, role from auth where username')) {
        return { rows: state.auth.filter((a) => a.username === params[0]) };
      }
      if (s.startsWith('update auth set password')) {
        const account = state.auth.find((a) => a.username === params[1]);
        if (account) account.password = params[0];
        return { rows: [] };
      }
      if (s.startsWith('select id, username, role from auth')) {
        return { rows: state.auth.map(({ id, username, role }) => ({ id, username, role })) };
      }
      if (s.startsWith('select 1 from auth where username')) {
        return { rows: state.auth.filter((a) => a.username === params[0]).map(() => ({ ok: 1 })) };
      }
      if (s.startsWith('insert into auth')) {
        state.auth.push({ id: state.auth.length + 1, username: params[0], password: params[1], role: params[2] });
        return { rows: [] };
      }
      if (s.startsWith('select * from profile where username')) {
        return { rows: state.profile.filter((p) => p.username === params[0]) };
      }
      if (s.startsWith('select * from profile')) {
        return { rows: state.profile };
      }
      if (s.startsWith('insert into profile')) {
        state.profile.push({
          username: params[0], name: params[1], description: params[2], website: params[3],
          location: params[4], image: params[5], role: params[6],
        });
        return { rows: [] };
      }
      if (s.startsWith('select serialnumber from product')) {
        return { rows: state.product.map((p) => ({ serialnumber: p.serialNumber })) };
      }
      if (s.startsWith('insert into product')) {
        state.product.push({ serialNumber: params[0], name: params[1], brand: params[2] });
        return { rows: [] };
      }
      if (s.startsWith('update product set chain_status')) {
        const product = state.product.find((p) => p.serialNumber === params[4]);
        if (!product) return { rows: [], rowCount: 0 };
        product.chainStatus = params[0];
        product.chainTxHash = params[1];
        product.chainId = params[2];
        product.failureReason = params[3];
        return { rows: [], rowCount: 1 };
      }
      if (s.startsWith('select serialnumber, name, brand, chain_status')) {
        const rows = state.product.filter((p) => !params[0] || p.chainStatus === params[0]);
        return { rows };
      }
      return { rows: [] };
    },
  };
}

function buildApp() {
  const uploadBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartscan-test-'));
  const pool = createFakePool();
  const app = createApp({ pool, jwtSecret: 'test-secret', allowedOrigins: ['http://localhost:3000'], uploadBaseDir });
  return { app, pool };
}

async function loginAs(app, username, password) {
  const res = await request(app).post('/auth').send({ username, password });
  assert.equal(res.status, 200);
  return res.body.token;
}

test('POST /auth requires username and password', async () => {
  const { app } = buildApp();
  const res = await request(app).post('/auth').send({ username: 'admin' });
  assert.equal(res.status, 400);
});

test('POST /auth rejects invalid credentials', async () => {
  const { app } = buildApp();
  const res = await request(app).post('/auth').send({ username: 'admin', password: 'wrong' });
  assert.equal(res.status, 401);
});

test('POST /auth returns a token for valid credentials', async () => {
  const { app } = buildApp();
  const res = await request(app).post('/auth').send({ username: 'admin', password: 'admin' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.role, 'admin');
});

test('legacy plaintext passwords are upgraded on login', async () => {
  const { app, pool } = buildApp();
  pool.state.auth[0].password = 'admin';
  const res = await request(app).post('/auth').send({ username: 'admin', password: 'admin' });
  assert.equal(res.status, 200);
  assert.ok(pool.state.auth[0].password.startsWith('scrypt$'));
});

test('GET /authAll requires authentication and never leaks passwords', async () => {
  const { app } = buildApp();
  const unauth = await request(app).get('/authAll');
  assert.equal(unauth.status, 401);

  const token = await loginAs(app, 'admin', 'admin');
  const res = await request(app).get('/authAll').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.every((row) => row.password === undefined));
});

test('non-admin cannot add accounts', async () => {
  const { app } = buildApp();
  const token = await loginAs(app, 'manu', 'manu');
  const res = await request(app).post('/addaccount').set('Authorization', `Bearer ${token}`)
    .send({ username: 'x', password: 'y', role: 'admin' });
  assert.equal(res.status, 403);
});

test('admin can add an account and duplicate usernames are rejected', async () => {
  const { app } = buildApp();
  const token = await loginAs(app, 'admin', 'admin');
  const first = await request(app).post('/addaccount').set('Authorization', `Bearer ${token}`)
    .send({ username: 'newuser', password: 'pw', role: 'supplier' });
  assert.equal(first.status, 200);
  assert.equal(first.body.success, 1);

  const dup = await request(app).post('/addaccount').set('Authorization', `Bearer ${token}`)
    .send({ username: 'newuser', password: 'pw', role: 'supplier' });
  assert.equal(dup.status, 409);
});

test('users cannot read other users profiles', async () => {
  const { app } = buildApp();
  const token = await loginAs(app, 'manu', 'manu');
  const res = await request(app).get('/profile/admin').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test('manufacturer can register a product', async () => {
  const { app } = buildApp();
  const token = await loginAs(app, 'manu', 'manu');
  const res = await request(app).post('/addproduct').set('Authorization', `Bearer ${token}`)
    .send({ serialNumber: 'SN-1', name: 'Bag', brand: 'Chanel' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, 1);
});

test('manufacturer can record confirmed and failed chain status', async () => {
  const { app, pool } = buildApp();
  const token = await loginAs(app, 'manu', 'manu');
  const created = await request(app).post('/addproduct').set('Authorization', `Bearer ${token}`)
    .send({ serialNumber: 'SN-CHAIN', name: 'Bag', brand: 'Chanel' });
  assert.equal(created.status, 200);

  const confirmed = await request(app).patch('/product/SN-CHAIN/chain-status')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'confirmed', txHash: '0xabc', chainId: '11155111' });
  assert.equal(confirmed.status, 200);
  assert.equal(pool.state.product[0].chainStatus, 'confirmed');

  const failed = await request(app).patch('/product/SN-CHAIN/chain-status')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'failed', failureReason: 'User rejected transaction' });
  assert.equal(failed.status, 200);
  assert.equal(pool.state.product[0].chainStatus, 'failed');
});

test('chain status rejects invalid values and unauthorized users', async () => {
  const { app } = buildApp();
  const token = await loginAs(app, 'manu', 'manu');
  const invalid = await request(app).patch('/product/unknown/chain-status')
    .set('Authorization', `Bearer ${token}`).send({ status: 'mined' });
  assert.equal(invalid.status, 400);
});

test('admin can monitor chain statuses', async () => {
  const { app } = buildApp();
  const token = await loginAs(app, 'admin', 'admin');
  const response = await request(app).get('/product/chain-status?status=pending_chain')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
});

test('profile query is parameterized (injection payload returns no rows)', async () => {
  const { app, pool } = buildApp();
  pool.state.profile.push({ username: 'admin', name: 'Admin' });
  const token = await loginAs(app, 'admin', 'admin');
  const payload = encodeURIComponent("x' OR '1'='1");
  const res = await request(app).get(`/profile/${payload}`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});
