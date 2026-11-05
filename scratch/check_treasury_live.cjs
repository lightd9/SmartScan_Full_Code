const path = require('path');
const fs = require('fs');

const envPath = path.resolve('smartscan-backend-node/.env');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const treasury = require(path.resolve('smartscan-backend-node/gas-treasury.js'));

async function main() {
  const status = await treasury.getTreasuryStatus('https://ethereum-sepolia-rpc.publicnode.com');
  console.log('\n========================================');
  console.log('⚡ PHASE 4B: AUTOMATED GAS TREASURY STATUS');
  console.log('========================================');
  console.log('Configured:           ', status.configured);
  console.log('Treasury Address:     ', status.address);
  console.log('Sepolia Balance:      ', status.balanceEth, 'ETH');
  console.log('Ready for Auto-Funding:', status.canFund ? 'YES (Balance >= 0.005 ETH)' : 'NO');
  console.log('========================================\n');
}

main().catch(console.error);

