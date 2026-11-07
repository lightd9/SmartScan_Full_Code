const { randomUUID, createHash } = require('crypto');
const { ethers } = require('ethers');
const { chainProduct } = require('./assessment');
const { getSubaccountSigner } = require('./crypto-vault');
const { getContractOwnerWallet, fundSubaccount } = require('./gas-treasury');

const ACTIONS = ['register', 'dispatch', 'receive', 'sell', 'recall'];
const ROLES = ['', 'admin', 'manufacturer', 'supplier', 'retailer'];
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const SERIAL = /^SS-[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const ABI = [
  'function roles(address) view returns (uint8)',
  'function owner() view returns (address)',
  'function registerProduct(string,string,string,string,string,string,string,string)',
  'function dispatchProduct(string,address,string,string,string)',
  'function confirmDelivery(string,string,string,string)',
  'function markSold(string,string,string,string)',
  'function recallProduct(string,string,string,string,string)',
];
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function limited(value, max, required = false) {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= max && (!required || value.trim());
}
function normalizeLocation(value) {
  if (!value || !['device', 'profile', 'unavailable'].includes(value.source)
      || !limited(value.address, 500, true) || !Number.isFinite(Date.parse(value.capturedAt))) {
    fail('Provide a measured location, profile address, or explicitly unavailable location.');
  }
  const result = { address: value.address.trim(), source: value.source, capturedAt: new Date(value.capturedAt).toISOString() };
  if (value.source === 'device') {
    if (!Number.isFinite(value.latitude) || Math.abs(value.latitude) > 90
        || !Number.isFinite(value.longitude) || Math.abs(value.longitude) > 180) fail('Invalid device coordinates.');
    result.latitude = value.latitude; result.longitude = value.longitude;
    if (value.accuracyMeters !== undefined) {
      if (!Number.isFinite(value.accuracyMeters) || value.accuracyMeters < 0) fail('Invalid location accuracy.');
      result.accuracyMeters = value.accuracyMeters;
    }
  }
  return result;
}
function chainLocation(location) {
  const prefix = location.source === 'device'
    ? `Device-reported ${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}; `
    : location.source === 'profile' ? 'Profile address; ' : 'Location unavailable; ';
  let text = prefix + location.address;
  while (Buffer.byteLength(text, 'utf8') > 200) text = Array.from(text).slice(0, -1).join('');
  return text;
}
function operationDto(row, items) {
  return { id: row.id, requestKey: row.request_key, accountId: row.username, facilityId: row.facility_id,
    action: row.action, recipientId: row.recipient_id, reason: row.reason, location: row.location,
    createdAt: row.created_at, items: items.map(i => ({ productId: i.serial_number,
      expectedVersion: i.expected_version, status: i.status === 'queued' ? 'submitted' : i.status,
      phase: i.status, message: i.message, txHash: i.transaction_hash, blockNumber: i.block_number,
      finishAt: 0 })) };
}
// Keep SQL projections explicit: neither encrypted keys nor signed payloads belong in snapshots.
const PUBLIC_ITEM_COLUMNS = 'operation_id, serial_number, expected_version, position, status, message, transaction_hash, block_number';

function createEnterprise({ pool, provider, contractAddress, chainId, rpcUrl, readProduct, logger = console,
  signerFactory = getSubaccountSigner, ownerFactory = getContractOwnerWallet, fund = fundSubaccount }) {
  const chainCache = new Map();
  let running = false;
  async function network() {
    if (!provider || !contractAddress) fail('Blockchain connection is unavailable.', 503);
    if (String((await provider.getNetwork()).chainId) !== String(chainId)) fail('Blockchain network mismatch.', 503);
  }
  async function productChain(serial, fresh = false) {
    const previous = chainCache.get(serial);
    if (!fresh && previous && Date.now() - previous.at < 10000) return previous.value;
    const value = chainProduct(await readProduct(serial), serial, contractAddress, chainId);
    if (chainCache.size > 1000) chainCache.clear();
    chainCache.set(serial, { value, at: Date.now() });
    return value;
  }
  async function account(user, db = pool) {
    const { rows } = await db.query('SELECT username, role, token_version FROM auth WHERE username = $1', [user.username]);
    const row = rows[0];
    if (!row || Number(row.token_version || 0) !== Number(user.tokenVersion || 0)) fail('Please sign in again.', 401);
    if (!ROLES.includes(row.role) || row.role !== user.role) fail('Account permissions changed. Please sign in again.', 401);
    return row;
  }
  async function facility(user, id, db = pool, active = true) {
    if (user.role === 'admin' && id === `admin:${user.username}`) {
      return { id, parent_username: user.username, role: 'admin', subaccount_name: 'SmartScan administration', status: 'active' };
    }
    if (!/^\d+$/.test(String(id))) fail('Select an operating facility.');
    const { rows } = await db.query('SELECT * FROM facility_subaccounts WHERE id = $1 AND parent_username = $2', [id, user.username]);
    const f = rows[0];
    if (!f || f.role !== user.role) fail('This facility does not belong to your account.', 403);
    if (active && f.status !== 'active') fail('This facility wallet is not active. Ask an administrator to approve it.', 403);
    return f;
  }
  async function operations(user, requestKey) {
    const { rows } = await pool.query(`SELECT * FROM enterprise_operations WHERE ${user.role === 'admin' ? 'true' : 'username = $1'}
      ${requestKey ? `AND request_key = $${user.role === 'admin' ? 1 : 2} AND username = $${user.role === 'admin' ? 2 : 1}` : ''}
      ORDER BY created_at DESC LIMIT 200`,
    requestKey ? user.role === 'admin' ? [requestKey, user.username] : [user.username, requestKey] : user.role === 'admin' ? [] : [user.username]);
    if (!rows.length) return [];
    const items = await pool.query(`SELECT ${PUBLIC_ITEM_COLUMNS} FROM enterprise_operation_items WHERE operation_id = ANY($1::uuid[]) ORDER BY position`, [rows.map(r => r.id)]);
    return rows.map(row => operationDto(row, items.rows.filter(i => i.operation_id === row.id)));
  }
  async function submit(user, body) {
    await account(user);
    const { requestKey, action, facilityId, items, recipientId = null, reason = '' } = body || {};
    if (!UUID.test(requestKey || '') || !ACTIONS.includes(action) || !Array.isArray(items) || !items.length || items.length > 50
        || items.some(i => !SERIAL.test(i.productId || '') || !Number.isInteger(i.expectedVersion) || i.expectedVersion < 0)
        || new Set(items.map(i => i.productId)).size !== items.length) fail('Provide a request ID and between 1 and 50 distinct products.');
    if (recipientId !== null && !/^\d+$/.test(String(recipientId))) fail('Invalid recipient facility.');
    if (!limited(reason, 500, action === 'recall')) fail('Provide a recall reason of up to 500 UTF-8 bytes.');
    const location = normalizeLocation(body.location);
    const fingerprint = createHash('sha256').update(JSON.stringify({ action, facilityId: String(facilityId),
      items, recipientId, reason, location })).digest('hex');
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`enterprise-request:${user.username}:${requestKey}`]);
      const old = await db.query('SELECT * FROM enterprise_operations WHERE username = $1 AND request_key = $2', [user.username, requestKey]);
      if (old.rows[0]) {
        if (old.rows[0].request_fingerprint !== fingerprint) fail('This request ID was already used for different details.', 409);
        const existingItems = await db.query(`SELECT ${PUBLIC_ITEM_COLUMNS} FROM enterprise_operation_items WHERE operation_id=$1 ORDER BY position`, [old.rows[0].id]);
        await db.query('COMMIT');
        return operationDto(old.rows[0], existingItems.rows);
      }
      const f = await facility(user, facilityId, db);
      const permitted = { register: ['manufacturer'], dispatch: ['manufacturer', 'supplier'], receive: ['supplier', 'retailer'], sell: ['retailer'], recall: ['manufacturer', 'admin'] };
      if (!permitted[action].includes(f.role)) fail('Your facility cannot perform this action.', 403);
      if (recipientId) {
        if (action !== 'dispatch') fail('A recipient is only valid for dispatch.');
        const r = await db.query('SELECT role, status FROM facility_subaccounts WHERE id = $1', [recipientId]);
        if (String(f.id) === String(recipientId) || r.rows[0]?.status !== 'active'
            || !(f.role === 'manufacturer' ? ['supplier'] : ['supplier', 'retailer']).includes(r.rows[0]?.role)) fail('Choose an eligible active recipient.');
      }
      const id = randomUUID();
      const inserted = await db.query(`INSERT INTO enterprise_operations(id,username,request_key,request_fingerprint,facility_id,action,recipient_id,reason,location,token_version)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [id, user.username, requestKey, fingerprint, String(facilityId), action, recipientId, reason, location, Number(user.tokenVersion || 0)]);
      for (let position = 0; position < items.length; position++) {
        const item = items[position];
        const product = await db.query('SELECT manufacturer_username FROM product WHERE serialnumber = $1', [item.productId]);
        if (!product.rows.length) fail('A selected product is not registered in SmartScan.', 404);
        if (action === 'register' && product.rows[0].manufacturer_username !== user.username) fail('Only the owning manufacturer can register this item.', 403);
        await db.query(`INSERT INTO enterprise_operation_items(operation_id,serial_number,expected_version,position) VALUES($1,$2,$3,$4)`, [id, item.productId, item.expectedVersion, position]);
      }
      const insertedItems = await db.query(`SELECT ${PUBLIC_ITEM_COLUMNS} FROM enterprise_operation_items WHERE operation_id=$1 ORDER BY position`, [id]);
      await db.query('COMMIT');
      return operationDto(inserted.rows[0], insertedItems.rows);
    } catch (error) {
      await db.query('ROLLBACK');
      if (error.code === '23505') fail('An operation for one of these products is already in progress. Check Activity.', 409);
      throw error;
    } finally { db.release(); }
  }

  async function finish(db, item, status, message, receipt) {
    await db.query('BEGIN');
    try {
      await db.query(`UPDATE enterprise_operation_items SET status=$3,message=$4,block_number=$5,updated_at=now()
        WHERE operation_id=$1 AND serial_number=$2`, [item.operation_id, item.serial_number, status, message, receipt?.blockNumber || null]);
      if (item.action === 'register') {
        await db.query(`UPDATE product SET chain_status=$2,chain_tx_hash=COALESCE($3,chain_tx_hash),failure_reason=$4,
          chain_id=$5,chain_updated_at=now() WHERE serialnumber=$1 AND (chain_status <> 'confirmed' OR $2='confirmed')`,
        [item.serial_number, status === 'confirmed' ? 'confirmed' : 'failed', item.transaction_hash, message, String(chainId)]);
        await db.query(`UPDATE product_chain_attempts SET status=$2,transaction_hash=COALESCE($3,transaction_hash),
          failure_reason=$4,finalized_at=now() WHERE serial_number=$1 AND (status <> 'confirmed' OR $2='confirmed') AND attempt_number=(SELECT chain_attempt FROM product WHERE serialnumber=$1)`,
        [item.serial_number, status === 'confirmed' ? 'confirmed' : 'failed', item.transaction_hash, message]);
      }
      await db.query('COMMIT');
      chainCache.delete(item.serial_number);
    } catch (error) { await db.query('ROLLBACK'); throw error; }
  }

  async function processItem(db, item) {
    // A stored signed payload is immutable. Never create another transaction for
    // this item even after RPC timeouts, dropped HTTP responses or a restart.
    if (!item.signed_transaction) {
      try {
        const auth = await db.query('SELECT username,role,token_version FROM auth WHERE username=$1', [item.username]);
        const user = auth.rows[0];
        if (!user || Number(user.token_version) !== Number(item.token_version)) fail('Session was revoked before signing. Sign in and review the action again.');
        const f = await facility(user, item.facility_id, db);
        const chain = await productChain(item.serial_number, true);
        if ((chain.history?.length || 0) !== item.expected_version) fail('Product custody changed. Refresh and review its current state.');
        if (item.action === 'register' && chain.exists) fail('This product has already been registered.');
        const signer = f.role === 'admin' ? ownerFactory(rpcUrl, chainId)?.connect(provider) : signerFactory({
          encryptedPrivateKey: f.encrypted_private_key, keyIv: f.key_iv, keyAuthTag: f.key_auth_tag,
          keyVersion: f.key_version, walletAddress: f.wallet_address,
        }, provider);
        if (!signer) fail('The integrated wallet is not configured. Contact the administrator.');
        const contract = new ethers.Contract(contractAddress, ABI, signer);
        if (Number(await contract.roles(signer.address)) !== ROLES.indexOf(f.role)) fail('Wallet approval on the blockchain is missing. Contact the administrator.');
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const location = chainLocation(item.location);
        let transaction;
        if (item.action === 'register') {
          const result = await db.query('SELECT * FROM product WHERE serialnumber=$1 AND manufacturer_username=$2', [item.serial_number, item.username]);
          const p = result.rows[0];
          if (!p) fail('Only the owning manufacturer can register this item.');
          if (p.chain_sender?.toLowerCase() !== signer.address.toLowerCase()) fail('This product belongs to another manufacturing facility.');
          transaction = await contract.registerProduct.populateTransaction(p.name, p.brand, p.serialnumber,
            p.chain_description || '', p.chain_image || '', f.subaccount_name, location, timestamp);
        } else if (item.action === 'dispatch') {
          const r = item.recipient_id ? (await db.query("SELECT wallet_address FROM facility_subaccounts WHERE id=$1 AND status='active'", [item.recipient_id])).rows[0] : null;
          if (item.recipient_id && !r) fail('The recipient is no longer active.');
          transaction = await contract.dispatchProduct.populateTransaction(item.serial_number, r?.wallet_address || ethers.ZeroAddress, f.subaccount_name, location, timestamp);
        } else if (item.action === 'recall') {
          transaction = await contract.recallProduct.populateTransaction(item.serial_number, item.reason, f.subaccount_name, location, timestamp);
        } else {
          transaction = await contract[item.action === 'receive' ? 'confirmDelivery' : 'markSold'].populateTransaction(item.serial_number, f.subaccount_name, location, timestamp);
        }
        // Simulation enforces contract custody/role rules before funding or signing.
        await provider.call({ ...transaction, from: signer.address });
        if (await provider.getBalance(signer.address) < ethers.parseEther('0.0002') && f.role !== 'admin') {
          // Serialize the shared treasury across facility workers.
          await db.query("SELECT pg_advisory_lock(hashtextextended('smartscan-treasury',0))");
          try {
            if (await provider.getBalance(signer.address) < ethers.parseEther('0.0002')) {
              await fund({ recipientWallet: signer.address, subaccountId: f.id, amountEth: '0.005', triggerReason: 'enterprise_operation', pool: db, rpcUrl, chainId });
            }
          } catch { fail('Wallet needs gas. Ask the administrator to fund the Sepolia treasury, then retry.'); }
          finally { await db.query("SELECT pg_advisory_unlock(hashtextextended('smartscan-treasury',0))"); }
        }
        const populated = await signer.populateTransaction(transaction);
        const signed = await signer.signTransaction(populated);
        const hash = ethers.keccak256(signed);
        // This commit must succeed before any broadcast. If the DB response is
        // lost, the next worker reads what committed instead of signing again.
        await db.query(`UPDATE enterprise_operation_items SET signed_transaction=$3,transaction_hash=$4,
          signer_address=$5,transaction_nonce=$6,status='submitted',message=NULL,updated_at=now()
          WHERE operation_id=$1 AND serial_number=$2 AND signed_transaction IS NULL`,
        [item.operation_id, item.serial_number, signed, hash, signer.address, populated.nonce]);
        item.signed_transaction = signed; item.transaction_hash = hash;
      } catch (error) {
        // A failed persistence response is ambiguous; re-read on the next pass.
        // Only deterministic preflight failures are terminal before signing.
        if (error.status || error.code === 'CALL_EXCEPTION' || error.code === 'INSUFFICIENT_FUNDS') {
          const current = await db.query('SELECT signed_transaction FROM enterprise_operation_items WHERE operation_id=$1 AND serial_number=$2', [item.operation_id, item.serial_number]);
          if (!current.rows[0]?.signed_transaction) await finish(db, item, 'failed', error.status ? error.message : error.code === 'INSUFFICIENT_FUNDS' ? 'Wallet needs gas. Contact the administrator.' : 'The contract rejected this action. Refresh the product and check custody and wallet approval.');
        }
        return;
      }
    }
    try {
      const receipt = await provider.getTransactionReceipt(item.transaction_hash);
      if (receipt && await receipt.confirmations() >= 2) {
        await finish(db, item, receipt.status === 1 ? 'confirmed' : 'failed', receipt.status === 1 ? null : 'The blockchain rejected this action. Refresh before retrying.', receipt);
      } else if (!receipt) {
        // Rebroadcast identical bytes: same nonce, same hash, same transaction.
        await provider.broadcastTransaction(item.signed_transaction);
      }
    } catch {
      // An RPC error is not proof of failure. Leave the item pending and retain
      // the original hash; recovery never signs a replacement automatically.
    }
  }
  async function tick() {
    if (running) return;
    running = true;
    try {
      await network();
      const { rows } = await pool.query(`SELECT DISTINCT o.facility_id FROM enterprise_operations o JOIN enterprise_operation_items i ON i.operation_id=o.id WHERE i.status IN ('queued','submitted') LIMIT 20`);
      for (const row of rows) {
        const db = await pool.connect();
        let locked = false;
        const lockKey = row.facility_id.startsWith('admin:') ? 'smartscan-wallet:admin' : `smartscan-wallet:${row.facility_id}`;
        try {
          const lock = await db.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [lockKey]);
          locked = lock.rows[0]?.locked;
          if (!locked) continue;
          const pending = await db.query(`SELECT i.*,o.username,o.facility_id,o.action,o.recipient_id,o.reason,o.location,o.token_version
            FROM enterprise_operation_items i JOIN enterprise_operations o ON o.id=i.operation_id
            WHERE (o.facility_id=$1 OR ($2=true AND o.facility_id LIKE 'admin:%')) AND i.status IN ('queued','submitted') ORDER BY o.created_at,i.position LIMIT 1`, [row.facility_id, row.facility_id.startsWith('admin:')]);
          if (pending.rows[0]) await processItem(db, pending.rows[0]);
        } finally {
          if (locked) await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [lockKey]);
          db.release();
        }
      }
    } catch { logger.error('Enterprise operation recovery unavailable; pending transactions retained.'); }
    finally { running = false; }
  }
  return { account, facility, operations, submit, tick, productChain, network };
}

module.exports = { createEnterprise, operationDto, normalizeLocation, chainLocation, SERIAL, ROLES, limited, fail };
