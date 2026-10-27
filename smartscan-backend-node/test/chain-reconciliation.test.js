const test = require('node:test');
const assert = require('node:assert/strict');
const { ethers } = require('ethers');
const { registrationInterface, verifyRegistration } = require('../chain-reconciliation');
const { reconcile } = require('../reconcile');

const contractAddress = '0x0000000000000000000000000000000000000022';
const sender = '0x0000000000000000000000000000000000000011';
const serialNumber = 'SS-00000000-0000-0000-0000-000000000011';
const txHash = `0x${'a'.repeat(64)}`;

function chainObjects({ status = 1, to = contractAddress, from = sender, chainId = 11155111, serial = serialNumber, manufacturer = sender } = {}) {
  const encoded = registrationInterface.encodeEventLog(registrationInterface.getEvent('ProductRegistered'), [serial, 'Bag', 'Brand', manufacturer]);
  const transaction = { hash: txHash, to, from, chainId };
  const receipt = { transactionHash: txHash, status, blockNumber: 10, logs: [{ address: contractAddress, ...encoded }] };
  return { transaction, receipt };
}

function fakePool(product) {
  const updates = [];
  return {
    updates,
    async query(sql, params = []) {
      const query = sql.toLowerCase();
      if (query.includes('select p.serialnumber, p.chain_status')) return { rows: [product] };
      if (query.includes('update product set chain_reconciled_at')) { updates.push({ query, params }); return { rowCount: 1, rows: [] }; }
      if (query.includes('update product set chain_event_scan_block')) { updates.push({ query, params }); product.chain_event_scan_block = params[1]; return { rowCount: 1, rows: [] }; }
      if (query.includes('update product set chain_status')) {
        updates.push({ query, params });
        product.chain_status = query.includes("chain_status = 'confirmed'") ? 'confirmed' : query.includes("chain_status = 'needs_retry'") ? 'needs_retry' : params[0];
        if (query.includes("chain_status = 'confirmed'")) product.chain_tx_hash = params[0];
        return { rowCount: 1, rows: [] };
      }
      if (query.includes('update product_chain_attempts')) { updates.push({ query, params }); return { rowCount: 1, rows: [] }; }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

function mockContract(events) {
  return {
    filters: { ProductRegistered: (...args) => args },
    async queryFilter() { return events; },
  };
}

function mockProvider(objects = {}) {
  return {
    async getNetwork() { return { chainId: 11155111 }; },
    async getCode() { return '0x6000'; },
    async getBlockNumber() { return 11; },
    async getTransaction() { return objects.transaction || null; },
    async getTransactionReceipt() { return objects.receipt || null; },
  };
}

test('receipt verification requires expected chain, contract, sender and ProductRegistered identifier', () => {
  const objects = chainObjects();
  assert.equal(verifyRegistration({ ...objects, contractAddress, expectedChainId: 11155111, serialNumber, expectedSender: sender }).ok, true);
  assert.equal(verifyRegistration({ ...objects, transaction: { ...objects.transaction, chainId: 1 }, contractAddress, expectedChainId: 11155111, serialNumber, expectedSender: sender }).ok, false);
  assert.equal(verifyRegistration({ ...objects, transaction: { ...objects.transaction, to: sender }, contractAddress, expectedChainId: 11155111, serialNumber, expectedSender: sender }).ok, false);
  assert.equal(verifyRegistration({ ...objects, receipt: chainObjects({ serial: 'SS-00000000-0000-0000-0000-000000000012' }).receipt, contractAddress, expectedChainId: 11155111, serialNumber, expectedSender: sender }).ok, false);
});

test('reconciler recovers a successful product event when the browser never saved its hash', async () => {
  const objects = chainObjects();
  const product = { serialnumber: serialNumber, chain_status: 'pending_wallet', chain_tx_hash: null, chain_attempt: 1, chain_sender: null, linked_wallet: sender, created_at: new Date(0) };
  const pool = fakePool(product);
  await reconcile({
    pool, provider: mockProvider(objects), registrationContract: mockContract([{ transactionHash: txHash }]),
    contractAddress, expectedChainId: 11155111, deploymentBlock: 1,
  });
  assert.equal(product.chain_status, 'confirmed');
  assert.equal(product.chain_tx_hash, txHash);
  assert.equal(pool.updates.length, 3);
});

test('reconciler moves expired wallet prompts with no hash/event to needs_retry', async () => {
  const product = { serialnumber: serialNumber, chain_status: 'pending_wallet', chain_tx_hash: null, chain_attempt: 1, chain_sender: sender, linked_wallet: sender, created_at: new Date(0) };
  const pool = fakePool(product);
  await reconcile({
    pool, provider: mockProvider(), registrationContract: mockContract([]), contractAddress,
    expectedChainId: 11155111, deploymentBlock: 1, now: new Date(60_000), hashlessTimeoutMs: 30_000,
  });
  assert.equal(product.chain_status, 'needs_retry');
});

test('reconciler does not confirm a successful receipt without the expected registration event', async () => {
  const objects = chainObjects({ serial: 'SS-00000000-0000-0000-0000-000000000012' });
  const product = { serialnumber: serialNumber, chain_status: 'submitted', chain_tx_hash: txHash, chain_attempt: 1, chain_sender: sender, linked_wallet: sender, chain_submitted_at: new Date(0), created_at: new Date(0) };
  const pool = fakePool(product);
  await reconcile({
    pool, provider: mockProvider(objects), registrationContract: mockContract([]), contractAddress,
    expectedChainId: 11155111, deploymentBlock: 1,
  });
  assert.equal(product.chain_status, 'failed');
});
