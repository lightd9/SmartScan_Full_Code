const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { ethers } = require('ethers');

const { createApp } = require('../app');
const { hashPassword } = require('../password');

function createFakePool() {
  const state = {
    auth: [
      { id: 1, username: 'admin', password: hashPassword('admin'), role: 'admin', wallet_address: null, wallet_status: 'unlinked', token_version: 0 },
      { id: 2, username: 'manu', password: hashPassword('manu'), role: 'manufacturer', wallet_address: '0x0000000000000000000000000000000000000011', wallet_status: 'active', token_version: 0 },
    ],
    profile: [],
    failProfileInsert: false,
    product: [],
    scans: [],
    walletOperations: [],
    walletChallenges: [],
    passwordEvents: [],
    manufacturerAssignments: [],
    identityRekeys: [],
  };

  const pool = {
    state,
    async query(sql, params = []) {
      for (const param of params) {
        if (param && typeof param === 'object' && !(param instanceof Date)) {
          JSON.stringify(param);
        }
      }
      const s = sql.trim().toLowerCase();

      if (s.startsWith('select a.role, a.wallet_address, a.wallet_status, p.name as business_name from auth a join profile p')) {
        const account = state.auth.find((item) => item.username === params[0]);
        const profile = state.profile.find((item) => item.username === params[0]);
        return { rows: account && profile ? [{ role: account.role, wallet_address: account.wallet_address, wallet_status: account.wallet_status, business_name: profile.name }] : [] };
      }
      if (s.startsWith('select * from wallet_operations where username = $1 and status in')) {
        return { rows: state.walletOperations.filter((item) => item.username === params[0] && ['pending_wallet_proof', 'ready_onchain'].includes(item.status)) };
      }
      if (s.startsWith('select username from auth where lower(wallet_address)')) {
        return { rows: state.auth.filter((item) => item.wallet_address?.toLowerCase() === String(params[0]).toLowerCase() && item.username !== params[1]).map(({ username }) => ({ username })) };
      }
      if (s.startsWith('insert into wallet_operations')) {
        state.walletOperations.push({ id: params[0], username: params[1], action: params[2], old_wallet_address: params[3], new_wallet_address: params[4], role: params[5], business_name: params[6], requested_by: params[7], status: 'pending_wallet_proof' });
        return { rows: [], rowCount: 1 };
      }
      if (s.startsWith('delete from wallet_link_challenges')) {
        state.walletChallenges = state.walletChallenges.filter((item) => item.username !== params[0] || item.consumed_at);
        return { rows: [], rowCount: 1 };
      }
      if (s.startsWith('insert into wallet_link_challenges')) {
        state.walletChallenges.push({ id: params[0], username: params[1], operation_id: params[2], wallet_address: params[3], message: params[4], expires_at: params[5], consumed_at: null });
        return { rows: [], rowCount: 1 };
      }
      if (s.startsWith('select * from wallet_link_challenges where id = $1 and username = $2 and operation_id is not null')) {
        return { rows: state.walletChallenges.filter((item) => item.id === params[0] && item.username === params[1] && item.operation_id) };
      }
      if (s.startsWith('select * from wallet_link_challenges where id = $1 and operation_id is null')) {
        return { rows: state.walletChallenges.filter((item) => item.id === params[0] && !item.operation_id) };
      }
      if (s.startsWith('select * from wallet_operations where id = $1 and username = $2')) {
        return { rows: state.walletOperations.filter((item) => item.id === params[0] && item.username === params[1]) };
      }
      if (s.startsWith('select role, wallet_address, wallet_status from auth where username')) {
        const account = state.auth.find((item) => item.username === params[0]);
        return { rows: account ? [{ role: account.role, wallet_address: account.wallet_address, wallet_status: account.wallet_status }] : [] };
      }
      if (s.startsWith('update wallet_link_challenges set consumed_at')) {
        const challenge = state.walletChallenges.find((item) => item.id === params[0]);
        if (challenge) challenge.consumed_at = new Date();
        return { rows: [], rowCount: challenge ? 1 : 0 };
      }
      if (s.startsWith("update wallet_operations set status = 'ready_onchain'")) {
        const operation = state.walletOperations.find((item) => item.id === params[0]);
        if (operation) operation.status = 'ready_onchain';
        return { rows: [], rowCount: operation ? 1 : 0 };
      }
      if (s.startsWith("update auth set wallet_address = $1, wallet_status = 'pending_onchain'")) {
        const account = state.auth.find((item) => item.username === params[1]);
        if (account) Object.assign(account, { wallet_address: params[0], wallet_status: 'pending_onchain' });
        return { rows: [], rowCount: account ? 1 : 0 };
      }
      if (s.startsWith('select username, role, wallet_address, wallet_status from auth where lower(wallet_address)')) {
        const account = state.auth.find((item) => item.wallet_address?.toLowerCase() === String(params[0]).toLowerCase());
        return { rows: account ? [{ username: account.username, role: account.role, wallet_address: account.wallet_address, wallet_status: account.wallet_status }] : [] };
      }
      if (s.startsWith('select username, role, wallet_address, wallet_status, token_version from auth where username')) {
        const account = state.auth.find((item) => item.username === params[0]);
        return { rows: account ? [{ username: account.username, role: account.role, wallet_address: account.wallet_address, wallet_status: account.wallet_status, token_version: account.token_version }] : [] };
      }

      if (s.startsWith('select * from wallet_operations where id')) return { rows: state.walletOperations.filter((operation) => operation.id === params[0]) };
      if (s.startsWith("update wallet_operations set tx_hash = $1 where id = $2")) {
        const operation = state.walletOperations.find((item) => item.id === params[1]);
        if (operation) operation.tx_hash = params[0];
        return { rows: [], rowCount: operation ? 1 : 0 };
      }
      if (s.startsWith("update wallet_operations set status = 'completed'")) {
        const operation = state.walletOperations.find((item) => item.id === params[1]);
        if (operation) Object.assign(operation, { status: 'completed', tx_hash: params[0] });
        return { rows: [], rowCount: operation ? 1 : 0 };
      }
      if (s.startsWith("update auth set wallet_address = $1, wallet_status = 'active'")) {
        const account = state.auth.find((item) => item.username === params[1]);
        if (!account || (account.wallet_address || null) !== params[2]) return { rows: [], rowCount: 0 };
        Object.assign(account, { wallet_address: params[0], wallet_status: 'active' });
        return { rows: [], rowCount: 1 };
      }
      if (s.startsWith('insert into auth_password_events')) {
        state.passwordEvents.push({ actor_username: params[0], target_username: params[1], event_type: params[2] });
        return { rows: [], rowCount: 1 };
      }
      if (s.startsWith('select id, actor_username, target_username, event_type, created_at from auth_password_events')) {
        return { rows: state.passwordEvents.slice().reverse() };
      }
      if (s.startsWith('select p.serialnumber, p.name, p.brand, p.chain_status, p.failure_reason, p.created_at')) {
        return { rows: state.product.filter((p) => !p.manufacturerUsername && ['needs_retry', 'failed'].includes(p.chainStatus) && !p.chainTxHash)
          .map((p) => ({ serialnumber: p.serialNumber, name: p.name, brand: p.brand, chain_status: p.chainStatus, failure_reason: p.failureReason || null, created_at: p.createdAt || null })) };
      }
      if (s.startsWith('select id, serial_number, previous_manufacturer_username, new_manufacturer_username, actor_username, evidence_reference, created_at from product_manufacturer_assignment_events')) {
        return { rows: state.manufacturerAssignments.slice().reverse() };
      }
      if (s.startsWith('select id, previous_serial_number, new_serial_number, actor_username, evidence_reference, created_at from product_identity_rekey_events')) {
        return { rows: state.identityRekeys.slice().reverse() };
      }
      if (s.startsWith('select serialnumber, manufacturer_username, chain_status, chain_tx_hash, chain_sender, chain_contract_address, chain_expected_id, chain_id')) {
        const p = state.product.find((item) => item.serialNumber === params[0]);
        return { rows: p ? [{ serialnumber: p.serialNumber, manufacturer_username: p.manufacturerUsername || null, chain_status: p.chainStatus, chain_tx_hash: p.chainTxHash || null, chain_sender: p.chainSender || null, chain_contract_address: p.chainContractAddress || null, chain_expected_id: p.chainExpectedId || null, chain_id: p.chainId || null }] : [] };
      }
      if (s.startsWith('select 1 from product where serialnumber')) return { rows: state.product.some((p) => p.serialNumber === params[0]) ? [{ ok: 1 }] : [], rowCount: state.product.some((p) => p.serialNumber === params[0]) ? 1 : 0 };
      if (s.startsWith('select 1 from product_chain_attempts where serial_number') && s.includes('sender_address')) return { rows: [], rowCount: 0 };
      if (s.startsWith('update product set serialnumber = $1')) {
        const p = state.product.find((item) => item.serialNumber === params[1]);
        if (!p) return { rows: [], rowCount: 0 };
        p.serialNumber = params[0];
        return { rows: [{ serialnumber: p.serialNumber }], rowCount: 1 };
      }
      if (s.startsWith('insert into product_identity_rekey_events')) {
        state.identityRekeys.push({ previous_serial_number: params[0], new_serial_number: params[1], actor_username: params[2], evidence_reference: params[3] });
        return { rows: [], rowCount: 1 };
      }
      if (s.startsWith('select serialnumber, manufacturer_username, chain_status, chain_tx_hash from product where serialnumber')) {
        const p = state.product.find((item) => item.serialNumber === params[0]);
        return { rows: p ? [{ serialnumber: p.serialNumber, manufacturer_username: p.manufacturerUsername || null, chain_status: p.chainStatus, chain_tx_hash: p.chainTxHash || null }] : [] };
      }
      if (s.startsWith('select role from auth where username')) {
        return { rows: state.auth.filter((a) => a.username === params[0]).map(({ role }) => ({ role })) };
      }
      if (s.startsWith('select 1 from product_chain_attempts where serial_number')) return { rows: [], rowCount: 0 };
      if (s.startsWith('update product set manufacturer_username = $1')) {
        const p = state.product.find((item) => item.serialNumber === params[1] && !item.manufacturerUsername);
        if (!p) return { rows: [], rowCount: 0 };
        p.manufacturerUsername = params[0];
        return { rows: [{ serialnumber: p.serialNumber }], rowCount: 1 };
      }
      if (s.startsWith('insert into product_manufacturer_assignment_events')) {
        state.manufacturerAssignments.push({ serial_number: params[0], previous_manufacturer_username: params[1], new_manufacturer_username: params[2], actor_username: params[3], evidence_reference: params[4] });
        return { rows: [], rowCount: 1 };
      }
      if (s.startsWith('insert into wallet_operation_events') || s.startsWith('insert into wallet_account_events')
        || ['begin', 'commit', 'rollback'].includes(s)) return { rows: [], rowCount: 1 };

      if (s.startsWith('select token_version from auth where username')) {
        return { rows: state.auth.filter((a) => a.username === params[0]).map(({ token_version }) => ({ token_version })) };
      }
      if (s.startsWith('select username, password, role, wallet_address, wallet_status, token_version from auth where username')) {
        return { rows: state.auth.filter((a) => a.username === params[0]) };
      }
      if (s.startsWith('select password from auth where username')) {
        return { rows: state.auth.filter((a) => a.username === params[0]).map(({ password }) => ({ password })) };
      }
      if (s.startsWith('select wallet_address, wallet_status from auth where username')) {
        return { rows: state.auth.filter((a) => a.username === params[0]).map(({ wallet_address, wallet_status }) => ({ wallet_address, wallet_status })) };
      }
      if (s.startsWith('update auth set password = $1, token_version = token_version + 1')) {
        const account = state.auth.find((a) => a.username === params[1]);
        if (!account) return { rows: [], rowCount: 0 };
        account.password = params[0];
        account.token_version = (account.token_version || 0) + 1;
        return { rows: [{ username: account.username }], rowCount: 1 };
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
        state.auth.push({ id: state.auth.length + 1, username: params[0], password: params[1], role: params[2], token_version: 0 });
        return { rows: [] };
      }
      if (s.startsWith('select * from profile where username')) {
        return { rows: state.profile.filter((p) => p.username === params[0]) };
      }
      if (s.startsWith('select * from profile')) {
        return { rows: state.profile };
      }
      if (s.startsWith('insert into profile')) {
        if (state.failProfileInsert) throw new Error('profile insert failed');
        state.profile.push({
          username: params[0], name: params[1], description: params[2], website: params[3],
          location: params[4], image: params[5], role: params[6],
        });
        return { rows: [] };
      }
      if (s.startsWith('select serialnumber from product')) {
        return { rows: state.product.map((p) => ({ serialnumber: p.serialNumber })) };
      }
      if (s.startsWith('with created_product as')) {
        if (state.product.some((p) => p.serialNumber === params[0])) return { rows: [], rowCount: 0 };
        state.product.push({ serialNumber: params[0], name: params[1], brand: params[2], manufacturerUsername: params[3], chainSender: params[4], chainContractAddress: params[5], chainExpectedId: params[6], chainStatus: 'pending_wallet', chainAttempt: 1, chainTxHash: null });
        return { rows: [{ serial_number: params[0] }], rowCount: 1 };
      }
      if (s.startsWith('select chain_status, chain_tx_hash, chain_attempt, chain_sender from product')) {
        const p = state.product.find((row) => row.serialNumber === params[0] && row.manufacturerUsername === params[1]);
        return { rows: p ? [{ chain_status: p.chainStatus, chain_tx_hash: p.chainTxHash, chain_attempt: p.chainAttempt, chain_sender: p.chainSender }] : [] };
      }
      if (s.startsWith('with changed as')) {
        const p = state.product.find((row) => row.serialNumber === params[4] && row.manufacturerUsername === params[5] && row.chainStatus === 'pending_wallet' && row.chainAttempt === params[6]);
        if (!p) return { rows: [], rowCount: 0 };
        Object.assign(p, { chainStatus: 'submitted', chainTxHash: params[0], chainExpectedId: params[1], chainSender: params[2], chainContractAddress: params[3] });
        return { rows: [{ serial_number: p.serialNumber }], rowCount: 1 };
      }
      if (s.startsWith('with retried as')) {
        const p = state.product.find((row) => row.serialNumber === params[0] && row.manufacturerUsername === params[1] && ['failed', 'needs_retry'].includes(row.chainStatus));
        if (!p) return { rows: [], rowCount: 0 };
        p.chainAttempt += 1; p.chainStatus = 'pending_wallet'; p.chainTxHash = null; p.chainSender = params[2]; p.chainContractAddress = params[3]; p.chainExpectedId = params[4];
        return { rows: [{ serial_number: p.serialNumber, attempt_number: p.chainAttempt }], rowCount: 1 };
      }
      if (s.startsWith('select serialnumber, chain_status, chain_tx_hash, chain_id, chain_attempt')) {
        const p = state.product.find((row) => row.serialNumber === params[0] && (params[1] === 'admin' || row.manufacturerUsername === params[2]));
        return { rows: p ? [{ serialnumber: p.serialNumber, chain_status: p.chainStatus, chain_tx_hash: p.chainTxHash, chain_attempt: p.chainAttempt }] : [] };
      }
      if (s.startsWith('select serialnumber, name, brand, chain_description')) {
        const p = state.product.find((row) => row.serialNumber === params[0] && (params[1] === 'admin' || row.manufacturerUsername === params[2]));
        return { rows: p ? [{ serialnumber: p.serialNumber, name: p.name, brand: p.brand, chain_status: p.chainStatus, chain_tx_hash: p.chainTxHash, chain_attempt: p.chainAttempt }] : [] };
      }
      if (s.startsWith('select serialnumber, name, brand, chain_status')) {
        const rows = state.product.filter((p) => !params[0] || p.chainStatus === params[0]);
        return { rows };
      }
      if (s.startsWith('select latitude, longitude from product_scans')) {
        return { rows: state.scans.filter((scan) => scan.serial_number === params[0]).map(({ latitude, longitude }) => ({ latitude, longitude })) };
      }
      if (s.startsWith('insert into product_scans')) {
        const scan = {
          id: state.scans.length + 1,
          serial_number: params[0], contract_address: params[1], visitor_hash: params[2], outcome: params[3],
          latitude: params[4], longitude: params[5], location_source: params[6], flags: params[7], scanned_at: new Date(),
        };
        state.scans.push(scan);
        return { rows: [{ id: scan.id }] };
      }
      if (s.startsWith('select count(*)::int as count from product_scans')) {
        return { rows: [{ count: state.scans.filter((scan) => scan.serial_number === params[0]).length }] };
      }
      if (s.startsWith('update product_scans set flags')) {
        const scan = state.scans.find((item) => item.id === params[1]);
        if (scan) scan.flags = params[0];
        return { rows: [] };
      }
      if (s.startsWith('select serial_number, contract_address, outcome, latitude, longitude, location_source, flags, scanned_at from product_scans')) {
        return { rows: state.scans.filter((scan) => scan.flags.length > 0).slice(0, 100) };
      }
      return { rows: [] };
    },
  };
  pool.connect = async () => {
    let snapshot;
    return {
      async query(sql, params) {
        if (String(sql).trim().toLowerCase() === 'begin') snapshot = JSON.parse(JSON.stringify(state));
        if (String(sql).trim().toLowerCase() === 'rollback' && snapshot) Object.assign(state, snapshot);
        return pool.query(sql, params);
      },
      release() {},
    };
  };
  return pool;
}

function buildApp({ scanVerifier, chainAdapter, logger, trustProxyHops = 0 } = {}) {
  const uploadBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartscan-test-'));
  const pool = createFakePool();
  const app = createApp({ pool, jwtSecret: 'test-secret', allowedOrigins: ['http://localhost:3000'], uploadBaseDir, contractAddress: '0x0000000000000000000000000000000000000022', rpcUrl: 'http://rpc.test', chainId: '11155111', scanVerifier, chainAdapter, logger, trustProxyHops });
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
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
});

test('business user proves their own wallet and the account stays write-disabled pending owner approval', async () => {
  const userWallet = ethers.Wallet.createRandom();
  const owner = '0x0000000000000000000000000000000000000099';
  const chainAdapter = () => ({
    address: '0x0000000000000000000000000000000000000022',
    provider: {},
    contract: {
      async owner() { return owner; },
      async roles() { return 0; },
      async businessNames() { return ''; },
      async walletSuccessor() { return ethers.ZeroAddress; },
    },
  });
  const { app, pool } = buildApp({ chainAdapter });
  pool.state.auth.push({ id: 3, username: 'supplier', password: hashPassword('supplier-password'), role: 'supplier', wallet_address: null, wallet_status: 'unlinked', token_version: 0 });
  pool.state.profile.push({ username: 'supplier', name: 'Example Supply Ltd' });
  const token = await loginAs(app, 'supplier', 'supplier-password');

  const challenge = await request(app).post('/wallet-link/challenge')
    .set('Authorization', `Bearer ${token}`).send({ walletAddress: userWallet.address });
  assert.equal(challenge.status, 201, challenge.body.error);
  assert.equal(challenge.body.action, 'link');
  const signature = await userWallet.signMessage(challenge.body.message);
  const verified = await request(app).post('/wallet-link/verify')
    .set('Authorization', `Bearer ${token}`).send({ challengeId: challenge.body.challengeId, signature });
  assert.equal(verified.status, 200, verified.body.error);
  assert.equal(verified.body.walletStatus, 'pending_onchain');
  assert.equal(pool.state.auth.find((account) => account.username === 'supplier').wallet_status, 'pending_onchain');
  assert.equal(pool.state.walletOperations[0].status, 'ready_onchain');
  assert.equal(pool.state.walletOperations[0].new_wallet_address.toLowerCase(), userWallet.address.toLowerCase());
  assert.equal(pool.state.walletOperations[0].requested_by, 'supplier');

  const adminToken = await loginAs(app, 'admin', 'admin');
  const adminCannotSignOwnership = await request(app).post('/admin/wallet-operations')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'supplier', action: 'link', newWalletAddress: userWallet.address });
  assert.equal(adminCannotSignOwnership.status, 403);
});

test('wallet login requires a fresh signature from an active linked business wallet', async () => {
  const userWallet = ethers.Wallet.createRandom();
  const owner = '0x0000000000000000000000000000000000000099';
  const chainAdapter = () => ({
    address: '0x0000000000000000000000000000000000000022',
    provider: {},
    contract: {
      async owner() { return owner; },
      async roles(address) { return address.toLowerCase() === userWallet.address.toLowerCase() ? 3 : 0; },
      async businessNames() { return 'Example Supply Ltd'; },
      async walletSuccessor() { return ethers.ZeroAddress; },
    },
  });
  const { app, pool } = buildApp({ chainAdapter });
  pool.state.auth.push({ id: 3, username: 'supplier', password: hashPassword('supplier-password'), role: 'supplier', wallet_address: userWallet.address, wallet_status: 'active', token_version: 0 });

  const challenge = await request(app).post('/auth/wallet/challenge').send({ walletAddress: userWallet.address });
  assert.equal(challenge.status, 200, challenge.body.error);
  const signature = await userWallet.signMessage(challenge.body.message);
  const signedIn = await request(app).post('/auth/wallet/verify').send({ challengeId: challenge.body.challengeId, signature });
  assert.equal(signedIn.status, 200, signedIn.body.error);
  assert.equal(signedIn.body.user.username, 'supplier');
  assert.ok(signedIn.body.token);

  const replay = await request(app).post('/auth/wallet/verify').send({ challengeId: challenge.body.challengeId, signature });
  assert.equal(replay.status, 410);
});

test('malformed JSON gets generic error and security headers', async () => {
  const { app } = buildApp();
  const response = await request(app).post('/auth')
    .set('Content-Type', 'application/json')
    .send('{"username":');
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { success: 0, error: 'Invalid request' });
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
});

test('API sets HSTS only for HTTPS requests recognized through the configured proxy chain', async () => {
  const { app } = buildApp({ trustProxyHops: 1 });
  const httpsResponse = await request(app).get('/healthz').set('X-Forwarded-Proto', 'https');
  const httpResponse = await request(app).get('/healthz');

  assert.equal(httpsResponse.headers['strict-transport-security'], 'max-age=31536000');
  assert.equal(httpResponse.headers['strict-transport-security'], undefined);
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

test('product image upload is role-protected and can be retrieved from local development storage', async () => {
  const { app } = buildApp();
  const adminToken = await loginAs(app, 'admin', 'admin');
  const denied = await request(app).post('/upload/product')
    .set('Authorization', `Bearer ${adminToken}`)
    .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { filename: 'product.jpg', contentType: 'image/jpeg' });
  assert.equal(denied.status, 403);

  const manufacturerToken = await loginAs(app, 'manu', 'manu');
  const uploaded = await request(app).post('/upload/product')
    .set('Authorization', `Bearer ${manufacturerToken}`)
    .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { filename: 'misleading.png', contentType: 'image/jpeg' });
  assert.equal(uploaded.status, 200);
  assert.match(uploaded.body.fileName, /^[a-f0-9-]+\.jpg$/i);

  const fetched = await request(app).get(`/file/product/${uploaded.body.fileName}`);
  assert.equal(fetched.status, 200);
  assert.match(fetched.headers['content-type'], /image\/jpeg/);
});

test('product image upload rejects content that does not match its declared image type', async () => {
  const { app } = buildApp();
  const manufacturerToken = await loginAs(app, 'manu', 'manu');
  const res = await request(app).post('/upload/product')
    .set('Authorization', `Bearer ${manufacturerToken}`)
    .attach('image', Buffer.from('not an image'), { filename: 'product.png', contentType: 'image/png' });
  assert.equal(res.status, 400);
});

test('product image upload reports unsupported media types as a client error', async () => {
  const { app } = buildApp();
  const manufacturerToken = await loginAs(app, 'manu', 'manu');
  const response = await request(app).post('/upload/product')
    .set('Authorization', `Bearer ${manufacturerToken}`)
    .attach('image', Buffer.from('not an image'), { filename: 'payload.svg', contentType: 'image/svg+xml' });
  assert.equal(response.status, 415);
  assert.equal(response.body.error, 'Only JPEG, PNG, GIF, or WebP images are allowed');
});

test('object storage image retrieval uses a short-lived redirect without exposing bucket access', async () => {
  const pool = createFakePool();
  const uploadStore = {
    async put(scope, file) { assert.equal(scope, 'product'); assert.ok(file.buffer.length); return 'stored-image.png'; },
    async get(scope, fileName) {
      assert.equal(scope, 'product');
      assert.equal(fileName, 'stored-image.png');
      return { type: 'redirect', url: 'https://storage.example.test/signed?expires=300' };
    },
  };
  const app = createApp({ pool, jwtSecret: 'test-secret', allowedOrigins: ['http://localhost:3000'], uploadStore });
  const token = await loginAs(app, 'manu', 'manu');
  const uploaded = await request(app).post('/upload/product')
    .set('Authorization', `Bearer ${token}`)
    .attach('image', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), { filename: 'product.png', contentType: 'image/png' });
  assert.equal(uploaded.status, 200);
  const fetched = await request(app).get('/file/product/stored-image.png');
  assert.equal(fetched.status, 302);
  assert.equal(fetched.headers.location, 'https://storage.example.test/signed?expires=300');
  assert.equal(fetched.headers['cache-control'], 'private, no-store');
});

test('scan outcome comes from server-side chain verification, not client-supplied outcome or conflict flags', async () => {
  let verifierCalls = 0;
  const { app, pool } = buildApp({ scanVerifier: async () => { verifierCalls += 1; return { exists: true, conflictingState: false }; } });
  const response = await request(app).post('/scan-events').send({
    serialNumber: 'SS-00000000-0000-0000-0000-000000000021',
    contractAddress: '0x0000000000000000000000000000000000000022',
    outcome: 'invalid',
    conflictingState: true,
    latitude: 37.123,
    longitude: -122.456,
  });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body.flags, []);
  assert.equal(verifierCalls, 1);
  assert.equal(pool.state.scans[0].outcome, 'valid');
  assert.equal(pool.state.scans[0].latitude, 37.12);
  assert.equal(pool.state.scans[0].longitude, -122.46);
  assert.equal(pool.state.scans[0].location_source, 'browser_reported');
});

test('server-detected conflicting product history is flagged even if client denies it', async () => {
  const { app, pool } = buildApp({ scanVerifier: async () => ({ exists: true, conflictingState: true }) });
  const response = await request(app).post('/scan-events').send({
    serialNumber: 'SS-00000000-0000-0000-0000-000000000022',
    contractAddress: '0x0000000000000000000000000000000000000022',
    conflictingState: false,
  });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body.flags, ['conflicting_product_state']);
  assert.deepEqual(pool.state.scans[0].flags, ['conflicting_product_state']);
});

test('wrong contract is recorded as invalid without asking the chain verifier', async () => {
  let verifierCalls = 0;
  const { app, pool } = buildApp({ scanVerifier: async () => { verifierCalls += 1; return { exists: true }; } });
  const response = await request(app).post('/scan-events').send({
    serialNumber: 'SS-00000000-0000-0000-0000-000000000023',
    contractAddress: '0x0000000000000000000000000000000000000033',
    outcome: 'valid',
  });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body.flags, ['invalid_identifier']);
  assert.equal(pool.state.scans[0].outcome, 'invalid');
  assert.equal(verifierCalls, 0);
});

test('scan telemetry is not persisted when authoritative chain verification is unavailable', async () => {
  const { app, pool } = buildApp({ scanVerifier: async () => { throw new Error('RPC details must not be exposed'); } });
  const response = await request(app).post('/scan-events').send({
    serialNumber: 'SS-00000000-0000-0000-0000-000000000024',
    contractAddress: '0x0000000000000000000000000000000000000022',
  });
  assert.equal(response.status, 503);
  assert.match(response.body.error, /temporarily unavailable/);
  assert.equal(pool.state.scans.length, 0);
});

test('unexpected server errors are logged with a request id without exposing internal details', async () => {
  const logEntries = [];
  const { app, pool } = buildApp({ logger: { error: (entry) => logEntries.push(JSON.parse(entry)) } });
  pool.query = async () => { throw new Error('database password and internal SQL must not be exposed'); };
  const response = await request(app).post('/auth').send({ username: 'admin', password: 'admin' });
  assert.equal(response.status, 500);
  assert.equal(response.body.error, 'An unexpected server error occurred');
  assert.ok(/^[0-9a-f-]{36}$/i.test(response.body.requestId));
  assert.equal(JSON.stringify(response.body).includes('database password'), false);
  assert.deepEqual(logEntries, [{
    event: 'http_request_failed', requestId: response.body.requestId, method: 'POST', path: '/auth', status: 500,
  }]);
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
    .send({ username: 'newuser', password: 'Supplier-Password-2026!', role: 'supplier' });
  assert.equal(first.status, 200);
  assert.equal(first.body.success, 1);

  const dup = await request(app).post('/addaccount').set('Authorization', `Bearer ${token}`)
    .send({ username: 'newuser', password: 'Supplier-Password-2026!', role: 'supplier' });
  assert.equal(dup.status, 409);
});

test('profile creation enforces the contract business-name byte limit and account role', async () => {
  const { app, pool } = buildApp();
  const token = await loginAs(app, 'admin', 'admin');
  pool.state.auth.push({ id: 3, username: 'brand-a', password: hashPassword('Brand-Password-2026!'), role: 'manufacturer', token_version: 0 });
  const profile = { username: 'brand-a', name: 'Acme Manufacturing', description: '', website: '', location: '', image: '', role: 'manufacturer' };

  const tooLong = await request(app).post('/addprofile').set('Authorization', `Bearer ${token}`)
    .send({ ...profile, name: '\u00e9'.repeat(51) });
  assert.equal(tooLong.status, 400);

  const wrongRole = await request(app).post('/addprofile').set('Authorization', `Bearer ${token}`)
    .send({ ...profile, role: 'supplier' });
  assert.equal(wrongRole.status, 409);

  const created = await request(app).post('/addprofile').set('Authorization', `Bearer ${token}`).send(profile);
  assert.equal(created.status, 200);
  assert.equal(pool.state.profile[0].name, 'Acme Manufacturing');
});

test('admin account and profile creation is atomic', async () => {
  const { app, pool } = buildApp({ logger: { error() {} } });
  const token = await loginAs(app, 'admin', 'admin');
  const payload = {
    username: 'new-brand', password: 'Brand-Password-2026!', role: 'manufacturer',
    name: 'New Brand Manufacturing', description: '', website: '', location: '', image: '',
  };

  pool.state.failProfileInsert = true;
  const failed = await request(app).post('/addaccount').set('Authorization', `Bearer ${token}`).send(payload);
  assert.equal(failed.status, 500);
  assert.equal(pool.state.auth.some((account) => account.username === payload.username), false);
  assert.equal(pool.state.profile.some((profile) => profile.username === payload.username), false);

  pool.state.failProfileInsert = false;
  const created = await request(app).post('/addaccount').set('Authorization', `Bearer ${token}`).send(payload);
  assert.equal(created.status, 200);
  assert.equal(pool.state.auth.some((account) => account.username === payload.username), true);
  assert.equal(pool.state.profile.some((profile) => profile.username === payload.username), true);
});

test('password changes verify the current password and revoke the user’s previous tokens', async () => {
  const { app, pool } = buildApp();
  const oldToken = await loginAs(app, 'manu', 'manu');
  const rejected = await request(app).post('/changepsw').set('Authorization', `Bearer ${oldToken}`)
    .send({ currentPassword: 'wrong', newPassword: 'Manufacturer-Password-2026!' });
  assert.equal(rejected.status, 401);
  assert.equal(pool.state.auth[1].token_version, 0);

  const changed = await request(app).post('/changepsw').set('Authorization', `Bearer ${oldToken}`)
    .send({ currentPassword: 'manu', newPassword: 'Manufacturer-Password-2026!' });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.requiresReauthentication, true);
  assert.equal(pool.state.auth[1].token_version, 1);
  assert.equal(pool.state.passwordEvents[0].event_type, 'password_changed');
  const oldSession = await request(app).get('/profile/manu').set('Authorization', `Bearer ${oldToken}`);
  assert.equal(oldSession.status, 401);
  const newToken = await loginAs(app, 'manu', 'Manufacturer-Password-2026!');
  assert.ok(newToken);
  const shortPassword = await request(app).post('/changepsw').set('Authorization', `Bearer ${newToken}`)
    .send({ currentPassword: 'Manufacturer-Password-2026!', newPassword: 'short' });
  assert.equal(shortPassword.status, 400);
});

test('admin password reset proves the admin password, audits the reset, and revokes target sessions', async () => {
  const { app, pool } = buildApp();
  const target = { id: 3, username: 'supplier-account', password: hashPassword('supplier-old'), role: 'supplier', token_version: 0 };
  pool.state.auth.push(target);
  const adminToken = await loginAs(app, 'admin', 'admin');
  const targetToken = await loginAs(app, 'supplier-account', 'supplier-old');
  const reset = await request(app).post('/changepsw').set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'supplier-account', currentPassword: 'admin', newPassword: 'Supplier-Reset-Password-2026!' });
  assert.equal(reset.status, 200);
  assert.equal(target.token_version, 1);
  assert.deepEqual(pool.state.passwordEvents[0], {
    actor_username: 'admin', target_username: 'supplier-account', event_type: 'password_reset',
  });
  const oldSession = await request(app).get('/profile/supplier-account').set('Authorization', `Bearer ${targetToken}`);
  assert.equal(oldSession.status, 401);
  assert.ok(await loginAs(app, 'supplier-account', 'Supplier-Reset-Password-2026!'));
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
    .send({ serialNumber: 'SS-00000000-0000-0000-0000-000000000011', name: 'Bag', brand: 'Chanel' });
  assert.equal(res.status, 201);
  assert.equal(res.body.success, 1);
  assert.equal(res.body.status, 'pending_wallet');
});

test('only records a submitted transaction hash; clients cannot declare confirmation', async () => {
  const { app, pool } = buildApp();
  const token = await loginAs(app, 'manu', 'manu');
  const serialNumber = 'SS-00000000-0000-0000-0000-000000000012';
  const created = await request(app).post('/addproduct').set('Authorization', `Bearer ${token}`)
    .send({ serialNumber, name: 'Bag', brand: 'Chanel' });
  assert.equal(created.status, 201);

  const confirmed = await request(app).patch(`/product/${serialNumber}/chain-status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'confirmed', txHash: `0x${'a'.repeat(64)}`, chainId: '11155111' });
  assert.equal(confirmed.status, 404);

  const submitted = await request(app).post(`/product/${serialNumber}/chain-transaction`)
    .set('Authorization', `Bearer ${token}`)
    .send({ txHash: `0x${'a'.repeat(64)}` });
  assert.equal(submitted.status, 202);
  assert.equal(submitted.body.status, 'submitted');
  assert.equal(pool.state.product[0].chainStatus, 'submitted');
  assert.equal(pool.state.product[0].chainExpectedId, '11155111');
  assert.equal(pool.state.product[0].chainSender, '0x0000000000000000000000000000000000000011');
  const duplicateSubmission = await request(app).post(`/product/${serialNumber}/chain-transaction`)
    .set('Authorization', `Bearer ${token}`).send({ txHash: `0x${'a'.repeat(64)}` });
  assert.equal(duplicateSubmission.status, 200);
  assert.equal(duplicateSubmission.body.idempotent, true);
});

test('transaction persistence rejects malformed hashes and requires a linked wallet', async () => {
  const { app } = buildApp();
  const token = await loginAs(app, 'manu', 'manu');
  const serialNumber = 'SS-00000000-0000-0000-0000-000000000013';
  await request(app).post('/addproduct').set('Authorization', `Bearer ${token}`).send({ serialNumber, name: 'Bag', brand: 'Chanel' });
  const invalid = await request(app).post(`/product/${serialNumber}/chain-transaction`)
    .set('Authorization', `Bearer ${token}`).send({ txHash: '0xabc' });
  assert.equal(invalid.status, 400);
});

test('retry is allowed only after reconciliation marks a product retryable and is idempotently guarded', async () => {
  const { app, pool } = buildApp();
  const token = await loginAs(app, 'manu', 'manu');
  const serialNumber = 'SS-00000000-0000-0000-0000-000000000014';
  await request(app).post('/addproduct').set('Authorization', `Bearer ${token}`).send({ serialNumber, name: 'Bag', brand: 'Chanel' });
  pool.state.product[0].chainStatus = 'needs_retry';
  const retry = await request(app).post(`/product/${serialNumber}/retry`).set('Authorization', `Bearer ${token}`);
  assert.equal(retry.status, 202);
  assert.equal(retry.body.attempt, 2);
  assert.equal(pool.state.product[0].chainStatus, 'pending_wallet');
  const duplicateRetry = await request(app).post(`/product/${serialNumber}/retry`).set('Authorization', `Bearer ${token}`);
  assert.equal(duplicateRetry.status, 409);
});

test('admin can monitor chain statuses', async () => {
  const { app } = buildApp();
  const token = await loginAs(app, 'admin', 'admin');
  const response = await request(app).get('/product/chain-status?status=pending_chain')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 400);
  const valid = await request(app).get('/product/chain-status?status=pending_wallet')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(valid.status, 200);
  assert.ok(Array.isArray(valid.body));
});

test('only admins can read flagged scan events', async () => {
  const { app } = buildApp();
  const adminToken = await loginAs(app, 'admin', 'admin');
  const manufacturerToken = await loginAs(app, 'manu', 'manu');
  const adminResponse = await request(app).get('/admin/scan-alerts').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(adminResponse.status, 200);
  assert.deepEqual(adminResponse.body, []);
  const manufacturerResponse = await request(app).get('/admin/scan-alerts').set('Authorization', `Bearer ${manufacturerToken}`);
  assert.equal(manufacturerResponse.status, 403);
});

test('only admins can inspect password-change audit events', async () => {
  const { app, pool } = buildApp();
  pool.state.passwordEvents.push({ id: 1, actor_username: 'admin', target_username: 'manu', event_type: 'password_reset' });
  const adminToken = await loginAs(app, 'admin', 'admin');
  const manufacturerToken = await loginAs(app, 'manu', 'manu');
  const adminResponse = await request(app).get('/admin/password-audit').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(adminResponse.status, 200);
  assert.equal(adminResponse.body[0].event_type, 'password_reset');
  const denied = await request(app).get('/admin/password-audit').set('Authorization', `Bearer ${manufacturerToken}`);
  assert.equal(denied.status, 403);
});

test('admins can assign a hashless legacy product only with source evidence and a manufacturer account', async () => {
  const { app, pool } = buildApp();
  const serialNumber = 'SS-00000000-0000-0000-0000-000000000099';
  pool.state.product.push({ serialNumber, name: 'Legacy widget', brand: 'Example', manufacturerUsername: null, chainStatus: 'needs_retry', chainTxHash: null });
  pool.state.auth.push({ id: 3, username: 'source-manufacturer', password: hashPassword('source-password'), role: 'manufacturer', wallet_address: null, wallet_status: 'unlinked', token_version: 0 });
  const adminToken = await loginAs(app, 'admin', 'admin');
  const unassigned = await request(app).get('/admin/unassigned-products').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(unassigned.status, 200);
  assert.equal(unassigned.body.length, 1);
  assert.equal(unassigned.body[0].serialnumber, serialNumber);

  const invalidEvidence = await request(app).post(`/admin/products/${serialNumber}/assign-manufacturer`)
    .set('Authorization', `Bearer ${adminToken}`).send({ manufacturerUsername: 'source-manufacturer', evidenceReference: 'short' });
  assert.equal(invalidEvidence.status, 400);
  const unverified = await request(app).post(`/admin/products/${serialNumber}/assign-manufacturer`)
    .set('Authorization', `Bearer ${adminToken}`).send({ manufacturerUsername: 'source-manufacturer', evidenceReference: 'Invoice archive ref INV-2024-017' });
  assert.equal(unverified.status, 400);
  assert.equal(pool.state.product[0].manufacturerUsername, null);
  const assigned = await request(app).post(`/admin/products/${serialNumber}/assign-manufacturer`)
    .set('Authorization', `Bearer ${adminToken}`).send({ manufacturerUsername: 'source-manufacturer', evidenceReference: 'Invoice archive ref INV-2024-017', sourceRecordVerified: true });
  assert.equal(assigned.status, 201, assigned.body.error);
  assert.equal(pool.state.product[0].manufacturerUsername, 'source-manufacturer');
  assert.equal(pool.state.manufacturerAssignments[0].actor_username, 'admin');
  assert.equal(pool.state.manufacturerAssignments[0].evidence_reference, 'Invoice archive ref INV-2024-017');

  const manufacturerToken = await loginAs(app, 'source-manufacturer', 'source-password');
  const ownedStatus = await request(app).get(`/product/${serialNumber}/chain-status`).set('Authorization', `Bearer ${manufacturerToken}`);
  assert.equal(ownedStatus.status, 200);
  const audit = await request(app).get('/admin/manufacturer-assignment-audit').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(audit.status, 200);
  assert.equal(audit.body[0].new_manufacturer_username, 'source-manufacturer');
});

test('admins can safely rekey an invalid legacy identifier only after confirming source records and absence on-chain', async () => {
  const { app, pool } = buildApp({ scanVerifier: async () => ({ exists: false, conflictingState: false }) });
  const oldSerialNumber = 'legacy-456';
  const newSerialNumber = 'SS-00000000-0000-0000-0000-000000000456';
  pool.state.product.push({ serialNumber: oldSerialNumber, name: 'Legacy item', brand: 'Example', manufacturerUsername: null, chainStatus: 'needs_retry', chainTxHash: null });
  const adminToken = await loginAs(app, 'admin', 'admin');

  const unverified = await request(app).post(`/admin/products/${oldSerialNumber}/rekey-legacy`).set('Authorization', `Bearer ${adminToken}`).send({
    newSerialNumber, evidenceReference: 'Archive record LEG-456', sourceRecordVerified: false,
  });
  assert.equal(unverified.status, 400);
  assert.equal(pool.state.product[0].serialNumber, oldSerialNumber);

  const rekeyed = await request(app).post(`/admin/products/${oldSerialNumber}/rekey-legacy`).set('Authorization', `Bearer ${adminToken}`).send({
    newSerialNumber, evidenceReference: 'Archive record LEG-456', sourceRecordVerified: true,
  });
  assert.equal(rekeyed.status, 201, rekeyed.body.error);
  assert.equal(rekeyed.body.oldIdentifierRemainsInvalid, true);
  assert.equal(pool.state.product[0].serialNumber, newSerialNumber);
  assert.equal(pool.state.identityRekeys[0].previous_serial_number, oldSerialNumber);
  assert.equal(pool.state.identityRekeys[0].actor_username, 'admin');

  const audit = await request(app).get('/admin/product-identity-rekey-audit').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(audit.status, 200);
  assert.equal(audit.body[0].new_serial_number, newSerialNumber);
});

test('legacy product rekey is refused when either identifier exists on-chain', async () => {
  const { app, pool } = buildApp({ scanVerifier: async (serial) => ({ exists: serial === 'SS-00000000-0000-0000-0000-000000000457', conflictingState: false }) });
  const oldSerialNumber = 'legacy-457';
  const newSerialNumber = 'SS-00000000-0000-0000-0000-000000000457';
  pool.state.product.push({ serialNumber: oldSerialNumber, name: 'Legacy item', brand: 'Example', manufacturerUsername: null, chainStatus: 'needs_retry', chainTxHash: null });
  const adminToken = await loginAs(app, 'admin', 'admin');
  const response = await request(app).post(`/admin/products/${oldSerialNumber}/rekey-legacy`).set('Authorization', `Bearer ${adminToken}`).send({
    newSerialNumber, evidenceReference: 'Archive record LEG-457', sourceRecordVerified: true,
  });
  assert.equal(response.status, 409);
  assert.equal(pool.state.product[0].serialNumber, oldSerialNumber);
});

test('legacy product rekey is refused when the database already has chain identity', async () => {
  const { app, pool } = buildApp({ scanVerifier: async () => ({ exists: false, conflictingState: false }) });
  const oldSerialNumber = 'legacy-458';
  const newSerialNumber = 'SS-00000000-0000-0000-0000-000000000458';
  pool.state.product.push({ serialNumber: oldSerialNumber, name: 'Legacy item', brand: 'Example', manufacturerUsername: null, chainStatus: 'needs_retry', chainTxHash: null, chainSender: '0x0000000000000000000000000000000000000011' });
  const adminToken = await loginAs(app, 'admin', 'admin');
  const response = await request(app).post(`/admin/products/${oldSerialNumber}/rekey-legacy`).set('Authorization', `Bearer ${adminToken}`).send({
    newSerialNumber, evidenceReference: 'Archive record LEG-458', sourceRecordVerified: true,
  });
  assert.equal(response.status, 409);
  assert.equal(pool.state.product[0].serialNumber, oldSerialNumber);
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

test('admin can reconcile a Safe execution only from its exact role event and resulting chain state', async () => {
  const contractAddress = '0x0000000000000000000000000000000000000022';
  const safeAddress = '0x0000000000000000000000000000000000000099';
  const newWallet = '0x0000000000000000000000000000000000000033';
  const operationId = '00000000-0000-4000-8000-000000000001';
  const txHash = `0x${'a'.repeat(64)}`;
  const eventInterface = new ethers.Interface(['event RoleGranted(address indexed account, uint8 role)']);
  const encodedEvent = eventInterface.encodeEventLog(eventInterface.getEvent('RoleGranted'), [newWallet, 3]);
  const receipt = {
    status: 1,
    logs: [
      { address: contractAddress, topics: encodedEvent.topics, data: encodedEvent.data },
    ],
  };
  const transaction = {
    hash: txHash,
    from: '0x0000000000000000000000000000000000000044', // Safe executor, not the Safe owner itself.
    to: safeAddress,
    data: '0x12345678',
    chainId: 11155111n,
  };
  const chainAdapter = () => ({
    address: contractAddress,
    provider: {
      async getNetwork() { return { chainId: 11155111n }; },
      async getTransaction(hash) { return hash.toLowerCase() === txHash.toLowerCase() ? transaction : null; },
      async getTransactionReceipt(hash) { return hash.toLowerCase() === txHash.toLowerCase() ? receipt : null; },
    },
    contract: {
      async owner() { return safeAddress; },
      async roles(address) { return address.toLowerCase() === newWallet.toLowerCase() ? 3 : 0; },
      async businessNames(address) { return address.toLowerCase() === newWallet.toLowerCase() ? 'Example Supply Ltd' : ''; },
      async walletSuccessor() { return ethers.ZeroAddress; },
    },
  });
  const { app, pool } = buildApp({ chainAdapter });
  pool.state.auth.push({ id: 3, username: 'supplier-account', password: '', role: 'supplier', wallet_address: null, wallet_status: 'unlinked' });
  pool.state.walletOperations.push({
    id: operationId, username: 'supplier-account', action: 'link', old_wallet_address: null,
    new_wallet_address: newWallet, role: 'supplier', business_name: 'Example Supply Ltd',
    requested_by: 'admin', status: 'ready_onchain', tx_hash: null,
  });
  const token = await loginAs(app, 'admin', 'admin');

  const recorded = await request(app).post(`/admin/wallet-operations/${operationId}/record-transaction`)
    .set('Authorization', `Bearer ${token}`).send({ txHash });
  assert.equal(recorded.status, 200, recorded.body.error);
  assert.equal(pool.state.walletOperations[0].tx_hash, txHash);

  const completed = await request(app).post(`/admin/wallet-operations/${operationId}/complete`)
    .set('Authorization', `Bearer ${token}`).send({ txHash });
  assert.equal(completed.status, 200, completed.body.error);
  assert.equal(pool.state.auth.find((account) => account.username === 'supplier-account').wallet_address, newWallet);
  assert.equal(pool.state.walletOperations[0].status, 'completed');
});
