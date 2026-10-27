const test = require('node:test');
const assert = require('node:assert/strict');
const { hasDatabaseSslOverride, loadRuntimeConfig } = require('../runtime-config');

const validProduction = {
  NODE_ENV: 'production',
  PORT: '5000',
  DATABASE_URL: 'postgresql://app:secret@db.example.com:5432/smartscan',
  JWT_SECRET: 'a-long-random-production-secret-value-123456',
  ALLOWED_ORIGINS: 'https://app.example.com',
  WALLET_LINK_ORIGIN: 'https://app.example.com',
  CHAIN_RPC_URL: 'https://rpc.example.com/sepolia',
  CHAIN_ID: '11155111',
  CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000022',
  CONTRACT_DEPLOYMENT_BLOCK: '100',
  SCAN_RETENTION_DAYS: '90',
  UPLOAD_STORAGE_DRIVER: 's3',
  UPLOAD_S3_BUCKET: 'smartscan-uploads',
  UPLOAD_S3_REGION: 'us-east-1',
  REDIS_URL: 'rediss://redis-user:redis-secret@redis.example.com:6379',
  TRUST_PROXY_HOPS: '1',
};

test('production runtime accepts explicit secure configuration', () => {
  const config = loadRuntimeConfig(validProduction);
  assert.equal(config.production, true);
  assert.equal(config.chainId, '11155111');
  assert.equal(config.allowedOrigins[0], 'https://app.example.com');
  assert.equal(config.scanRetentionDays, 90);
  assert.equal(config.jwtExpiresIn, '12h');
});

test('production runtime rejects missing or weak security and chain settings', () => {
  assert.throws(() => loadRuntimeConfig({ ...validProduction, JWT_SECRET: 'dev-insecure-secret-change-me' }), /JWT_SECRET/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, JWT_EXPIRES_IN: 'invalid' }), /JWT_EXPIRES_IN/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, JWT_EXPIRES_IN: '0s' }), /JWT_EXPIRES_IN/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, JWT_EXPIRES_IN: '91d' }), /JWT_EXPIRES_IN/);
  assert.equal(loadRuntimeConfig({ ...validProduction, JWT_EXPIRES_IN: '30m' }).jwtExpiresIn, '30m');
  assert.throws(() => loadRuntimeConfig({ ...validProduction, ALLOWED_ORIGINS: 'http://app.example.com' }), /ALLOWED_ORIGINS/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, CHAIN_RPC_URL: 'http://rpc.example.com' }), /HTTPS CHAIN_RPC_URL/);
  const { CHAIN_RPC_URL, ...withoutExplicitChainRpc } = validProduction;
  assert.throws(() => loadRuntimeConfig({ ...withoutExplicitChainRpc, SEPOLIA_RPC_URL: 'https://sepolia.example.com' }), /HTTPS CHAIN_RPC_URL/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000000' }), /CONTRACT_ADDRESS/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, CONTRACT_DEPLOYMENT_BLOCK: '' }), /CONTRACT_DEPLOYMENT_BLOCK/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, PGSSL_DISABLE: '1' }), /PGSSL_DISABLE/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, PGSSL_DISABLE: 'yes' }), /PGSSL_DISABLE/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, PGSSL_REJECT_UNAUTHORIZED: 'false' }), /PGSSL_REJECT_UNAUTHORIZED/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, WALLET_LINK_ORIGIN: 'https://app.example.com/path' }), /WALLET_LINK_ORIGIN/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, UPLOAD_STORAGE_DRIVER: 'local' }), /UPLOAD_STORAGE_DRIVER=s3/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, UPLOAD_S3_BUCKET: '' }), /UPLOAD_S3_BUCKET/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, UPLOAD_S3_ACCESS_KEY_ID: 'one-sided' }), /must be provided together/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, UPLOAD_SIGNED_URL_TTL_SECONDS: '30' }), /from 60 to 900/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, REDIS_URL: 'redis://redis.example.com:6379' }), /secure rediss/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, TRUST_PROXY_HOPS: '0' }), /TRUST_PROXY_HOPS/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, SCAN_RETENTION_DAYS: '' }), /SCAN_RETENTION_DAYS/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, SCAN_RETENTION_DAYS: '0' }), /SCAN_RETENTION_DAYS/);
  assert.throws(() => loadRuntimeConfig({ ...validProduction, SCAN_RETENTION_DAYS: 'forever' }), /SCAN_RETENTION_DAYS/);
});

test('production runtime rejects database URL SSL parameters that override enforced certificate verification', () => {
  for (const query of [
    'ssl=0',
    'sslmode=disable',
    'sslmode=no-verify',
    'sslmode=require',
    'uselibpqcompat=true&sslmode=require',
    'sslrootcert=%2Ftmp%2Froot.crt',
    'SSLMODE=verify-full',
  ]) {
    const databaseUrl = `postgresql://app:secret@db.example.com:5432/smartscan?${query}`;
    assert.equal(hasDatabaseSslOverride(databaseUrl), true, query);
    assert.throws(
      () => loadRuntimeConfig({ ...validProduction, DATABASE_URL: databaseUrl }),
      /DATABASE_URL must not contain SSL query parameters/,
      query,
    );
  }
  assert.equal(hasDatabaseSslOverride('postgresql://app:secret@db.example.com:5432/smartscan?application_name=smartscan'), false);
});

test('development runtime keeps local defaults', () => {
  const config = loadRuntimeConfig({ NODE_ENV: 'development' });
  assert.equal(config.port, 5000);
  assert.equal(config.jwtSecret, 'dev-insecure-secret-change-me');
  assert.equal(config.redisUrl, '');
  assert.deepEqual(config.allowedOrigins, ['http://localhost:3000', 'http://10.0.2.2:3000']);
});
