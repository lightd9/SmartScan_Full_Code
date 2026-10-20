const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { hashPassword, isHashed, verifyPassword } = require('./password');

const ROLES = ['admin', 'manufacturer', 'supplier', 'retailer'];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 500;
const AUTH_WINDOW_MS = 60 * 1000;
const AUTH_MAX_ATTEMPTS = 10;

function validText(value, max = MAX_TEXT_LENGTH) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function createRateLimiter({ windowMs, max }) {
  const clients = new Map();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = clients.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      clients.set(key, { startedAt: now, count: 1 });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((windowMs - (now - current.startedAt)) / 1000));
      return res.status(429).json({ error: 'Too many requests; try again later' });
    }
    return next();
  };
}

function imageStorage(destDir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destDir),
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 10);
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  });
}

function imageFilter(_req, file, cb) {
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image uploads are allowed'));
  }
}

function uploadHandler(upload) {
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        return next(err);
      }
      if (!req.file) {
        return res.status(400).json({ success: 0, error: 'Please select an image to upload' });
      }
      return res.json({ success: 1, fileName: req.file.filename });
    });
  };
}

function sendUpload(baseDir) {
  return (req, res) => {
    const fileName = path.basename(req.params.fileName);
    const filePath = path.join(baseDir, fileName);
    if (!filePath.startsWith(baseDir + path.sep)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    return res.sendFile(filePath);
  };
}

function createApp({ pool, jwtSecret, jwtExpiresIn = '12h', allowedOrigins = [], uploadBaseDir = path.join(__dirname, 'public', 'uploads') }) {
  if (!pool) {
    throw new Error('createApp requires a database pool');
  }
  if (!jwtSecret) {
    throw new Error('createApp requires a JWT secret');
  }

  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  const authRateLimit = createRateLimiter({ windowMs: AUTH_WINDOW_MS, max: AUTH_MAX_ATTEMPTS });

  const profileUploadDir = path.join(uploadBaseDir, 'profile');
  const productUploadDir = path.join(uploadBaseDir, 'product');
  fs.mkdirSync(profileUploadDir, { recursive: true });
  fs.mkdirSync(productUploadDir, { recursive: true });

  const uploadProfile = multer({ storage: imageStorage(profileUploadDir), fileFilter: imageFilter, limits: { fileSize: MAX_UPLOAD_BYTES } }).single('image');
  const uploadProduct = multer({ storage: imageStorage(productUploadDir), fileFilter: imageFilter, limits: { fileSize: MAX_UPLOAD_BYTES } }).single('image');

  const authenticate = (req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      req.user = jwt.verify(token, jwtSecret);
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

  const authorize = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };

  // --- auth ---

  app.post('/auth', authRateLimit, async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      if (!validText(username, 50) || !validText(password, 200)) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      const { rows } = await pool.query('SELECT username, password, role FROM auth WHERE username = $1', [username]);
      if (rows.length === 0 || !verifyPassword(password, rows[0].password)) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      const account = rows[0];
      if (!isHashed(account.password)) {
        // Opportunistically upgrade legacy plaintext passwords on successful login.
        await pool.query('UPDATE auth SET password = $1 WHERE username = $2', [hashPassword(password), username]);
      }
      const token = jwt.sign({ username: account.username, role: account.role }, jwtSecret, { expiresIn: jwtExpiresIn });
      return res.json({ token, user: { username: account.username, role: account.role } });
    } catch (err) {
      return next(err);
    }
  });

  app.get('/authAll', authenticate, authorize('admin'), async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT id, username, role FROM auth');
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.post('/addaccount', authenticate, authorize('admin'), async (req, res, next) => {
    try {
      const { username, password, role } = req.body || {};
      if (!validText(username, 50) || !validText(password, 200) || !validText(role, 20)) {
        return res.status(400).json({ success: 0, error: 'username, password and role are required' });
      }
      if (!ROLES.includes(role)) {
        return res.status(400).json({ success: 0, error: `role must be one of: ${ROLES.join(', ')}` });
      }
      const exists = await pool.query('SELECT 1 FROM auth WHERE username = $1', [username]);
      if (exists.rows.length > 0) {
        return res.status(409).json({ success: 0, error: 'Username already exists' });
      }
      await pool.query('INSERT INTO auth (username, password, role) VALUES ($1, $2, $3)', [username, hashPassword(password), role]);
      return res.json({ success: 1 });
    } catch (err) {
      return next(err);
    }
  });

  app.post('/changepsw', authenticate, async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      const target = req.user.role === 'admin' ? username : req.user.username;
      if (!validText(target, 50) || !validText(password, 200)) {
        return res.status(400).json({ success: 0, error: 'username and password are required' });
      }
      const result = await pool.query('UPDATE auth SET password = $1 WHERE username = $2', [hashPassword(password), target]);
      if (result.rowCount === 0) return res.status(404).json({ success: 0, error: 'Account not found' });
      return res.json({ success: 1 });
    } catch (err) {
      return next(err);
    }
  });

  // --- profile ---

  app.get('/profileAll', authenticate, authorize('admin'), async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT * FROM profile');
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.get('/profile/:username', authenticate, async (req, res, next) => {
    try {
      const { username } = req.params;
      if (req.user.role !== 'admin' && req.user.username !== username) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { rows } = await pool.query('SELECT * FROM profile WHERE username = $1', [username]);
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.post('/addprofile', authenticate, authorize('admin'), async (req, res, next) => {
    try {
      const { username, name, description, website, location, image, role } = req.body || {};
      if (!validText(username, 50)) {
        return res.status(400).json({ success: 0, error: 'username is required' });
      }
      await pool.query(
        'INSERT INTO profile (username, name, description, website, location, image, role) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [username, name, description, website, location, image, role],
      );
      return res.json({ success: 1 });
    } catch (err) {
      return next(err);
    }
  });

  // --- uploads ---

  app.post('/upload/profile', authenticate, authorize('admin'), uploadHandler(uploadProfile));
  app.post('/upload/product', authenticate, authorize('manufacturer'), uploadHandler(uploadProduct));

  app.get('/file/profile/:fileName', sendUpload(profileUploadDir));
  app.get('/file/product/:fileName', sendUpload(productUploadDir));

  // --- product ---

  app.get('/product/serialNumber', authenticate, async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT serialNumber FROM product');
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.post('/addproduct', authenticate, authorize('manufacturer'), async (req, res, next) => {
    try {
      const { serialNumber, name, brand } = req.body || {};
      if (!validText(serialNumber, 50) || (name !== undefined && !validText(name, 50)) || (brand !== undefined && !validText(brand, 50))) {
        return res.status(400).json({ success: 0, error: 'serialNumber is required' });
      }
      await pool.query('INSERT INTO product (serialNumber, name, brand, manufacturer_username, chain_status) VALUES ($1, $2, $3, $4, $5)', [serialNumber, name, brand, req.user.username, 'pending_chain']);
      return res.json({ success: 1 });
    } catch (err) {
      return next(err);
    }
  });

  app.patch('/product/:serialNumber/chain-status', authenticate, authorize('manufacturer', 'admin'), async (req, res, next) => {
    try {
      const { status, txHash, chainId, failureReason } = req.body || {};
      const validStatuses = ['pending_chain', 'confirmed', 'failed'];
      if (!validStatuses.includes(status)) return res.status(400).json({ success: 0, error: 'Invalid chain status' });
      if (txHash !== undefined && !validText(txHash, 100)) return res.status(400).json({ success: 0, error: 'Invalid transaction hash' });
      const result = await pool.query(
        'UPDATE product SET chain_status = $1, chain_tx_hash = COALESCE($2, chain_tx_hash), chain_id = COALESCE($3, chain_id), failure_reason = $4 WHERE serialnumber = $5 AND ($6 = $7 OR manufacturer_username = $8)',
        [status, txHash || null, chainId || null, failureReason || null, req.params.serialNumber, req.user.role, 'admin', req.user.username],
      );
      if (result.rowCount === 0) return res.status(404).json({ success: 0, error: 'Product not found' });
      return res.json({ success: 1, status });
    } catch (err) { return next(err); }
  });

  app.get('/product/chain-status', authenticate, authorize('admin'), async (req, res, next) => {
    try {
      const requestedStatus = req.query.status;
      const allowedStatuses = ['pending_chain', 'confirmed', 'failed'];
      if (requestedStatus && !allowedStatuses.includes(requestedStatus)) {
        return res.status(400).json({ error: 'Invalid chain status' });
      }
      const params = requestedStatus ? [requestedStatus] : [];
      const query = requestedStatus
        ? 'SELECT serialnumber, name, brand, chain_status, chain_tx_hash, chain_id, failure_reason, created_at FROM product WHERE chain_status = $1 ORDER BY created_at DESC'
        : 'SELECT serialnumber, name, brand, chain_status, chain_tx_hash, chain_id, failure_reason, created_at FROM product ORDER BY created_at DESC';
      const { rows } = await pool.query(query, params);
      return res.json(rows);
    } catch (err) { return next(err); }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: 0, error: err.message });
    }
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({ success: 0, error: 'Origin not allowed' });
    }
    return res.status(500).json({ success: 0, error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = { createApp, ROLES, MAX_UPLOAD_BYTES };
