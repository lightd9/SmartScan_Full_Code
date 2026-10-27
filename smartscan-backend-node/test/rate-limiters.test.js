const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiters } = require('../rate-limiters');

test('memory-backed authentication limiter returns 429 after its configured limit', async () => {
  const limiter = createRateLimiters().auth;
  const req = { ip: 'test-client', socket: { remoteAddress: 'test-client' } };
  const responses = [];
  const dispatch = async () => {
    const res = {
      setHeader(name, value) { this[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    let nextError;
    await limiter(req, res, (error) => { nextError = error; });
    assert.equal(nextError, undefined);
    responses.push(res);
    return res;
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await dispatch();
    assert.equal(response.statusCode, undefined);
  }
  const blocked = await dispatch();
  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked['Retry-After']) >= 1);
  assert.equal(blocked.body.error, 'Too many requests; try again later');
});

test('Redis-backed limiter fails closed when the shared store is not ready', async () => {
  class RedisNotReady {
    constructor() { this.status = 'connecting'; }
    defineCommand() {}
  }
  const limiter = createRateLimiters({ redisClient: new RedisNotReady() }).scan;
  let forwarded;
  await limiter({ ip: 'test-client' }, {}, (error) => { forwarded = error; });
  assert.match(forwarded?.message || '', /Redis connection is not ready/);
});

test('authenticated write limiter has a bounded per-IP budget', async () => {
  const limiter = createRateLimiters().write;
  const req = { ip: 'write-client', socket: { remoteAddress: 'write-client' } };
  let lastResponse;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const res = {
      setHeader(name, value) { this[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await limiter(req, res, () => {});
    lastResponse = res;
    assert.equal(res.statusCode, undefined);
  }
  const blocked = {
    setHeader(name, value) { this[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await limiter(req, blocked, () => {});
  assert.equal(lastResponse.statusCode, undefined);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.error, 'Too many requests; try again later');
});
