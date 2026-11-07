const test = require('node:test');
const assert = require('node:assert/strict');
const { assessProduct, chainProduct } = require('../assessment');
const cases = require('../../test-fixtures/verification-v2.json');
const base = { serialNumber: 'SS-test', exists: true, source: 'chain', stage: 3 };

for (const item of cases) test(`shared assessment: ${item.name}`, () => {
  const result = assessProduct({ product: { ...base, stage: item.stage, isSold: item.sold, recalled: item.recalled }, historyChecked: true, monitoring: 'complete' });
  assert.equal(result.summary.status, item.status); assert.equal(result.score, null);
  assert.ok(result.coverage.assessed < result.coverage.expected);
  assert.equal(result.subject.unitIdentityConfirmed, false);
});
test('recall dominates positive findings, sale and anomalies', () => {
  const result = assessProduct({ product: { ...base, stage: 5, isSold: true }, flags: ['unusual_frequency'], monitoring: 'complete', historyChecked: true });
  assert.equal(result.summary.status, 'RECALLED'); assert.equal(result.safety.recalled, true);
});
test('missing GPS does not create adverse evidence; unavailable monitoring is not a passed check', () => {
  const result = assessProduct({ product: base });
  assert.equal(result.findings.find(f => f.domain === 'location').state, 'unknown');
  assert.equal(result.findings.find(f => f.domain === 'anomaly').state, 'unavailable');
  assert.equal(result.findings.some(f => f.state === 'concern'), false);
});
test('registry-only, authoritative absence and unavailable records are distinct', () => {
  assert.equal(assessProduct({ product: { ...base, source: 'registry' } }).source.verifiedAt, null);
  assert.equal(assessProduct({ product: { ...base, exists: false } }).summary.status, 'NOT_FOUND');
  assert.equal(assessProduct({ product: { ...base, exists: false, source: 'unavailable' } }).summary.status, 'UNAVAILABLE');
});
test('anomalies and history conflicts prevent a clean presentation without claiming counterfeit', () => {
  for (const flag of ['conflicting_product_state', 'unusual_frequency', 'suspicious_location']) {
    const result = assessProduct({ product: base, flags: [flag], historyChecked: true, monitoring: 'complete' });
    assert.equal(result.summary.status, 'CONCERN'); assert.doesNotMatch(result.summary.title, /counterfeit/i);
  }
});
test('serialization supports BigInt events and custodian is the confirmed holder, not recipient', () => {
  const raw = ['SS-test', 'Bottle', 'Maker', '', '', [[1n, 'Maker', '0xabc', '[Profile] Lagos', '123', 0n, '0x0', 2n]], 2n, '0xabc', '0xdef', false, false];
  const product = chainProduct(raw, 'SS-test', '0xcontract', '11155111');
  assert.doesNotThrow(() => JSON.stringify(product));
  assert.equal(assessProduct({ product }).custodian.wallet, '0xabc');
});
