const { ethers } = require('ethers');

const ROLE_IDS = { admin: 1, manufacturer: 2, supplier: 3, retailer: 4 };
const roleInterface = new ethers.Interface([
  'function grantRole(address account, uint8 role, string businessName)',
  'function revokeRole(address account)',
  'function replaceRole(address oldWallet, address newWallet, string businessName)',
  'event RoleGranted(address indexed account, uint8 role)',
  'event RoleRevoked(address indexed account, uint8 role)',
  'event RoleReplaced(address indexed previousWallet, address indexed newWallet, uint8 role)',
]);

function expectedCall(operation) {
  const role = ROLE_IDS[operation.role];
  if (!role) return null;
  if (operation.action === 'link') return { method: 'grantRole', args: [operation.new_wallet_address, role, operation.business_name] };
  if (operation.action === 'replace') return { method: 'replaceRole', args: [operation.old_wallet_address, operation.new_wallet_address, operation.business_name] };
  if (operation.action === 'restore') return { method: 'grantRole', args: [operation.old_wallet_address, role, operation.business_name] };
  if (['suspend', 'revoke'].includes(operation.action)) return { method: 'revokeRole', args: [operation.old_wallet_address] };
  return null;
}

function hasExpectedWalletOperationEvent(receipt, contractAddress, operation) {
  const expectedRole = ROLE_IDS[operation.role];
  const oldWallet = operation.old_wallet_address?.toLowerCase();
  const newWallet = operation.new_wallet_address?.toLowerCase();
  if (!expectedRole || !contractAddress) return false;
  const roleEvents = [];
  for (const log of receipt?.logs || []) {
    if (!log.address || log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
    let event;
    try { event = roleInterface.parseLog(log); } catch (_parseError) { continue; }
    if (event) roleEvents.push(event);
  }
  const expectedEvents = operation.action === 'link'
    ? [['RoleGranted', (args) => args.account.toLowerCase() === newWallet && Number(args.role) === expectedRole]]
    : operation.action === 'replace'
      ? [
        ['RoleRevoked', (args) => args.account.toLowerCase() === oldWallet && Number(args.role) === expectedRole],
        ['RoleGranted', (args) => args.account.toLowerCase() === newWallet && Number(args.role) === expectedRole],
        ['RoleReplaced', (args) => args.previousWallet.toLowerCase() === oldWallet && args.newWallet.toLowerCase() === newWallet && Number(args.role) === expectedRole],
      ]
      : operation.action === 'restore'
        ? [['RoleGranted', (args) => args.account.toLowerCase() === oldWallet && Number(args.role) === expectedRole]]
        : ['suspend', 'revoke'].includes(operation.action)
          ? [['RoleRevoked', (args) => args.account.toLowerCase() === oldWallet && Number(args.role) === expectedRole]]
          : [];
  if (roleEvents.length !== expectedEvents.length) return false;
  return expectedEvents.every(([eventName, matches], index) => roleEvents[index]?.name === eventName && matches(roleEvents[index].args));
}

function isDirectOwnerWalletOperation(transaction, owner, contractAddress, operation) {
  const expected = expectedCall(operation);
  if (!expected || !transaction?.to || !transaction?.from
    || transaction.to.toLowerCase() !== contractAddress.toLowerCase()
    || transaction.from.toLowerCase() !== owner.toLowerCase()) return false;
  let parsed;
  try { parsed = roleInterface.parseTransaction({ data: transaction.data }); } catch (_parseError) { return false; }
  if (!parsed || parsed.name !== expected.method || parsed.args.length !== expected.args.length) return false;
  return expected.args.every((value, index) => {
    const actual = parsed.args[index];
    return typeof value === 'string' && value.startsWith('0x')
      ? actual.toLowerCase() === value.toLowerCase()
      : String(actual) === String(value);
  });
}

module.exports = { expectedCall, hasExpectedWalletOperationEvent, isDirectOwnerWalletOperation };
