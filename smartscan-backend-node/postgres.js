require('dotenv').config();

const path = require('path');
const { createPool } = require('./db');
const { createApp } = require('./app');
const { loadRuntimeConfig } = require('./runtime-config');
const { latestMigrationName, assertLatestMigration } = require('./schema-readiness');
const { Interface } = require('ethers');
const { createUploadStore } = require('./upload-storage');
const Redis = require('ioredis');
const { createRateLimiters } = require('./rate-limiters');
const config = loadRuntimeConfig();
const latestRequiredMigration = latestMigrationName();
const V2_READINESS_INTERFACE = new Interface([
  'function productExists(string serialNumber) view returns (bool)',
  'function getProductState(string serialNumber) view returns (uint8,address,address,bool,bool)',
]);
const V2_READINESS_SERIAL = 'SS-00000000-0000-0000-0000-000000000000';

async function assertV2Contract(provider, address) {
  const existsResult = await provider.call({
    to: address,
    data: V2_READINESS_INTERFACE.encodeFunctionData('productExists', [V2_READINESS_SERIAL]),
  });
  const [exists] = V2_READINESS_INTERFACE.decodeFunctionResult('productExists', existsResult);
  if (typeof exists !== 'boolean') throw new Error('Configured contract does not expose the V2 productExists function');

  const stateResult = await provider.call({
    to: address,
    data: V2_READINESS_INTERFACE.encodeFunctionData('getProductState', [V2_READINESS_SERIAL]),
  });
  const state = V2_READINESS_INTERFACE.decodeFunctionResult('getProductState', stateResult);
  if (state.length !== 5) throw new Error('Configured contract does not expose the V2 getProductState function');
}

const port = config.port;

const jwtSecret = config.jwtSecret;
const allowedOrigins = config.allowedOrigins;

const pool = createPool(config.databaseUrl);
const uploadStore = createUploadStore(config.uploadStorage);
const redisClient = config.redisUrl ? new Redis(config.redisUrl, {
  connectTimeout: 5000,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
}) : null;

if (redisClient) {
  redisClient.on('error', () => console.error('Rate-limit store connection error'));
}

pool
  .query('SELECT 1')
  .then(() => console.log('✅ Connected to database'))
  .catch((err) => console.error('Database connection error', err.code ? { code: err.code } : undefined));

const app = createApp({
  pool,
  jwtSecret,
  jwtExpiresIn: config.jwtExpiresIn,
  allowedOrigins,
  uploadBaseDir: path.join(__dirname, 'public', 'uploads'),
  uploadStore,
  rateLimiters: createRateLimiters({ redisClient }),
  trustProxyHops: config.trustProxyHops,
  contractAddress: config.contractAddress,
  rpcUrl: config.rpcUrl,
  chainId: config.chainId,
  walletLinkOrigin: config.walletLinkOrigin,
});

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

app.get('/readyz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    await assertLatestMigration(pool, latestRequiredMigration);
    if (config.production && redisClient?.status !== 'ready') throw new Error('Shared rate-limit store is unavailable');
    await uploadStore.checkReady();
    const provider = app.locals.chainProvider;
    if (!config.rpcUrl || !config.contractAddress || !provider) throw new Error('Blockchain configuration is missing');
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== Number(config.chainId)) throw new Error('Configured blockchain chain ID does not match RPC');
    if ((await provider.getCode(config.contractAddress)) === '0x') throw new Error('Configured contract has no code on the configured chain');
    await assertV2Contract(provider, config.contractAddress);
    return res.json({ status: 'ready', database: 'ok', schema: latestRequiredMigration, rateLimitStore: redisClient ? 'ok' : 'memory', mediaStore: 'ok', blockchain: 'ok', chainId: Number(network.chainId) });
  } catch (error) {
    console.error('/readyz check error:', error?.message || error);
    return res.status(503).json({ status: 'not_ready', error: error?.message || 'unknown_error' });
  }
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
});

let shutdownStarted = false;
async function closeRedis() {
  if (!redisClient) return;
  if (redisClient.status === 'ready') {
    try {
      await redisClient.quit();
      return;
    } catch (_error) { /* force disconnect below */ }
  }
  redisClient.disconnect();
}

function shutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log(`${signal} received; shutting down`);
  server.close(async (serverError) => {
    if (serverError) console.error('HTTP server close failed');
    const results = await Promise.allSettled([
      pool.end(),
      closeRedis(),
      Promise.resolve(app.locals.chainProvider?.destroy()),
    ]);
    const cleanupFailed = results.some((result) => result.status === 'rejected');
    if (cleanupFailed) console.error('One or more service resources did not close cleanly');
    process.exit(serverError || cleanupFailed ? 1 : 0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, pool, redisClient, assertV2Contract };
