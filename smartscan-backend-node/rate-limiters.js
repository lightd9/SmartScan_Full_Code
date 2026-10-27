const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');

const DEFINITIONS = {
  auth: { points: 10, duration: 60 },
  scan: { points: 60, duration: 60 },
  upload: { points: 10, duration: 60 },
  write: { points: 60, duration: 60 },
};

function makeLimiter(name, options) {
  const definition = DEFINITIONS[name];
  if (!definition) throw new Error(`Unknown rate limiter: ${name}`);
  const prefix = `smartscan:${name}`;
  const limiter = options.redisClient
    ? new RateLimiterRedis({ ...definition, storeClient: options.redisClient, keyPrefix: prefix, rejectIfRedisNotReady: true })
    : new RateLimiterMemory({ ...definition, keyPrefix: prefix });

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    return limiter.consume(key)
      .then(() => next())
      .catch((error) => {
        if (Number.isFinite(error?.msBeforeNext)) {
          res.setHeader('Retry-After', Math.max(1, Math.ceil(error.msBeforeNext / 1000)));
          return res.status(429).json({ error: 'Too many requests; try again later' });
        }
        return next(error);
      });
  };
}

function createRateLimiters({ redisClient = null } = {}) {
  return {
    auth: makeLimiter('auth', { redisClient }),
    scan: makeLimiter('scan', { redisClient }),
    upload: makeLimiter('upload', { redisClient }),
    write: makeLimiter('write', { redisClient }),
  };
}

module.exports = { createRateLimiters };
