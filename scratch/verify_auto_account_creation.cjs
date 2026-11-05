const assert = require('assert');
const path = require('path');
const request = require(path.resolve('smartscan-backend-node/node_modules/supertest'));
const { ethers } = require(path.resolve('smartscan-backend-node/node_modules/ethers'));

// Load backend app directly
const { createApp } = require(path.resolve('smartscan-backend-node/app.js'));

async function testAutoAccountProvisioning() {
  const state = {
    auth: [
      { id: 1, username: 'admin', password: 'admin-password', role: 'admin', token_version: 0 }
    ],
    profile: [],
    subaccounts: [],
    events: [],
  };

  const pool = {
    state,
    async query(sql, params) {
      const s = String(sql).trim().toLowerCase();
      if (s.startsWith('select token_version from auth where username')) {
        const u = state.auth.find(a => a.username === params[0]);
        return { rows: u ? [{ token_version: u.token_version }] : [] };
      }
      if (s.startsWith('select 1 from auth where username')) {
        return { rows: state.auth.filter(a => a.username === params[0]) };
      }
      if (s.startsWith('insert into auth')) {
        state.auth.push({
          id: state.auth.length + 1,
          username: params[0],
          password: params[1],
          role: params[2],
          wallet_address: params[3] || null,
          wallet_status: params[4] || 'unlinked',
          token_version: 0,
        });
        return { rows: [] };
      }
      if (s.startsWith('insert into profile')) {
        state.profile.push({ username: params[0], name: params[1], role: params[6] });
        return { rows: [] };
      }
      if (s.startsWith('insert into facility_subaccounts')) {
        state.subaccounts.push({
          parent_username: params[0],
          subaccount_name: params[1],
          facility_code: params[2],
          role: params[3],
          wallet_address: params[4],
          status: 'active',
        });
        return { rows: [{ id: state.subaccounts.length }], rowCount: 1 };
      }
      if (s.startsWith('insert into wallet_account_events')) {
        state.events.push({ username: params[0], wallet: params[1], event: params[2] });
        return { rows: [{ id: 1 }], rowCount: 1 };
      }
      return { rows: [] };
    },
    async connect() {
      return {
        query: (sql, params) => pool.query(sql, params),
        release() {},
      };
    }
  };

  const jwtSecret = 'test-secret-at-least-32-chars-long!';
  const app = createApp({
    pool,
    jwtSecret,
    allowedOrigins: ['*'],
  });

  // Generate an admin token
  const jwt = require(path.resolve('smartscan-backend-node/node_modules/jsonwebtoken'));
  const token = jwt.sign({ username: 'admin', role: 'admin', tokenVersion: 0 }, jwtSecret);

  console.log('--- Testing POST /addaccount auto-wallet generation ---');
  const res = await request(app)
    .post('/addaccount')
    .set('Authorization', `Bearer ${token}`)
    .send({
      username: 'apex-logistics',
      password: 'Enterprise-Password-2026!',
      role: 'supplier',
      name: 'Apex Global Logistics Corp',
      description: 'Primary European supply distribution hub',
    });

  console.log('Response Status:', res.status);
  console.log('Response Body:', res.body);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, 1);
  assert.equal(typeof res.body.walletAddress, 'string');
  assert.ok(ethers.isAddress(res.body.walletAddress), 'Wallet address must be a valid EVM address');
  assert.equal(res.body.walletStatus, 'active');

  // Verify state
  const account = state.auth.find(a => a.username === 'apex-logistics');
  assert.ok(account, 'Account must exist in auth');
  assert.equal(account.wallet_address, res.body.walletAddress);
  assert.equal(account.wallet_status, 'active');

  const sub = state.subaccounts.find(s => s.parent_username === 'apex-logistics');
  assert.ok(sub, 'Facility subaccount must exist');
  assert.equal(sub.wallet_address, res.body.walletAddress);
  assert.equal(sub.role, 'supplier');

  console.log('\n✅ ALL ASSERTIONS PASSED! Automated wallet address was created and linked:', res.body.walletAddress);
}

testAutoAccountProvisioning().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
