require('dotenv').config();

const path = require('path');
const { createPool } = require('./db');
const { createApp } = require('./app');

const port = process.env.PORT || 5000;

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  JWT_SECRET is not set. Falling back to an insecure development secret.');
}
if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL must be configured in production');
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://10.0.2.2:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const pool = createPool();

pool
  .query('SELECT 1')
  .then(() => console.log('✅ Connected to database'))
  .catch((err) => console.error('❌ Database connection error:', err.message));

const app = createApp({
  pool,
  jwtSecret: jwtSecret || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  allowedOrigins,
  uploadBaseDir: path.join(__dirname, 'public', 'uploads'),
});

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok' });
  } catch (_error) {
    return res.status(503).json({ status: 'unavailable' });
  }
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, pool };
