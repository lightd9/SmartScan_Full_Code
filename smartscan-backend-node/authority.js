const { ethers } = require('ethers');
const READ_ABI = ['function getProduct(string) view returns (string,string,string,string,string,tuple(uint256 id,string actor,address actorWallet,string location,string timestamp,uint8 action,address recipientWallet,uint8 actorRole)[],uint8,address,address,bool,bool)'];
function createAuthority({ pool, provider, contractAddress, chainId, receiptAddress = process.env.RECEIPT_CONTRACT_ADDRESS, pilotAccounts = process.env.RECEIPT_PILOT_ACCOUNTS || '' }) {
  if(receiptAddress && (!ethers.isAddress(receiptAddress) || receiptAddress===ethers.ZeroAddress)) throw new Error('Invalid receipt contract configuration.');
  const legacy = { protocol: 'v2', contractAddress, chainId: String(chainId) };
  const receipt = receiptAddress && ethers.isAddress(receiptAddress) ? { protocol: 'receipt-v3', contractAddress: ethers.getAddress(receiptAddress), chainId: String(chainId) } : null;
  const pilot = new Set(pilotAccounts.split(',').map(s => s.trim()).filter(Boolean));
  async function resolve(serial, db = pool) {
    const row = (await db.query('SELECT chain_protocol,chain_contract_address,chain_expected_id FROM product WHERE serialnumber=$1', [serial])).rows[0];
    if (!row) return legacy;
    const selected = row.chain_protocol === 'receipt-v3' ? receipt : legacy;
    if (!selected || (row.chain_contract_address && row.chain_contract_address.toLowerCase() !== selected.contractAddress?.toLowerCase())
      || (row.chain_expected_id && String(row.chain_expected_id) !== String(chainId))) {
      const error = new Error('This product authority is not enabled on this server.'); error.status = 503; throw error;
    }
    return selected;
  }
  async function read(serial,db=pool) {
    const authority = await resolve(serial,db);
    const height=await provider.getBlockNumber();
    return new ethers.Contract(authority.contractAddress, READ_ABI, provider).getProduct(serial,{blockTag:Math.max(0,height-1)});
  }
  function forNew(username, clientVersion) {
    if (!receipt || !pilot.has(username)) return legacy;
    if (Number(clientVersion) < 3 || !clientVersion) { const error = new Error('Update SmartScan before creating products with this account.'); error.status = 426; throw error; }
    return receipt;
  }
  return { resolve, read, forNew, legacy, receipt, supported: [legacy, receipt].filter(Boolean) };
}
module.exports = { createAuthority, READ_ABI };
