const test = require('node:test');
const assert = require('node:assert/strict');
const { waitForInterval } = require('../worker-timer');

test('worker interval wakes immediately when graceful shutdown is requested', async () => {
  const shutdown = new AbortController();
  const startedAt = Date.now();
  const waiting = waitForInterval(60_000, shutdown.signal);
  shutdown.abort();
  await waiting;
  assert.ok(Date.now() - startedAt < 1000, 'shutdown should not wait for the worker interval');
});

test('worker interval resolves immediately if shutdown was already requested', async () => {
  const shutdown = new AbortController();
  shutdown.abort();
  await waitForInterval(60_000, shutdown.signal);
});

test('worker interval completes normally without shutdown', async () => {
  const startedAt = Date.now();
  await waitForInterval(15);
  assert.ok(Date.now() - startedAt >= 10);
});
