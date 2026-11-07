import test from 'node:test';
import assert from 'node:assert/strict';
import { saveReport, getSavedReports } from './storage.js';

function memoryStorage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

test('a saved report retry becomes one submitted case and preserves the server receipt', () => {
  globalThis.localStorage = memoryStorage();
  const report = { productSerial: 'SS-test', requestId: 'request-one', reason: 'Other concern' };
  const draft = saveReport({ ...report, status: 'draft' });
  assert.equal(saveReport({ ...report, status: 'draft' }).id, draft.id);
  assert.equal(getSavedReports().length, 1);
  const receipt = { ...report, id: 'CASE-123', caseId: 'CASE-123', timestamp: '2026-11-07T00:00:00Z' };
  saveReport(receipt);
  saveReport(receipt);
  assert.deepEqual(getSavedReports(), [receipt]);
});

test('separate reports on the same product retain separate request identities', () => {
  globalThis.localStorage = memoryStorage();
  saveReport({ productSerial: 'SS-test', requestId: 'request-one' });
  saveReport({ productSerial: 'SS-test', requestId: 'request-two' });
  assert.equal(getSavedReports().length, 2);
});
