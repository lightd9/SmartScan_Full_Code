require('dotenv').config();

const { ethers } = require('ethers');
const { createPool } = require('./db');
const { REGISTRATION_ABI, verifyRegistration } = require('./chain-reconciliation');
const { loadReconciliationWorkerSettings } = require('./worker-config');

async function reconcile({ pool, provider, registrationContract, contractAddress, expectedChainId, deploymentBlock, now = new Date(), hashlessTimeoutMs = 15 * 60 * 1000, submittedTimeoutMs = 24 * 60 * 60 * 1000, confirmations = 2 }) {
  if (!Number.isSafeInteger(Number(expectedChainId)) || Number(expectedChainId) <= 0) throw new Error('CHAIN_ID must be a positive integer');
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== Number(expectedChainId)) throw new Error(`RPC chain ID ${network.chainId} does not match configured chain ID ${expectedChainId}`);
  if (!ethers.isAddress(contractAddress || '') || ethers.getAddress(contractAddress) === ethers.ZeroAddress) throw new Error('A valid CONTRACT_ADDRESS is required');
  if (!Number.isSafeInteger(Number(deploymentBlock)) || Number(deploymentBlock) < 0) throw new Error('CONTRACT_DEPLOYMENT_BLOCK must be a non-negative integer');
  if (!Number.isSafeInteger(confirmations) || confirmations < 1) throw new Error('RECONCILE_CONFIRMATIONS must be a positive integer');
  if (!Number.isFinite(hashlessTimeoutMs) || hashlessTimeoutMs < 0 || !Number.isFinite(submittedTimeoutMs) || submittedTimeoutMs < 0) throw new Error('Reconciliation timeouts must be non-negative numbers');
  const address = ethers.getAddress(contractAddress);
  if ((await provider.getCode(address)) === '0x') throw new Error('Configured contract address has no bytecode on the configured chain');
  const contract = registrationContract || new ethers.Contract(address, REGISTRATION_ABI, provider);
  const latestBlock = await provider.getBlockNumber();
  const safeThroughBlock = latestBlock - confirmations + 1;
  const { rows } = await pool.query(
    `SELECT p.serialnumber, p.chain_status, p.chain_tx_hash, p.chain_attempt,
            p.chain_sender, p.chain_contract_address, p.chain_event_scan_block, p.chain_reconciled_at, p.created_at, p.chain_submitted_at,
            a.wallet_address AS linked_wallet
       FROM product p
       LEFT JOIN auth a ON a.username = p.manufacturer_username
      WHERE p.chain_status IN ('pending_wallet', 'submitted', 'failed', 'needs_retry')
      ORDER BY COALESCE(p.chain_reconciled_at, p.created_at) ASC LIMIT 500`,
  );

  for (const product of rows) {
    await pool.query('UPDATE product SET chain_reconciled_at = now() WHERE serialnumber = $1 AND chain_status <> \'confirmed\'', [product.serialnumber]);
    const sender = product.chain_sender || product.linked_wallet;
    if (!sender || !ethers.isAddress(sender)) continue;

    // A successful event is authoritative even if the browser died before it could persist
    // the hash, or if a later retry's transaction reverted after the original was mined.
    const scanFromBlock = product.chain_event_scan_block == null
      ? Number(deploymentBlock)
      : Math.max(Number(deploymentBlock), Number(product.chain_event_scan_block));
    const matchingEvents = safeThroughBlock >= scanFromBlock
      ? await contract.queryFilter(contract.filters.ProductRegistered(product.serialnumber, sender), scanFromBlock, safeThroughBlock)
      : [];
    const eventHashes = [...new Set(matchingEvents.map((event) => event.transactionHash))];
    let confirmedHash = null;
    for (const hash of eventHashes) {
      const [transaction, receipt] = await Promise.all([provider.getTransaction(hash), provider.getTransactionReceipt(hash)]);
      if (!receipt || latestBlock - receipt.blockNumber + 1 < confirmations) continue;
      const verification = verifyRegistration({ transaction, receipt, contractAddress: address, expectedChainId, serialNumber: product.serialnumber, expectedSender: sender });
      if (verification.ok) { confirmedHash = hash; break; }
    }
    if (confirmedHash) {
      await pool.query(
        `UPDATE product SET chain_status = 'confirmed', chain_tx_hash = $1, chain_id = $2, chain_expected_id = $2,
                chain_sender = $3, chain_contract_address = $4, chain_event_scan_block = $5, failure_reason = NULL, chain_updated_at = now()
          WHERE serialnumber = $6 AND chain_status <> 'confirmed'`,
        [confirmedHash, String(expectedChainId), sender, address, safeThroughBlock, product.serialnumber],
      );
      await pool.query(
        `UPDATE product_chain_attempts SET status = 'confirmed', transaction_hash = $1, chain_id = $2, expected_chain_id = $2,
                sender_address = $3, contract_address = $4, failure_reason = NULL, recovered_from_chain = $5, finalized_at = now()
          WHERE serial_number = $6 AND attempt_number = $7`,
        [confirmedHash, String(expectedChainId), sender, address, !product.chain_tx_hash || product.chain_tx_hash.toLowerCase() !== confirmedHash.toLowerCase(), product.serialnumber, product.chain_attempt || 1],
      );
      console.log(`${product.serialnumber}: confirmed by ProductRegistered event (${confirmedHash})`);
      continue;
    }

    if (safeThroughBlock >= scanFromBlock) {
      const eventBlock = matchingEvents.length ? Math.min(...matchingEvents.map((event) => event.blockNumber)) : safeThroughBlock;
      await pool.query(
        `UPDATE product SET chain_event_scan_block = GREATEST(COALESCE(chain_event_scan_block, $1), $2)
          WHERE serialnumber = $3 AND chain_status <> 'confirmed'
            AND (chain_event_scan_block IS NULL OR chain_event_scan_block < $2)`,
        [Number(deploymentBlock), eventBlock, product.serialnumber],
      );
    }

    if (product.chain_status === 'submitted' && product.chain_tx_hash) {
      const [transaction, receipt] = await Promise.all([
        provider.getTransaction(product.chain_tx_hash), provider.getTransactionReceipt(product.chain_tx_hash),
      ]);
      if (!receipt || !transaction) {
        const submittedAt = product.chain_submitted_at ? new Date(product.chain_submitted_at).getTime() : new Date(product.created_at).getTime();
        if (now.getTime() - submittedAt < submittedTimeoutMs) continue; // RPC may not have observed/built the transaction yet.
        const reason = 'No receipt or registration event was found before the submitted transaction timeout';
        await pool.query(`UPDATE product SET chain_status = 'needs_retry', failure_reason = $1, chain_updated_at = now() WHERE serialnumber = $2 AND chain_status = 'submitted' AND chain_tx_hash = $3`, [reason, product.serialnumber, product.chain_tx_hash]);
        await pool.query(`UPDATE product_chain_attempts SET status = 'needs_retry', failure_reason = $1, finalized_at = now() WHERE serial_number = $2 AND attempt_number = $3`, [reason, product.serialnumber, product.chain_attempt || 1]);
        console.log(`${product.serialnumber}: needs_retry`);
        continue;
      }
      if (latestBlock - receipt.blockNumber + 1 < confirmations) continue;
      const verification = verifyRegistration({ transaction, receipt, contractAddress: address, expectedChainId, serialNumber: product.serialnumber, expectedSender: sender });
      const reason = verification.ok ? null : verification.reason;
      const status = verification.ok ? 'confirmed' : 'failed';
      await pool.query(
        `UPDATE product SET chain_status = $1, chain_id = $2, chain_expected_id = $3, failure_reason = $4, chain_updated_at = now()
          WHERE serialnumber = $5 AND chain_status = 'submitted' AND chain_tx_hash = $6`,
        [status, String(transaction.chainId), String(expectedChainId), reason, product.serialnumber, product.chain_tx_hash],
      );
      await pool.query(
        `UPDATE product_chain_attempts SET status = $1, chain_id = $2, expected_chain_id = $3, failure_reason = $4, finalized_at = now()
          WHERE serial_number = $5 AND attempt_number = $6`,
        [status, String(transaction.chainId), String(expectedChainId), reason, product.serialnumber, product.chain_attempt || 1],
      );
      console.log(`${product.serialnumber}: ${status}${reason ? ` (${reason})` : ''}`);
      continue;
    }

    if (product.chain_status === 'pending_wallet' && now.getTime() - new Date(product.created_at).getTime() >= hashlessTimeoutMs) {
      const reason = 'No transaction hash or registration event was found before the wallet submission timeout';
      await pool.query(
        `UPDATE product SET chain_status = 'needs_retry', failure_reason = $1, chain_updated_at = now()
          WHERE serialnumber = $2 AND chain_status = 'pending_wallet' AND chain_tx_hash IS NULL`,
        [reason, product.serialnumber],
      );
      await pool.query(
        `UPDATE product_chain_attempts SET status = 'needs_retry', failure_reason = $1, finalized_at = now()
          WHERE serial_number = $2 AND attempt_number = $3 AND status = 'pending_wallet'`,
        [reason, product.serialnumber, product.chain_attempt || 1],
      );
      console.log(`${product.serialnumber}: needs_retry`);
    }
  }
}

async function main() {
  const workerSettings = loadReconciliationWorkerSettings();
  const rpcUrl = process.env.CHAIN_RPC_URL || process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_QUICKNODE_KEY;
  if (!rpcUrl) throw new Error('CHAIN_RPC_URL or SEPOLIA_RPC_URL is required');
  const pool = createPool();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  try {
    await reconcile({
      pool,
      provider,
      contractAddress: process.env.CONTRACT_ADDRESS,
      expectedChainId: Number(process.env.CHAIN_ID || 11155111),
      deploymentBlock: process.env.CONTRACT_DEPLOYMENT_BLOCK,
      hashlessTimeoutMs: workerSettings.hashlessTimeoutMs,
      submittedTimeoutMs: workerSettings.submittedTimeoutMs,
      confirmations: workerSettings.confirmations,
    });
  } finally {
    await pool.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { reconcile };
