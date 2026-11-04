const { ethers } = require('ethers');

/**
 * SmartScan Automated Gas Treasury Service
 * Disburses operational gas funds to newly approved subaccounts and manages auto-replenishment.
 */

function getTreasuryWallet(rpcUrl = null) {
  const privateKey = process.env.TREASURY_FAUCET_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) return null;
  const url = rpcUrl || process.env.CHAIN_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const provider = new ethers.JsonRpcProvider(url);
  return new ethers.Wallet(privateKey, provider);
}

async function getTreasuryStatus(rpcUrl = null) {
  const wallet = getTreasuryWallet(rpcUrl);
  if (!wallet) {
    return { configured: false, address: null, balanceEth: '0', canFund: false };
  }
  try {
    const balance = await wallet.provider.getBalance(wallet.address);
    const balanceEth = ethers.formatEther(balance);
    return {
      configured: true,
      address: wallet.address,
      balanceEth,
      canFund: parseFloat(balanceEth) >= 0.005,
    };
  } catch (err) {
    return { configured: true, address: wallet.address, error: err.message, canFund: false };
  }
}

/**
 * Automatically sends initial operational gas to an approved subaccount address.
 */
async function fundSubaccount({
  recipientWallet,
  subaccountId = null,
  amountEth = '0.005',
  triggerReason = 'onboarding_grant',
  pool = null,
  rpcUrl = null,
}) {
  const wallet = getTreasuryWallet(rpcUrl);
  if (!wallet) {
    throw new Error('Automated Gas Treasury is not configured. Missing TREASURY_FAUCET_PRIVATE_KEY.');
  }

  const cleanRecipient = ethers.getAddress(recipientWallet);
  const valueWei = ethers.parseEther(amountEth);

  const treasuryBalance = await wallet.provider.getBalance(wallet.address);
  if (treasuryBalance < valueWei) {
    throw new Error(`Treasury pool balance (${ethers.formatEther(treasuryBalance)} ETH) is insufficient to disburse ${amountEth} ETH.`);
  }

  // Submit transfer transaction
  const tx = await wallet.sendTransaction({
    to: cleanRecipient,
    value: valueWei,
  });

  const receipt = await tx.wait(1);

  // Record in PostgreSQL if pool is available
  if (pool) {
    try {
      await pool.query(
        'INSERT INTO gas_treasury_disbursements (subaccount_id, recipient_wallet, amount_wei, tx_hash, trigger_reason) VALUES ($1, $2, $3, $4, $5)',
        [subaccountId, cleanRecipient, valueWei.toString(), receipt.hash, triggerReason]
      );
      if (subaccountId) {
        await pool.query(
          'UPDATE facility_subaccounts SET last_funded_at = NOW(), gas_balance_wei = $1, updated_at = NOW() WHERE id = $2',
          [valueWei.toString(), subaccountId]
        );
      }
    } catch (dbErr) {
      console.warn('Treasury disbursement logging notice:', dbErr.message);
    }
  }

  return {
    success: true,
    txHash: receipt.hash,
    recipient: cleanRecipient,
    amountEth,
    blockNumber: receipt.blockNumber,
  };
}

module.exports = {
  getTreasuryWallet,
  getTreasuryStatus,
  fundSubaccount,
};

