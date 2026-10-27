const assert = require('node:assert/strict');
const test = require('node:test');
const { ethers } = require('ethers');
const {
  expectedCall,
  hasExpectedWalletOperationEvent,
  isDirectOwnerWalletOperation,
} = require('../wallet-operation-verification');

const contractAddress = '0x00000000000000000000000000000000000000c0';
const oldWallet = '0x0000000000000000000000000000000000000011';
const newWallet = '0x0000000000000000000000000000000000000022';
const roleInterface = new ethers.Interface([
  'function grantRole(address account, uint8 role, string businessName)',
  'function revokeRole(address account)',
  'function replaceRole(address oldWallet, address newWallet, string businessName)',
  'event RoleGranted(address indexed account, uint8 role)',
  'event RoleRevoked(address indexed account, uint8 role)',
  'event RoleReplaced(address indexed previousWallet, address indexed newWallet, uint8 role)',
]);

function log(eventName, args, address = contractAddress) {
  const encoded = roleInterface.encodeEventLog(roleInterface.getEvent(eventName), args);
  return { address, topics: encoded.topics, data: encoded.data };
}

test('exact role-change logs prove direct and Safe-executed wallet operations', () => {
  const operation = {
    action: 'replace', role: 'manufacturer', old_wallet_address: oldWallet,
    new_wallet_address: newWallet, business_name: 'Example Manufacturer',
  };
  const receipt = { status: 1, logs: [log('RoleRevoked', [oldWallet, 2]), log('RoleGranted', [newWallet, 2]), log('RoleReplaced', [oldWallet, newWallet, 2])] };
  assert.equal(hasExpectedWalletOperationEvent(receipt, contractAddress, operation), true);
  assert.equal(hasExpectedWalletOperationEvent({ logs: [log('RoleReplaced', [oldWallet, newWallet, 3])] }, contractAddress, operation), false);
  assert.equal(hasExpectedWalletOperationEvent({ logs: [log('RoleRevoked', [oldWallet, 2]), log('RoleGranted', [newWallet, 2]), log('RoleReplaced', [oldWallet, newWallet, 2], newWallet)] }, contractAddress, operation), false);
  assert.equal(hasExpectedWalletOperationEvent({ logs: [...receipt.logs, log('RoleRevoked', [newWallet, 2])] }, contractAddress, operation), false);
});

test('wallet event verifier rejects unrelated or mismatched role-management events', () => {
  const operation = {
    action: 'link', role: 'retailer', old_wallet_address: null,
    new_wallet_address: newWallet, business_name: 'Example Retailer',
  };
  assert.equal(hasExpectedWalletOperationEvent({ logs: [log('RoleGranted', [oldWallet, 4])] }, contractAddress, operation), false);
  assert.equal(hasExpectedWalletOperationEvent({ logs: [log('RoleGranted', [newWallet, 3])] }, contractAddress, operation), false);
  assert.equal(hasExpectedWalletOperationEvent({ logs: [log('RoleGranted', [newWallet, 4])] }, contractAddress, operation), true);
});

test('direct owner transaction must exactly match the audited call', () => {
  const operation = {
    action: 'replace', role: 'manufacturer', old_wallet_address: oldWallet,
    new_wallet_address: newWallet, business_name: 'Example Manufacturer',
  };
  const calldata = roleInterface.encodeFunctionData('replaceRole', [oldWallet, newWallet, 'Example Manufacturer']);
  assert.equal(isDirectOwnerWalletOperation({ from: oldWallet, to: contractAddress, data: calldata }, oldWallet, contractAddress, operation), true);
  const wrongCall = roleInterface.encodeFunctionData('replaceRole', [oldWallet, oldWallet, 'Example Manufacturer']);
  assert.equal(isDirectOwnerWalletOperation({ from: oldWallet, to: contractAddress, data: wrongCall }, oldWallet, contractAddress, operation), false);
  assert.equal(isDirectOwnerWalletOperation({ from: newWallet, to: contractAddress, data: calldata }, oldWallet, contractAddress, operation), false);
  assert.deepEqual(expectedCall(operation), { method: 'replaceRole', args: [oldWallet, newWallet, 'Example Manufacturer'] });
});
