import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQrPayload, normalizeChainProduct, mergeVerificationResults, createProductVerifier } from './verify.js';
import { canShowEvidenceScore, needsPurchaseDetails, productStatus, supplyChain } from '../utils/product.js';
import { CONTRACT_ADDRESS, CHAIN_ID } from '../config/constants.js';
import cases from '../../../test-fixtures/verification-v2.json' with { type: 'json' };

const serial = 'SS-abcd1234-1234-1234-1234-abcd12345678';
const fulfilled = value => ({ status: 'fulfilled', value });
const rejected = { status: 'rejected', reason: new Error('offline') };

test('QR parsing preserves issuer case and checks an explicit contract before extracting the serial', () => {
  for (const value of [serial, `${CONTRACT_ADDRESS},${serial}`, `https://smartscan.example/verify/${serial}?source=label`]) assert.equal(parseQrPayload(value).serialNumber, serial);
  assert.equal(parseQrPayload(`0x0000000000000000000000000000000000000011,${serial}`).contractAddress,'0x0000000000000000000000000000000000000011');
  assert.throws(() => parseQrPayload(`invalid-address,${serial}`),/unrecognized contract/);
  for (const invalid of [`prefix-${serial}-suffix`, `https://example.com/${serial}junk`, 'batch123', `${serial}z`]) assert.throws(() => parseQrPayload(invalid));
});

for (const item of cases) test(`V2 ${item.name} is correctly interpreted`, () => {
  const result = normalizeChainProduct([serial, 'Bottle', 'Maker', '', '', [[1n, 'Maker', '', '', 1n, 0n, '', 2n]], item.stage, '', '', item.sold, item.recalled], serial);
  assert.equal(result.status, item.status);
  assert.equal(result.history[0].action, 0);
  assert.doesNotThrow(() => JSON.stringify(result));
  const display = productStatus(result);
  assert.equal(display.label === 'Recalled', item.recalled);
  assert.equal(display.label === 'More checks needed', item.status === 'SOLD');
  assert.doesNotMatch(display.title, /is authentic/i);
});

test('old saved stage 4 results incorrectly labelled recalled are rendered as sold', () => {
  assert.equal(productStatus({ exists: true, stage: 4, status: 'RECALLED' }).label, 'More checks needed');
  assert.notEqual(productStatus({ exists: true, stage: 3, status: 'SOLD', isSold: false }).label, 'Sale recorded');
});

test('authoritative absence is distinct from an unavailable lookup and overrides registry presence', () => {
  const registry = fulfilled({ data: { exists: true, stage: 4, isSold: true } });
  const absent = normalizeChainProduct(null, serial);
  assert.equal(mergeVerificationResults(serial, registry, fulfilled(absent)).exists, false);
  assert.equal(absent.status, 'NOT_FOUND');
  assert.throws(() => mergeVerificationResults(serial, rejected, rejected), /could not verify/);
  assert.throws(() => mergeVerificationResults(serial, fulfilled({ data: { exists: false } }), rejected));
});

test('stale registry lifecycle never overrides a fresh chain read; fallback does not invent verification time', () => {
  const registry = fulfilled({ data: { exists: true, stage: 5, recalled: true, isSold: true, imageHash: 'photo.png', verifiedAt: 'old' } });
  const live = normalizeChainProduct([serial, 'Bottle', 'Maker', '', '', [], 3, '', '', false, false], serial);
  const merged = mergeVerificationResults(serial, registry, fulfilled(live));
  assert.equal(merged.status, 'REGISTERED'); assert.equal(merged.recalled, false); assert.equal(merged.isSold, false);
  assert.equal(merged.imageHash, 'photo.png');
  const fallback = mergeVerificationResults(serial, registry, rejected);
  assert.equal(fallback.source, 'registry'); assert.equal(fallback.verifiedAt, null); assert.equal(fallback.status, 'RECALLED');
});

test('labelled device coordinates are mapped, and fallbacks are not invented as GPS', () => {
  const history = [ { location: '[Device 6.60000,3.30000 +/-14m] Lagos' }, { location: '[Profile] Lagos' }, { location: '[Device 96,3 +/-14m] invalid' } ];
  const stops = supplyChain({ history });
  assert.deepEqual(stops[0].coordinates, [6.6, 3.3]); assert.equal(stops[0].approximate, true);
  assert.equal(stops[1].coordinates, null); assert.equal(stops[2].coordinates, null);
});

test('consumer displays the backend assessment and retains an explicit scan ID', async () => {
  const assessment = { policyVersion: 'evidence-2', source:{contractAddress:CONTRACT_ADDRESS}, summary: { label: 'Review findings' }, findings: [] };
  const api = { async post(_url, payload) {
    assert.equal(payload.eventId, '12345678-1234-1234-1234-123456789012'); assert.equal(payload.purpose, 'consumer');
    return { status: 200, data: { product: { serialNumber: serial, source: 'chain', exists: true, contractAddress: CONTRACT_ADDRESS, chainId: CHAIN_ID }, assessment, flags: ['unusual_frequency'] } };
  } };
  const result = await createProductVerifier({ api, readChain: () => { throw new Error('unneeded'); } })(serial, { eventId: '12345678-1234-1234-1234-123456789012' });
  assert.equal(productStatus(result), assessment.summary); assert.deepEqual(result.scanWarnings, ['unusual_frequency']);
});

test('server mismatch or unavailable assessment falls back without claiming clean monitoring', async () => {
  const api = { async post() { return { status: 201, data: { product: { serialNumber: 'wrong' }, assessment: { summary: {} }, flags: [] } }; }, async get() { throw new Error('offline'); } };
  const result = await createProductVerifier({ api, readChain: async () => normalizeChainProduct(null, serial) })(serial,{contractAddress:CONTRACT_ADDRESS});
  assert.equal(result.status, 'NOT_FOUND'); assert.deepEqual(result.scanWarnings, ['scan_risk_check_unavailable']);
});

test('fresh and older saved scores wait for explicit purchase answers', () => {
  const product = { exists: true, assessment: { score: { value: 90 }, summary: { status: 'VERIFIED', title: 'Authenticity checks passed.' } } };
  assert.equal(needsPurchaseDetails(product), true);
  assert.equal(canShowEvidenceScore(product), false);
  assert.equal(productStatus(product).title, 'Finish your verification.');
  const completed = { ...product, purchaseAnswers: { completed: true, seller: 'recorded', context: 'after_purchase' } };
  assert.equal(needsPurchaseDetails(completed), false);
  assert.equal(canShowEvidenceScore(completed), true);
  assert.equal(productStatus(completed), product.assessment.summary);
});

test('a recall remains visible before purchase questions and unknown products have no score gate', () => {
  const recalled = { exists: true, assessment: { score: { value: 90 }, summary: { status: 'RECALLED', title: 'This product has been recalled.' } } };
  assert.equal(canShowEvidenceScore(recalled), false);
  assert.equal(productStatus(recalled), recalled.assessment.summary);
  assert.equal(needsPurchaseDetails({ exists: false }), false);
  assert.equal(needsPurchaseDetails({ exists: true, source: 'registry' }), false);
});
