const test = require('node:test');
const assert = require('node:assert/strict');
const { ethers } = require('ethers');
const { PRODUCT_SCAN_ABI, hasConflictingProductState } = require('../app');
const deployedContractArtifact = require('../../smartscan-frontend-react/src/utils/IdenteefiV2.json');

const zero = ethers.ZeroAddress;
const manufacturer = '0x0000000000000000000000000000000000000011';
const supplier = '0x0000000000000000000000000000000000000022';
const retailer = '0x0000000000000000000000000000000000000033';
const admin = '0x0000000000000000000000000000000000000044';

function event(id, action, actorRole, actorWallet, recipientWallet = zero) {
  return [BigInt(id), 'Business', actorWallet, 'Location', 'Timestamp', BigInt(action), recipientWallet, BigInt(actorRole)];
}

function product(history, stage, custodian, pendingRecipient = zero, sold = false, recalled = false) {
  return ['SS-00000000-0000-0000-0000-000000000001', 'Product', 'Brand', '', '', history, BigInt(stage), custodian, pendingRecipient, sold, recalled];
}

test('valid manufacturer-to-supplier-to-retailer custody history is consistent', () => {
  const history = [
    event(1, 0, 2, manufacturer),
    event(2, 1, 2, manufacturer, supplier),
    event(3, 2, 3, supplier),
    event(4, 1, 3, supplier, retailer),
    event(5, 2, 4, retailer),
  ];
  assert.equal(hasConflictingProductState(product(history, 3, retailer)), false);
});

test('server scan ABI matches the deployed frontend V2 artifact and decodes its history layout', () => {
  const serverInterface = new ethers.Interface(PRODUCT_SCAN_ABI);
  const deployedInterface = new ethers.Interface(deployedContractArtifact.abi);
  assert.equal(serverInterface.getFunction('getProduct').selector, deployedInterface.getFunction('getProduct').selector);
  const validProduct = product([event(1, 0, 2, manufacturer)], 1, manufacturer);
  const encoded = deployedInterface.encodeFunctionResult('getProduct', validProduct);
  const decoded = serverInterface.decodeFunctionResult('getProduct', encoded);
  assert.equal(decoded[0], validProduct[0]);
  assert.equal(hasConflictingProductState(decoded), false);
});

test('valid sold and recalled histories preserve the contract sold-state semantics', () => {
  const soldHistory = [
    event(1, 0, 2, manufacturer),
    event(2, 1, 2, manufacturer, supplier),
    event(3, 2, 3, supplier),
    event(4, 1, 3, supplier, retailer),
    event(5, 2, 4, retailer),
    event(6, 3, 4, retailer),
  ];
  assert.equal(hasConflictingProductState(product(soldHistory, 4, retailer, zero, true, false)), false);
  const recalledHistory = [...soldHistory, event(7, 4, 1, admin)];
  assert.equal(hasConflictingProductState(product(recalledHistory, 5, retailer, zero, true, true)), false);
});

test('malformed action order, event ids, roles, recipients, and product state are flagged', () => {
  const manufactured = event(1, 0, 2, manufacturer);
  assert.equal(hasConflictingProductState(product([manufactured, event(2, 2, 3, supplier)], 3, supplier)), true);
  assert.equal(hasConflictingProductState(product([manufactured, event(4, 1, 2, manufacturer, supplier)], 2, manufacturer, supplier)), true);
  assert.equal(hasConflictingProductState(product([manufactured, event(2, 1, 4, manufacturer, supplier)], 2, manufacturer, supplier)), true);
  assert.equal(hasConflictingProductState(product([manufactured, event(2, 1, 2, manufacturer)], 2, manufacturer, supplier)), true);
  assert.equal(hasConflictingProductState(product([manufactured], 4, manufacturer, zero, true, false)), true);
});
