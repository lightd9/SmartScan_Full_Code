const { ethers } = require('ethers');

const REGISTRATION_ABI = [
  'event ProductRegistered(string indexed serialNumber, string name, string brand, address indexed manufacturer)',
];
const registrationInterface = new ethers.Interface(REGISTRATION_ABI);

function verifyRegistration({ transaction, receipt, contractAddress, expectedChainId, serialNumber, expectedSender }) {
  if (!transaction || !receipt) return { ok: false, reason: 'Transaction or receipt is unavailable' };
  if (transaction.hash && receipt.transactionHash && transaction.hash.toLowerCase() !== receipt.transactionHash.toLowerCase()) return { ok: false, reason: 'Receipt does not belong to the supplied transaction' };
  if (Number(transaction.chainId) !== Number(expectedChainId)) return { ok: false, reason: 'Transaction was sent on an unexpected chain' };
  if (!transaction.to || transaction.to.toLowerCase() !== contractAddress.toLowerCase()) return { ok: false, reason: 'Transaction did not target the configured contract' };
  if (receipt.to && receipt.to.toLowerCase() !== contractAddress.toLowerCase()) return { ok: false, reason: 'Receipt destination does not match the configured contract' };
  if (!transaction.from || transaction.from.toLowerCase() !== expectedSender.toLowerCase()) return { ok: false, reason: 'Transaction sender does not match the linked manufacturer wallet' };
  if (Number(receipt.status) !== 1) return { ok: false, failed: true, reason: 'Blockchain transaction reverted' };

  const registrationTopic = ethers.keccak256(ethers.toUtf8Bytes(serialNumber));
  const registration = (receipt.logs || []).filter((log) => log.address?.toLowerCase() === contractAddress.toLowerCase() && log.topics?.[1]?.toLowerCase() === registrationTopic.toLowerCase())
    .map((log) => { try { return registrationInterface.parseLog(log); } catch (_error) { return null; } })
    .find((event) => event && event.name === 'ProductRegistered' && event.args[3].toLowerCase() === expectedSender.toLowerCase());
  if (!registration) return { ok: false, failed: true, reason: 'Successful receipt did not register the expected product and manufacturer' };
  return { ok: true };
}

module.exports = { REGISTRATION_ABI, registrationInterface, verifyRegistration };
