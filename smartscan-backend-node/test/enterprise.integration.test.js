const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
const { ethers } = require('ethers');
const { createEnterprise, normalizeLocation, chainLocation } = require('../enterprise');
const connectionString = process.env.SMARTSCAN_TEST_DATABASE_URL;

test('locations preserve provenance, validate coordinates and fit contract bytes', () => {
  assert.throws(() => normalizeLocation({ source: 'device', address: 'A', capturedAt: new Date().toISOString() }), /coordinates/);
  const p = normalizeLocation({ source: 'profile', address: 'Lagos', capturedAt: new Date().toISOString(), latitude: 6.5, longitude: 3.3 });
  assert.equal(p.latitude, undefined);
  assert.match(chainLocation(p), /^Profile address/);
  assert.ok(Buffer.byteLength(chainLocation({ ...p, address: 'é'.repeat(250) })) <= 200);
});

test('durable Enterprise operations on PostgreSQL', { skip: !connectionString }, async t => {
  assert.ok(['127.0.0.1','localhost'].includes(new URL(connectionString).hostname), 'Use an isolated local database.');
  const scenario = async (label, run) => { await run(); t.diagnostic(label); };
  const schema = `enterprise_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}`, max: 15 });
  const wallet = ethers.Wallet.createRandom();
  const other = ethers.Wallet.createRandom();
  const contract = ethers.Wallet.createRandom().address;
  const user = { username: 'maker', role: 'manufacturer', tokenVersion: 0 };
  const location = { source: 'unavailable', address: 'Location unavailable', capturedAt: new Date().toISOString() };
  let signs = 0, lostDatabaseResponse = false, failBroadcast = false, nonce = 0;
  const broadcasts = [], receipts = new Map();
  const provider = {
    getNetwork: async () => ({ chainId: 11155111n }), getBalance: async () => ethers.parseEther('1'),
    call: async () => '0x',
    async broadcastTransaction(raw) {
      const hash = ethers.keccak256(raw);
      const stored = await pool.query('SELECT signed_transaction FROM enterprise_operation_items WHERE transaction_hash=$1', [hash]);
      assert.equal(stored.rows[0]?.signed_transaction, raw, 'Payload must be durable BEFORE broadcast.');
      broadcasts.push(hash);
      if (failBroadcast) throw new Error('Lost RPC response');
      return { hash };
    },
    getTransactionReceipt: async hash => receipts.get(hash) || null,
  };
  const options = { pool, provider, contractAddress: contract, chainId: '11155111', logger: { error() {} },
    readProduct: async () => ['', '', '', '', '', [], 0, ethers.ZeroAddress, ethers.ZeroAddress, false, false],
    signerFactory: () => ({ address: wallet.address, provider,
      call: async () => ethers.AbiCoder.defaultAbiCoder().encode(['uint8'], [2]),
      populateTransaction: async tx => ({ ...tx, chainId: 11155111, nonce: nonce++, gasLimit: 100000, gasPrice: 1000000 }),
      signTransaction: async tx => { signs++; return wallet.signTransaction(tx); },
    }) };
  const wrappedPool = { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect();
    return { release: () => client.release(), async query(sql, params) {
      const result = await client.query(sql, params);
      if (lostDatabaseResponse && sql.includes('SET signed_transaction=$3')) {
        lostDatabaseResponse = false;
        throw Object.assign(new Error('Commit response lost'), { code: 'ECONNRESET' });
      }
      return result;
    } };
  } };
  const service = () => createEnterprise({ ...options, pool: wrappedPool });
  async function input() {
    const id = `SS-${randomUUID()}`;
    await pool.query(`INSERT INTO product(serialnumber,name,brand,manufacturer_username,chain_sender) VALUES($1,'Water','Example','maker',$2)`, [id, wallet.address]);
    await pool.query("INSERT INTO product_chain_attempts(serial_number,attempt_number,status) VALUES($1,1,'pending_wallet')", [id]);
    return { requestKey: randomUUID(), action: 'register', facilityId: '1', items: [{ productId: id, expectedVersion: 0 }], location };
  }
  try {
    await pool.query(`CREATE TABLE auth(username text PRIMARY KEY,role text,token_version integer DEFAULT 0);
      CREATE TABLE product(serialnumber text PRIMARY KEY,name text,brand text,manufacturer_username text,chain_sender text,
        chain_status text DEFAULT 'pending_wallet',chain_tx_hash text,chain_id text,chain_updated_at timestamptz,failure_reason text,
        chain_attempt integer DEFAULT 1,chain_description text,chain_image text);
      CREATE TABLE product_chain_attempts(serial_number text,attempt_number integer,status text,transaction_hash text,failure_reason text,finalized_at timestamptz);
      CREATE TABLE facility_subaccounts(id integer PRIMARY KEY,parent_username text,role text,status text,subaccount_name text,wallet_address text,
        encrypted_private_key text,key_iv text,key_auth_tag text,key_version integer);
      INSERT INTO auth(username,role) VALUES('maker','manufacturer'),('other','manufacturer'),('supp','supplier'),('shop','retailer'),('admin','admin');`);
    await pool.query(fs.readFileSync(path.join(__dirname, '../migrations/015_enterprise_operations.sql'), 'utf8'));
    await pool.query(`INSERT INTO facility_subaccounts(id,parent_username,role,status,subaccount_name,wallet_address)
      VALUES(1,'maker','manufacturer','active','Example',$1),(2,'other','manufacturer','active','Other',$2),
        (3,'supp','supplier','active','Supplier',$2),(4,'shop','retailer','active','Retailer',$2)`, [wallet.address, other.address]);

    await scenario('concurrent retries create one operation and changed details conflict', async () => {
      const body = await input();
      const s = service();
      const results = await Promise.all(Array.from({ length: 10 }, () => s.submit(user, body)));
      assert.equal(new Set(results.map(o => o.id)).size, 1);
      await assert.rejects(s.submit(user, { ...body, location: { ...location, address: 'changed' } }), e => e.status === 409);
      await assert.rejects(s.submit(user, { ...body, requestKey: randomUUID() }), e => e.status === 409);
      const own = await s.operations(user);
      assert.equal(own.length, 1);
      assert.equal((await s.operations({ ...user, username: 'other' })).length, 0);
      assert.equal(JSON.stringify(own).includes('signed_transaction'), false);
      await pool.query("UPDATE enterprise_operation_items SET status='failed'");
    });
    await scenario('foreign, inactive, mismatched roles and forbidden actions are refused', async () => {
      const body = await input();
      await assert.rejects(service().submit(user, { ...body, facilityId: '2' }), e => e.status === 403);
      for (const status of ['pending_approval','suspended','revoked']) {
        await pool.query('UPDATE facility_subaccounts SET status=$1 WHERE id=1', [status]);
        await assert.rejects(service().submit(user, body), e => e.status === 403);
      }
      await pool.query("UPDATE facility_subaccounts SET status='active' WHERE id=1");
      for (const [username, role, facilityId] of [['supp','supplier','3'],['shop','retailer','4'],['admin','admin','admin:admin']]) {
        await assert.rejects(service().submit({ username, role, tokenVersion: 0 }, { ...body, facilityId }), e => e.status === 403);
      }
      await assert.rejects(service().submit({ ...user, role: 'admin' }, body), e => e.status === 401);
      assert.equal(signs, 0);
    });
    await scenario('lost DB commit response recovers signed bytes without signing again', async () => {
      const body = await input();
      const op = await service().submit(user, body);
      lostDatabaseResponse = true;
      await service().tick();
      assert.equal(signs, 1);
      assert.equal(broadcasts.length, 0);
      const pending = (await service().operations(user)).find(o => o.id === op.id);
      assert.ok(pending.items[0].txHash);
      assert.equal(pending.items[0].status, 'submitted');
      failBroadcast = true;
      await service().tick();
      await service().tick();
      assert.equal(signs, 1);
      assert.deepEqual(broadcasts, [pending.items[0].txHash, pending.items[0].txHash]);
      failBroadcast = false;
      receipts.set(pending.items[0].txHash, { status: 1, blockNumber: 123, confirmations: async () => 2 });
      await service().tick();
      const complete = (await service().operations(user)).find(o => o.id === op.id);
      assert.equal(complete.items[0].status, 'confirmed');
      assert.equal((await pool.query('SELECT chain_status FROM product WHERE serialnumber=$1', [body.items[0].productId])).rows[0].chain_status, 'confirmed');
    });
    await scenario('only one worker signs and one confirmation remains pending', async () => {
      const body = await input();
      const op = await service().submit(user, body);
      await Promise.all([service().tick(), service().tick(), service().tick()]);
      assert.equal(signs, 2);
      const item = (await service().operations(user)).find(o => o.id === op.id).items[0];
      receipts.set(item.txHash, { status: 1, blockNumber: 124, confirmations: async () => 1 });
      await service().tick();
      assert.equal((await service().operations(user)).find(o => o.id === op.id).items[0].status, 'submitted');
      receipts.set(item.txHash, { status: 0, blockNumber: 124, confirmations: async () => 2 });
      await service().tick();
      assert.equal((await service().operations(user)).find(o => o.id === op.id).items[0].status, 'failed');
    });
    await scenario('revocation between submission and signing prevents a transaction', async () => {
      const body = await input();
      const op = await service().submit(user, body);
      await pool.query("UPDATE facility_subaccounts SET status='revoked' WHERE id=1");
      await service().tick();
      assert.equal(signs, 2);
      assert.equal((await service().operations(user)).find(o => o.id === op.id).items[0].status, 'failed');
    });
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
