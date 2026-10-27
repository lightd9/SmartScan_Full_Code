const { ethers } = require('ethers');
const path = require('path');

const DATABASE_SSL_OVERRIDE_PARAMETERS = new Set([
  'ssl', 'sslmode', 'uselibpqcompat', 'sslcert', 'sslkey', 'sslrootcert', 'sslpassword',
]);

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function validUrl(value, protocols) {
  try { return protocols.includes(new URL(value).protocol); } catch (_error) { return false; }
}

function validOrigin(value, protocols) {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && url.origin === value && url.pathname === '/' && !url.search && !url.hash;
  } catch (_error) { return false; }
}

function hasDatabaseSslOverride(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return [...url.searchParams.keys()].some((key) => DATABASE_SSL_OVERRIDE_PARAMETERS.has(key.toLowerCase()));
  } catch (_error) {
    return false;
  }
}

function loadRuntimeConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const errors = [];
  const databaseUrl = env.DATABASE_URL;
  const jwtSecret = env.JWT_SECRET;
  const rpcUrl = production
    ? env.CHAIN_RPC_URL
    : env.CHAIN_RPC_URL || env.SEPOLIA_RPC_URL || env.SEPOLIA_QUICKNODE_KEY;
  const redisUrl = env.REDIS_URL || '';
  const trustProxyHopsText = env.TRUST_PROXY_HOPS || (production ? '' : '0');
  const chainIdText = env.CHAIN_ID || (production ? '' : '11155111');
  const contractAddress = env.CONTRACT_ADDRESS;
  const origins = parseOrigins(env.ALLOWED_ORIGINS || (production ? '' : 'http://localhost:3000,http://10.0.2.2:3000'));
  const walletLinkOrigin = env.WALLET_LINK_ORIGIN || (production ? '' : origins[0] || 'localhost');
  const uploadStorageDriver = env.UPLOAD_STORAGE_DRIVER || (production ? '' : 'local');
  const uploadS3Bucket = env.UPLOAD_S3_BUCKET || '';
  const uploadS3Region = env.UPLOAD_S3_REGION || '';
  const uploadS3Endpoint = env.UPLOAD_S3_ENDPOINT || '';
  const uploadS3AccessKeyId = env.UPLOAD_S3_ACCESS_KEY_ID || '';
  const uploadS3SecretAccessKey = env.UPLOAD_S3_SECRET_ACCESS_KEY || '';
  const uploadS3ForcePathStyle = String(env.UPLOAD_S3_FORCE_PATH_STYLE || '').toLowerCase();
  const uploadSignedUrlTtlSeconds = Number(env.UPLOAD_SIGNED_URL_TTL_SECONDS || 300);
  const scanRetentionDaysText = env.SCAN_RETENTION_DAYS || '';
  const scanRetentionDays = scanRetentionDaysText ? Number(scanRetentionDaysText) : null;
  const jwtExpiresIn = String(env.JWT_EXPIRES_IN || '12h');
  const jwtExpiryMatch = /^([1-9]\d{0,5})(s|m|h|d)$/.exec(jwtExpiresIn);
  const port = Number(env.PORT || 5000);
  const chainId = Number(chainIdText);
  const trustProxyHops = Number(trustProxyHopsText);

  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be an integer from 1 to 65535');
  if (production) {
    if (!databaseUrl || !validUrl(databaseUrl, ['postgres:', 'postgresql:'])) errors.push('DATABASE_URL must be a PostgreSQL URL in production');
    if (databaseUrl && hasDatabaseSslOverride(databaseUrl)) errors.push('DATABASE_URL must not contain SSL query parameters; the backend enforces TLS with certificate verification');
    if (!jwtSecret || jwtSecret.length < 32 || /replace|change-me|dev-insecure/i.test(jwtSecret)) errors.push('JWT_SECRET must be a non-placeholder secret of at least 32 characters in production');
    if (!jwtExpiryMatch || Number(jwtExpiryMatch[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[jwtExpiryMatch[2]]) > 90 * 86400) errors.push('JWT_EXPIRES_IN must use a positive s/m/h/d duration no longer than 90d in production');
    if (!rpcUrl || !validUrl(rpcUrl, ['https:'])) errors.push('A valid HTTPS CHAIN_RPC_URL is required in production');
    if (!Number.isSafeInteger(chainId) || chainId <= 0) errors.push('CHAIN_ID must be a positive integer in production');
    if (!ethers.isAddress(contractAddress || '') || ethers.getAddress(contractAddress) === ethers.ZeroAddress) errors.push('CONTRACT_ADDRESS must be a valid non-zero address in production');
    if (!/^(0|[1-9]\d*)$/.test(env.CONTRACT_DEPLOYMENT_BLOCK || '')) errors.push('CONTRACT_DEPLOYMENT_BLOCK must be a non-negative integer in production');
    if (['1', 'true', 'yes'].includes(String(env.PGSSL_DISABLE).toLowerCase())) errors.push('PGSSL_DISABLE cannot be enabled in production');
    if (String(env.PGSSL_REJECT_UNAUTHORIZED).toLowerCase() === 'false') errors.push('PGSSL_REJECT_UNAUTHORIZED cannot be disabled in production');
    if (!origins.length || origins.some((origin) => !validOrigin(origin, ['https:']))) errors.push('ALLOWED_ORIGINS must contain only HTTPS origins in production');
    if (!validOrigin(walletLinkOrigin, ['https:'])) errors.push('WALLET_LINK_ORIGIN must be an HTTPS origin in production');
    if (uploadStorageDriver !== 's3') errors.push('UPLOAD_STORAGE_DRIVER=s3 is required in production; local disk is not durable across instances or deployments');
    if (!redisUrl || !validUrl(redisUrl, ['rediss:'])) errors.push('REDIS_URL must be a secure rediss:// URL in production for shared rate limits');
    if (!Number.isInteger(trustProxyHops) || trustProxyHops < 1) errors.push('TRUST_PROXY_HOPS must be a positive integer matching the trusted HTTPS proxy topology in production');
    if (scanRetentionDays === null) errors.push('SCAN_RETENTION_DAYS must be explicitly configured in production');
  }
  if (scanRetentionDaysText && (!Number.isSafeInteger(scanRetentionDays) || scanRetentionDays < 1 || scanRetentionDays > 36500)) {
    errors.push('SCAN_RETENTION_DAYS must be an integer from 1 to 36500');
  }
  if (trustProxyHopsText && (!Number.isInteger(trustProxyHops) || trustProxyHops < 0)) errors.push('TRUST_PROXY_HOPS must be a non-negative integer');
  if (redisUrl && !validUrl(redisUrl, production ? ['rediss:'] : ['redis:', 'rediss:'])) errors.push('REDIS_URL must use redis:// locally or rediss:// in production');
  if (!['local', 's3'].includes(uploadStorageDriver)) errors.push('UPLOAD_STORAGE_DRIVER must be local or s3');
  if (uploadStorageDriver === 's3') {
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/i.test(uploadS3Bucket)) errors.push('UPLOAD_S3_BUCKET must be a valid bucket name');
    if (!/^[a-z0-9-]{2,64}$/i.test(uploadS3Region)) errors.push('UPLOAD_S3_REGION must be configured');
    if (uploadS3Endpoint && !validUrl(uploadS3Endpoint, production ? ['https:'] : ['https:', 'http:'])) errors.push('UPLOAD_S3_ENDPOINT must be a valid secure URL');
    if (Boolean(uploadS3AccessKeyId) !== Boolean(uploadS3SecretAccessKey)) errors.push('UPLOAD_S3_ACCESS_KEY_ID and UPLOAD_S3_SECRET_ACCESS_KEY must be provided together');
    if (uploadS3ForcePathStyle && !['true', 'false'].includes(uploadS3ForcePathStyle)) errors.push('UPLOAD_S3_FORCE_PATH_STYLE must be true or false');
    if (!Number.isInteger(uploadSignedUrlTtlSeconds) || uploadSignedUrlTtlSeconds < 60 || uploadSignedUrlTtlSeconds > 900) errors.push('UPLOAD_SIGNED_URL_TTL_SECONDS must be from 60 to 900');
  }
  if (errors.length) throw new Error(`Invalid runtime configuration: ${errors.join('; ')}`);

  return {
    production,
    port,
    databaseUrl,
    jwtSecret: jwtSecret || 'dev-insecure-secret-change-me',
    jwtExpiresIn,
    allowedOrigins: origins,
    walletLinkOrigin,
    rpcUrl,
    redisUrl,
    trustProxyHops,
    chainId: String(chainId),
    contractAddress,
    contractDeploymentBlock: env.CONTRACT_DEPLOYMENT_BLOCK,
    scanRetentionDays,
    uploadStorage: {
      driver: uploadStorageDriver,
      baseDir: path.resolve(__dirname, 'public', 'uploads'),
      bucket: uploadS3Bucket,
      region: uploadS3Region,
      endpoint: uploadS3Endpoint || undefined,
      forcePathStyle: uploadS3ForcePathStyle === 'true',
      credentials: uploadS3AccessKeyId ? { accessKeyId: uploadS3AccessKeyId, secretAccessKey: uploadS3SecretAccessKey } : undefined,
      signedUrlTtlSeconds: uploadSignedUrlTtlSeconds,
    },
    pgSslDisable: ['1', 'true', 'yes'].includes(String(env.PGSSL_DISABLE).toLowerCase()),
  };
}

module.exports = { loadRuntimeConfig, validOrigin, hasDatabaseSslOverride };
