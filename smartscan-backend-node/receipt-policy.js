const { ethers } = require('ethers');
const TRANSFER_TYPES = { Transfer: [
  { name: 'serialHash', type: 'bytes32' }, { name: 'sender', type: 'address' }, { name: 'receiver', type: 'address' },
  { name: 'version', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }, { name: 'deadline', type: 'uint256' },
  { name: 'senderEpoch', type: 'uint256' }, { name: 'receiverEpoch', type: 'uint256' }, { name: 'authorizationEpoch', type: 'uint256' },
] };
const RECEIPT_ABI = [
  'function credentialEpoch(address) view returns(uint256)',
  'function authorizationEpoch(string) view returns(uint256)',
  'function confirmReceipt(string,(bytes32 serialHash,address sender,address receiver,uint256 version,bytes32 nonce,uint256 deadline,uint256 senderEpoch,uint256 receiverEpoch,uint256 authorizationEpoch),bytes,string)',
  'function invalidateAuthorizations(string)',
];
const domain = (chainId, contractAddress) => ({ name: 'SmartScanReceipt', version: '3', chainId, verifyingContract: contractAddress });
const eligible = (sender, receiver) => sender === 'manufacturer' ? receiver === 'supplier' : sender === 'supplier' && ['supplier','retailer'].includes(receiver);
function receiptHistoryConflict(raw) {
  const h = raw?.[5];
  if (!h?.length || Number(h[0][5]) !== 0 || Number(h[0][7]) !== 2) return true;
  let stage = 1, senderRole = 2, custodian = h[0][2];
  for (let i=0; i<h.length; i++) {
    const event = h[i], action = Number(event[5]), role = Number(event[7]);
    if (Number(event[0]) !== i+1 || !ethers.isAddress(event[2]) || event[2] === ethers.ZeroAddress || event[6] !== ethers.ZeroAddress) return true;
    if (!i) continue;
    if (action === 2 && [1,3].includes(stage) && event[2].toLowerCase() !== custodian.toLowerCase()
      && eligible(['','','manufacturer','supplier','retailer'][senderRole], ['','','manufacturer','supplier','retailer'][role])) {
      stage = 3; senderRole = role; custodian = event[2];
    } else if (action === 3 && stage === 3 && role === 4 && [custodian,raw[7]].some(w=>w.toLowerCase()===event[2].toLowerCase())) stage = 4;
    else if (action === 4 && stage !== 5 && [1,2].includes(role)) stage = 5;
    else return true;
  }
  // Wallet replacement can change the resolved custodian without rewriting history.
  return Number(raw[6]) !== stage || Boolean(raw[10]) !== (stage === 5) || (stage === 4 && !raw[9]) || ([1,3].includes(stage) && raw[9]);
}
module.exports = { TRANSFER_TYPES, RECEIPT_ABI, domain, eligible, receiptHistoryConflict };
