const { Pool } = require('pg');
const { hasDatabaseSslOverride } = require('./runtime-config');

function isLoopbackDatabaseUrl(connectionString) {
  if (!connectionString) return false;
  try {
    const hostname = new URL(connectionString).hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
    return hostname === 'localhost' || hostname === '::1'
      || /^127(?:\.\d{1,3}){3}$/.test(hostname)
      || hostname.startsWith('::ffff:127.');
  } catch (_error) {
    return false;
  }
}

function createPool(connectionString = process.env.DATABASE_URL, env = process.env) {
  const production = env.NODE_ENV === 'production';
  const enforceTls = production || !isLoopbackDatabaseUrl(connectionString);
  const sslDisabled = ['1', 'true', 'yes'].includes(
    String(env.PGSSL_DISABLE).toLowerCase()
  );
  const rejectUnauthorized = String(env.PGSSL_REJECT_UNAUTHORIZED).toLowerCase() !== 'false';
  if (enforceTls && sslDisabled) throw new Error('PGSSL_DISABLE cannot be enabled for production or non-local databases');
  if (enforceTls && !rejectUnauthorized) throw new Error('PGSSL_REJECT_UNAUTHORIZED cannot be disabled for production or non-local databases');
  if (enforceTls && hasDatabaseSslOverride(connectionString || '')) {
    throw new Error('DATABASE_URL must not contain SSL query parameters; the backend enforces TLS with certificate verification');
  }
  return new Pool({
    connectionString,
    ssl: sslDisabled ? false : { require: true, rejectUnauthorized },
  });
}

module.exports = { createPool, isLoopbackDatabaseUrl };
