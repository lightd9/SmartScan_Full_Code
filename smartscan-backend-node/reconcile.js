require('dotenv').config();

const { createPool } = require('./db');

const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_QUICKNODE_KEY;
if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL or SEPOLIA_QUICKNODE_KEY is required');

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'RPC request failed');
  return payload.result;
}

async function reconcile() {
  const pool = createPool();
  try {
    const { rows } = await pool.query(`SELECT serialnumber, chain_tx_hash FROM product WHERE chain_status = 'pending_chain' AND chain_tx_hash IS NOT NULL`);
    for (const row of rows) {
      const receipt = await rpc('eth_getTransactionReceipt', [row.chain_tx_hash]);
      if (!receipt) continue;
      const status = receipt.status === '0x1' ? 'confirmed' : 'failed';
      const reason = status === 'failed' ? 'Blockchain transaction reverted' : null;
      await pool.query(
        `UPDATE product SET chain_status = $1, chain_id = COALESCE(chain_id, $2), failure_reason = $3 WHERE serialnumber = $4 AND chain_status = 'pending_chain'`,
        [status, '11155111', reason, row.serialnumber],
      );
      console.log(`${row.serialnumber}: ${status}`);
    }
  } finally {
    await pool.end();
  }
}

reconcile().catch((error) => { console.error(error.message); process.exitCode = 1; });
