const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const { hashPassword, isHashed, verifyPassword } = require('./password');
const { createLocalUploadStore, hasValidImageSignature, MAX_UPLOAD_BYTES } = require('./upload-storage');
const { createRateLimiters } = require('./rate-limiters');
const { expectedCall, hasExpectedWalletOperationEvent, isDirectOwnerWalletOperation } = require('./wallet-operation-verification');

const ROLES = ['admin', 'manufacturer', 'supplier', 'retailer'];
const MAX_TEXT_LENGTH = 500;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHAIN_ROLE_IDS = { admin: 1, manufacturer: 2, supplier: 3, retailer: 4 };
const CHAIN_ROLE_ABI = [
  'function owner() view returns (address)',
  'function roles(address) view returns (uint8)',
  'function businessNames(address) view returns (string)',
  'function walletSuccessor(address) view returns (address)',
  'function grantRole(address account, uint8 role, string businessName)',
  'function revokeRole(address account)',
  'function replaceRole(address oldWallet, address newWallet, string businessName)',
  'event RoleGranted(address indexed account, uint8 role)',
  'event RoleRevoked(address indexed account, uint8 role)',
  'event RoleReplaced(address indexed previousWallet, address indexed newWallet, uint8 role)',
];
const PRODUCT_SCAN_ABI = [
  'function getProduct(string serialNumber) view returns (string,string,string,string,string,tuple(uint256 id,string actor,address actorWallet,string location,string timestamp,uint8 action,address recipientWallet,uint8 actorRole)[] history,uint8 stage,address currentCustodian,address pendingRecipient,bool sold,bool recalled)',
];

function normalizedAddress(value) {
  if (typeof value !== 'string' || !ethers.isAddress(value)) return null;
  return ethers.getAddress(value);
}

function roleForChain(role) {
  return CHAIN_ROLE_IDS[role] || 0;
}

function validText(value, max = MAX_TEXT_LENGTH) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function validNewPassword(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length >= 12 && value.length <= 200;
}

function validProductIdentifier(value) {
  return typeof value === 'string' && /^SS-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function hasConflictingProductState(product) {
  if (!product || !Array.isArray(product[5]) || product[5].length === 0) return true;
  const history = product[5];
  const firstAction = Number(history[0][5]);
  if (firstAction !== 0 || Number(history[0][0]) !== 1 || Number(history[0][7]) !== 2
    || !normalizedAddress(history[0][2]) || normalizedAddress(history[0][2]) === ethers.ZeroAddress
    || normalizedAddress(history[0][6]) !== ethers.ZeroAddress) return true;

  let stage = 1;
  for (let index = 1; index < history.length; index += 1) {
    const event = history[index];
    const id = Number(event[0]);
    const action = Number(event[5]);
    const actorRole = Number(event[7]);
    const recipient = normalizedAddress(event[6]);
    const allowedActions = stage === 1 ? [1, 4]
      : stage === 2 ? [2, 4]
        : stage === 3 ? [1, 3, 4]
          : stage === 4 ? [4] : [];
    const allowedRoles = action === 1 ? [2, 3]
      : action === 2 ? [3, 4]
        : action === 3 ? [4]
          : action === 4 ? [1, 2] : [];
    if (id !== index + 1 || !allowedActions.includes(action) || !allowedRoles.includes(actorRole)) return true;
    if (action === 1 ? (!recipient || recipient === ethers.ZeroAddress) : recipient !== ethers.ZeroAddress) return true;
    if (!normalizedAddress(event[2]) || normalizedAddress(event[2]) === ethers.ZeroAddress) return true;
    stage = action + 1;
  }

  const currentStage = Number(product[6]);
  const custodian = normalizedAddress(product[7]);
  const pendingRecipient = normalizedAddress(product[8]);
  const sold = Boolean(product[9]);
  const recalled = Boolean(product[10]);
  if (stage !== currentStage || !custodian || custodian === ethers.ZeroAddress) return true;
  if ((currentStage === 4 && !sold) || (currentStage !== 4 && currentStage !== 5 && sold)
    || recalled !== (currentStage === 5)) return true;
  if (currentStage === 2 ? (!pendingRecipient || pendingRecipient === ethers.ZeroAddress)
    : currentStage !== 5 && pendingRecipient !== ethers.ZeroAddress) return true;
  return false;
}

function imageFilter(_req, file, cb) {
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Unsupported image type');
    error.code = 'UNSUPPORTED_IMAGE_TYPE';
    error.status = 415;
    cb(error);
  }
}

function uploadHandler(upload, uploadStore, scope) {
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        return next(err);
      }
      if (!req.file) {
        return res.status(400).json({ success: 0, error: 'Please select an image to upload' });
      }
      if (!hasValidImageSignature(req.file)) {
        return res.status(400).json({ success: 0, error: 'Uploaded file is not a valid supported image' });
      }
      uploadStore.put(scope, req.file)
        .then((fileName) => res.json({ success: 1, fileName }))
        .catch(next);
    });
  };
}

function sendUpload(uploadStore, scope) {
  return async (req, res, next) => {
    try {
      const item = await uploadStore.get(scope, req.params.fileName);
      if (!item) return res.status(404).json({ error: 'File not found' });
      if (item.type === 'redirect') {
        res.setHeader('Cache-Control', 'private, no-store');
        return res.redirect(302, item.url);
      }
      return res.sendFile(item.filePath);
    } catch (error) {
      return next(error);
    }
  };
}

function createApp({ pool, jwtSecret, jwtExpiresIn = '12h', allowedOrigins = [], uploadBaseDir = path.join(__dirname, 'public', 'uploads'), uploadStore = createLocalUploadStore(uploadBaseDir), rateLimiters = createRateLimiters(), trustProxyHops = 0, scanVerifier, contractAddress = process.env.CONTRACT_ADDRESS, rpcUrl = process.env.CHAIN_RPC_URL || process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_QUICKNODE_KEY, chainId = process.env.CHAIN_ID || '11155111', walletLinkOrigin = process.env.WALLET_LINK_ORIGIN || allowedOrigins[0] || 'localhost', chainAdapter, logger = console }) {
  if (!pool) {
    throw new Error('createApp requires a database pool');
  }
  if (!jwtSecret) {
    throw new Error('createApp requires a JWT secret');
  }

  const app = express();
  app.set('trust proxy', trustProxyHops);
  const configuredChainId = String(chainId);
  const expectedContractAddress = normalizedAddress(contractAddress);
  if (!/^\d+$/.test(configuredChainId)) throw new Error('CHAIN_ID must be a numeric chain identifier');
  const chainProvider = rpcUrl ? new ethers.JsonRpcProvider(rpcUrl) : null;
  app.locals.chainProvider = chainProvider;
  const scanProvider = chainProvider;
  const verifyScanProduct = scanVerifier || (async (serialNumber) => {
    if (!scanProvider || !expectedContractAddress) throw new Error('Product scan verification is not configured');
    const network = await scanProvider.getNetwork();
    if (Number(network.chainId) !== Number(configuredChainId)) throw new Error('Product scan RPC chain mismatch');
    if ((await scanProvider.getCode(expectedContractAddress)) === '0x') throw new Error('Product scan contract has no code');
    const scanContract = new ethers.Contract(expectedContractAddress, PRODUCT_SCAN_ABI, scanProvider);
    const product = await scanContract.getProduct(serialNumber);
    return { exists: product[0] === serialNumber, conflictingState: product[0] === serialNumber && hasConflictingProductState(product) };
  });
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  const authRateLimit = rateLimiters.auth;
  const scanRateLimit = rateLimiters.scan;
  const uploadRateLimit = rateLimiters.upload;
  const writeRateLimit = rateLimiters.write;

  const uploadProfile = multer({ storage: multer.memoryStorage(), fileFilter: imageFilter, limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }).single('image');
  const uploadProduct = multer({ storage: multer.memoryStorage(), fileFilter: imageFilter, limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }).single('image');

  const authenticate = async (req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    let payload;
    try { payload = jwt.verify(token, jwtSecret); } catch (_err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    try {
      const { rows } = await pool.query('SELECT token_version FROM auth WHERE username = $1', [payload.username]);
      if (!rows.length || Number(rows[0].token_version || 0) !== Number(payload.tokenVersion || 0)) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      req.user = payload;
      return next();
    } catch (err) { return next(err); }
  };

  const authorize = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };

  const getChainContract = () => {
    const address = normalizedAddress(contractAddress);
    if (!address || !rpcUrl) {
      const error = new Error('Wallet verification is not configured on the server');
      error.status = 503;
      throw error;
    }
    if (chainAdapter) return chainAdapter({ rpcUrl, address, abi: CHAIN_ROLE_ABI });
    return { provider: chainProvider, contract: new ethers.Contract(address, CHAIN_ROLE_ABI, chainProvider), address };
  };

  const createWalletChallenge = async (client, { username, role, walletAddress, operationId = null, action = 'link', actorUsername = username }) => {
    const challengeId = crypto.randomUUID();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
    const nonce = crypto.randomBytes(16).toString('hex');
    const domain = (() => { try { return new URL(walletLinkOrigin).host; } catch { return walletLinkOrigin; } })();
    const message = [
      'SmartScan Wallet Authorization',
      `Domain: ${domain}`,
      `Account: ${username}`,
      `Application role: ${role}`,
      `Action: ${action}`,
      `Wallet: ${walletAddress}`,
      `Operation: ${operationId || 'self-link'}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expiration Time: ${expiresAt.toISOString()}`,
    ].join('\n');
    await client.query('DELETE FROM wallet_link_challenges WHERE username = $1 AND consumed_at IS NULL', [username]);
    await client.query(
      'INSERT INTO wallet_link_challenges (id, username, operation_id, wallet_address, message, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [challengeId, username, operationId, walletAddress, message, expiresAt],
    );
    await client.query(
      'INSERT INTO wallet_account_events (username, wallet_address, event_type, details) VALUES ($1,$2,$3,$4)',
      [username, walletAddress, 'ownership_challenge_issued', { challengeId, action, requestedBy: actorUsername }],
    );
    return { challengeId, message, expiresAt: expiresAt.toISOString() };
  };

  // --- auth ---

  app.post('/auth', authRateLimit, async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      if (!validText(username, 50) || !validText(password, 200)) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      const { rows } = await pool.query('SELECT username, password, role, wallet_address, wallet_status, token_version FROM auth WHERE username = $1', [username]);
      if (rows.length === 0 || !verifyPassword(password, rows[0].password)) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      const account = rows[0];
      if (!isHashed(account.password)) {
        // Opportunistically upgrade legacy plaintext passwords on successful login.
        await pool.query('UPDATE auth SET password = $1 WHERE username = $2', [hashPassword(password), username]);
      }
      const token = jwt.sign({ username: account.username, role: account.role, tokenVersion: Number(account.token_version || 0) }, jwtSecret, { expiresIn: jwtExpiresIn });
      return res.json({ token, user: { username: account.username, role: account.role, walletAddress: account.wallet_address, walletStatus: account.wallet_status } });
    } catch (err) {
      return next(err);
    }
  });

  app.get('/wallet-link/status', authenticate, async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, action, new_wallet_address, status, created_at FROM wallet_operations WHERE username = $1 AND status IN ('pending_wallet_proof', 'ready_onchain') ORDER BY created_at DESC LIMIT 1",
        [req.user.username],
      );
      return res.json({ operation: rows[0] || null });
    } catch (err) { return next(err); }
  });

  // Users prove control of their own wallet. The owner/Safe remains responsible
  // only for assigning the corresponding on-chain business role.
  app.post('/wallet-link/challenge', authenticate, authRateLimit, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const walletAddress = normalizedAddress(req.body?.walletAddress);
      if (!walletAddress) return res.status(400).json({ error: 'A valid wallet address is required' });
      await client.query('BEGIN');
      const result = await client.query(
        'SELECT a.role, a.wallet_address, a.wallet_status, p.name AS business_name FROM auth a JOIN profile p ON p.username = a.username WHERE a.username = $1 FOR UPDATE OF a',
        [req.user.username],
      );
      if (!result.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Account not found' }); }
      const account = result.rows[0];
      if (!['manufacturer', 'supplier', 'retailer'].includes(account.role)) {
        await client.query('ROLLBACK'); return res.status(403).json({ error: 'Wallet self-linking is available only for manufacturer, supplier, and retailer accounts.' });
      }
      const action = account.wallet_status === 'active' && account.wallet_address ? 'replace' : 'link';
      if ((action === 'link' && !['unlinked', 'revoked'].includes(account.wallet_status)) ||
          (action === 'replace' && account.wallet_status !== 'active')) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'A wallet operation is already pending or the account wallet is suspended.' });
      }
      if (action === 'replace' && account.wallet_address.toLowerCase() === walletAddress.toLowerCase()) {
        await client.query('ROLLBACK'); return res.status(400).json({ error: 'Connect a different wallet to replace the current one.' });
      }
      const openOperation = await client.query(
        "SELECT * FROM wallet_operations WHERE username = $1 AND status IN ('pending_wallet_proof', 'ready_onchain') LIMIT 1 FOR UPDATE",
        [req.user.username],
      );
      if (openOperation.rowCount) {
        const operation = openOperation.rows[0];
        if (operation.status === 'pending_wallet_proof' && operation.new_wallet_address.toLowerCase() === walletAddress.toLowerCase()) {
          const challenge = await createWalletChallenge(client, {
            username: req.user.username, role: account.role, walletAddress, operationId: operation.id, action: operation.action,
          });
          await client.query('COMMIT');
          return res.json({ ...challenge, operationId: operation.id, action: operation.action });
        }
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'A wallet operation is already in progress. Finish or ask an administrator to cancel it before choosing another wallet.' });
      }
      const duplicate = await client.query('SELECT username FROM auth WHERE lower(wallet_address) = lower($1) AND username <> $2', [walletAddress, req.user.username]);
      if (duplicate.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'That wallet is already linked to another account.' }); }
      const { contract } = getChainContract();
      const [owner, chainRole, successor] = await Promise.all([contract.owner(), contract.roles(walletAddress), contract.walletSuccessor(walletAddress)]);
      if (owner.toLowerCase() === walletAddress.toLowerCase() || Number(chainRole) !== 0 || successor !== ethers.ZeroAddress) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Choose an unused wallet with no existing business role or retired-wallet status.' });
      }
      const operationId = crypto.randomUUID();
      await client.query(
        "INSERT INTO wallet_operations (id, username, action, old_wallet_address, new_wallet_address, role, business_name, requested_by, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_wallet_proof')",
        [operationId, req.user.username, action, account.wallet_address, walletAddress, account.role, account.business_name, req.user.username],
      );
      await client.query(
        'INSERT INTO wallet_operation_events (operation_id, actor_username, event_type, details) VALUES ($1,$2,$3,$4)',
        [operationId, req.user.username, 'user_requested_wallet_link', { action, walletAddress }],
      );
      const challenge = await createWalletChallenge(client, {
        username: req.user.username, role: account.role, walletAddress, operationId, action,
      });
      await client.query('COMMIT');
      return res.status(201).json({ ...challenge, operationId, action });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* transaction may already be closed */ }
      if (err.code === '23505') return res.status(409).json({ error: 'A wallet is already linked or an operation is in progress.' });
      return next(err);
    } finally { client.release(); }
  });

  app.post('/wallet-link/verify', authenticate, authRateLimit, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { challengeId, signature } = req.body || {};
      if (!/^[0-9a-f-]{36}$/i.test(challengeId || '') || !validText(signature, 300)) return res.status(400).json({ error: 'Challenge and signature are required' });
      await client.query('BEGIN');
      const challengeResult = await client.query(
        'SELECT * FROM wallet_link_challenges WHERE id = $1 AND username = $2 AND operation_id IS NOT NULL FOR UPDATE',
        [challengeId, req.user.username],
      );
      if (!challengeResult.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Wallet-link challenge not found' }); }
      const challenge = challengeResult.rows[0];
      if (challenge.consumed_at || new Date(challenge.expires_at) <= new Date()) { await client.query('ROLLBACK'); return res.status(410).json({ error: 'Wallet challenge expired or already used' }); }
      let recovered;
      try { recovered = normalizedAddress(ethers.verifyMessage(challenge.message, signature)); } catch (_signatureError) { recovered = null; }
      if (!recovered || recovered.toLowerCase() !== challenge.wallet_address.toLowerCase()) { await client.query('ROLLBACK'); return res.status(401).json({ error: 'Wallet signature does not match the challenged address' }); }
      const operationResult = await client.query('SELECT * FROM wallet_operations WHERE id = $1 AND username = $2 FOR UPDATE', [challenge.operation_id, req.user.username]);
      const operation = operationResult.rows[0];
      if (!operation || operation.status !== 'pending_wallet_proof' || !challenge.message.includes(`Action: ${operation.action}`)) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'Wallet operation changed; request a new challenge.' });
      }
      const { contract } = getChainContract();
      const [owner, chainRole, businessName, successor] = await Promise.all([
        contract.owner(), contract.roles(recovered), contract.businessNames(recovered), contract.walletSuccessor(recovered),
      ]);
      if (owner.toLowerCase() === recovered.toLowerCase() || Number(chainRole) !== 0 || successor !== ethers.ZeroAddress) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'Wallet is no longer available for this business role.' });
      }
      const accountResult = await client.query('SELECT role, wallet_address, wallet_status FROM auth WHERE username = $1 FOR UPDATE', [req.user.username]);
      const account = accountResult.rows[0];
      if (!account || account.role !== operation.role || (operation.action === 'link' && (account.wallet_address || !['unlinked', 'revoked'].includes(account.wallet_status))) ||
          (operation.action === 'replace' && (account.wallet_address?.toLowerCase() !== operation.old_wallet_address?.toLowerCase() || account.wallet_status !== 'active'))) {
        await client.query('ROLLBACK'); return res.status(409).json({ error: 'Account wallet state changed; contact an administrator.' });
      }
      await client.query('UPDATE wallet_link_challenges SET consumed_at = now() WHERE id = $1', [challengeId]);
      await client.query("UPDATE wallet_operations SET status = 'ready_onchain' WHERE id = $1", [operation.id]);
      if (operation.action === 'link') {
        await client.query("UPDATE auth SET wallet_address = $1, wallet_status = 'pending_onchain' WHERE username = $2", [recovered, req.user.username]);
      }
      await client.query(
        'INSERT INTO wallet_operation_events (operation_id, actor_username, event_type, details) VALUES ($1,$2,$3,$4)',
        [operation.id, req.user.username, 'new_wallet_ownership_proved', { walletAddress: recovered }],
      );
      await client.query(
        'INSERT INTO wallet_account_events (username, wallet_address, event_type, details) VALUES ($1,$2,$3,$4)',
        [req.user.username, recovered, 'wallet_ownership_proved', { operationId: operation.id, action: operation.action }],
      );
      await client.query('COMMIT');
      return res.json({
        walletAddress: operation.action === 'link' ? recovered : account.wallet_address,
        pendingWalletAddress: recovered,
        walletStatus: operation.action === 'link' ? 'pending_onchain' : 'active',
        operationId: operation.id,
        action: operation.action,
        operationStatus: 'ready_onchain',
      });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* transaction may already be closed */ }
      if (err.code === '23505') return res.status(409).json({ error: 'That wallet is already linked to another account.' });
      return next(err);
    } finally { client.release(); }
  });

  app.post('/auth/wallet/challenge', authRateLimit, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const walletAddress = normalizedAddress(req.body?.walletAddress);
      if (!walletAddress) return res.status(400).json({ error: 'A valid wallet address is required.' });
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT username, role, wallet_address, wallet_status FROM auth WHERE lower(wallet_address) = lower($1)', [walletAddress]);
      const account = rows[0];
      if (!account || account.wallet_status !== 'active') { await client.query('ROLLBACK'); return res.status(401).json({ error: 'No active SmartScan account is linked to this wallet.' }); }
      if (!['manufacturer', 'supplier', 'retailer'].includes(account.role)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Wallet sign-in is available only for linked business accounts.' }); }
      const { contract } = getChainContract();
      if (Number(await contract.roles(walletAddress)) !== roleForChain(account.role)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'The linked wallet role does not match this account.' }); }
      const challenge = await createWalletChallenge(client, { username: account.username, role: account.role, walletAddress, action: 'wallet_login' });
      await client.query('COMMIT');
      return res.json(challenge);
    } catch (err) { try { await client.query('ROLLBACK'); } catch (_rollbackError) {} return next(err); } finally { client.release(); }
  });

  app.post('/auth/wallet/verify', authRateLimit, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { challengeId, signature } = req.body || {};
      if (!/^[0-9a-f-]{36}$/i.test(challengeId || '') || !validText(signature, 300)) return res.status(400).json({ error: 'Challenge and signature are required.' });
      await client.query('BEGIN');
      const result = await client.query('SELECT * FROM wallet_link_challenges WHERE id = $1 AND operation_id IS NULL FOR UPDATE', [challengeId]);
      const challenge = result.rows[0];
      if (!challenge || !challenge.message.includes('Action: wallet_login')) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Wallet login challenge not found.' }); }
      if (challenge.consumed_at || new Date(challenge.expires_at) <= new Date()) { await client.query('ROLLBACK'); return res.status(410).json({ error: 'Wallet login challenge expired or already used.' }); }
      let recovered;
      try { recovered = normalizedAddress(ethers.verifyMessage(challenge.message, signature)); } catch (_signatureError) { recovered = null; }
      if (!recovered || recovered.toLowerCase() !== challenge.wallet_address.toLowerCase()) { await client.query('ROLLBACK'); return res.status(401).json({ error: 'Wallet signature is invalid.' }); }
      const accountResult = await client.query('SELECT username, role, wallet_address, wallet_status, token_version FROM auth WHERE username = $1 FOR UPDATE', [challenge.username]);
      const account = accountResult.rows[0];
      if (!account || account.wallet_status !== 'active' || account.wallet_address?.toLowerCase() !== recovered.toLowerCase()) { await client.query('ROLLBACK'); return res.status(401).json({ error: 'This wallet is not actively linked to an account.' }); }
      const { contract } = getChainContract();
      if (Number(await contract.roles(recovered)) !== roleForChain(account.role)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'On-chain wallet role does not match this account.' }); }
      await client.query('UPDATE wallet_link_challenges SET consumed_at = now() WHERE id = $1', [challengeId]);
      await client.query('COMMIT');
      const token = jwt.sign({ username: account.username, role: account.role, tokenVersion: Number(account.token_version || 0) }, jwtSecret, { expiresIn: jwtExpiresIn });
      return res.json({ token, user: { username: account.username, role: account.role, walletAddress: account.wallet_address, walletStatus: account.wallet_status } });
    } catch (err) { try { await client.query('ROLLBACK'); } catch (_rollbackError) {} return next(err); } finally { client.release(); }
  });

  app.post('/wallet/authorize-write', authenticate, writeRateLimit, async (req, res, next) => {
    try {
      const walletAddress = normalizedAddress(req.body?.walletAddress);
      const action = req.body?.action;
      if (!walletAddress || !['register_product', 'dispatch', 'confirm_delivery', 'mark_sold', 'recall'].includes(action)) {
        return res.status(400).json({ error: 'A valid wallet and supply-chain action are required' });
      }
      const { rows } = await pool.query('SELECT role, wallet_address, wallet_status FROM auth WHERE username = $1', [req.user.username]);
      if (!rows.length) return res.status(404).json({ error: 'Account not found' });
      const account = rows[0];
      const allowedRoles = {
        register_product: ['manufacturer'],
        dispatch: ['manufacturer', 'supplier'],
        confirm_delivery: ['supplier', 'retailer'],
        mark_sold: ['retailer'],
        recall: ['admin', 'manufacturer'],
      }[action];
      if (!allowedRoles.includes(account.role) || account.wallet_status !== 'active' ||
          !account.wallet_address || account.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ error: 'This application account is not authorized for the connected wallet and action' });
      }
      const { contract } = getChainContract();
      if (Number(await contract.roles(walletAddress)) !== roleForChain(account.role)) {
        return res.status(403).json({ error: 'Application and on-chain wallet roles do not agree' });
      }
      return res.json({ authorized: true, walletAddress, role: account.role });
    } catch (err) { return next(err); }
  });

  app.get('/authAll', authenticate, authorize('admin'), async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT id, username, role FROM auth');
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.post('/addaccount', authenticate, authorize('admin'), writeRateLimit, async (req, res, next) => {
    let client;
    try {
      const { username, password, role, name, description = '', website = '', location = '', image = '' } = req.body || {};
      if (!validText(username, 50) || !validNewPassword(password) || !validText(role, 20)) {
        return res.status(400).json({ success: 0, error: 'username, a password of at least 12 characters, and role are required' });
      }
      if (!ROLES.includes(role)) {
        return res.status(400).json({ success: 0, error: `role must be one of: ${ROLES.join(', ')}` });
      }
      const createsProfile = Object.prototype.hasOwnProperty.call(req.body || {}, 'name');
      if (createsProfile && (!validText(name, 100) || Buffer.byteLength(name.trim(), 'utf8') > 100
        || ![description, website, location, image].every((value) => typeof value === 'string' && value.length <= MAX_TEXT_LENGTH))) {
        return res.status(400).json({ success: 0, error: 'A profile requires a business name of at most 100 UTF-8 bytes and text fields of at most 500 characters' });
      }
      client = await pool.connect();
      await client.query('BEGIN');
      const exists = await client.query('SELECT 1 FROM auth WHERE username = $1', [username]);
      if (exists.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: 0, error: 'Username already exists' });
      }
      await client.query('INSERT INTO auth (username, password, role) VALUES ($1, $2, $3)', [username, hashPassword(password), role]);
      if (createsProfile) {
        await client.query(
          'INSERT INTO profile (username, name, description, website, location, image, role) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [username, name.trim(), description, website, location, image, role],
        );
      }
      await client.query('COMMIT');
      return res.json({ success: 1 });
    } catch (err) {
      try { if (client) await client.query('ROLLBACK'); } catch (_rollbackError) { /* transaction may already be closed */ }
      if (err.code === '23505') return res.status(409).json({ success: 0, error: 'Username or profile already exists' });
      return next(err);
    } finally { client?.release(); }
  });

  app.post('/changepsw', authenticate, writeRateLimit, async (req, res, next) => {
    let client;
    try {
      client = await pool.connect();
      const { username, currentPassword, newPassword } = req.body || {};
      if (username !== undefined && !validText(username, 50)) {
        return res.status(400).json({ success: 0, error: 'Invalid target account' });
      }
      const target = req.user.role === 'admin' && username ? username : req.user.username;
      if (req.user.role !== 'admin' && username && username !== req.user.username) {
        return res.status(403).json({ success: 0, error: 'You can only change your own password' });
      }
      if (!validText(currentPassword, 200) || !validNewPassword(newPassword)) {
        return res.status(400).json({ success: 0, error: 'Current password and a new password of at least 12 characters are required' });
      }
      await client.query('BEGIN');
      const actor = await client.query('SELECT password FROM auth WHERE username = $1 FOR UPDATE', [req.user.username]);
      if (!actor.rows.length || !verifyPassword(currentPassword, actor.rows[0].password)) {
        await client.query('ROLLBACK');
        return res.status(401).json({ success: 0, error: 'Current password is incorrect' });
      }
      const targetAccount = target === req.user.username
        ? actor
        : await client.query('SELECT password FROM auth WHERE username = $1 FOR UPDATE', [target]);
      if (!targetAccount.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: 0, error: 'Account not found' });
      }
      if (verifyPassword(newPassword, targetAccount.rows[0].password)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: 0, error: 'New password must differ from the current password' });
      }
      const updated = await client.query(
        'UPDATE auth SET password = $1, token_version = token_version + 1 WHERE username = $2 RETURNING username',
        [hashPassword(newPassword), target],
      );
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: 0, error: 'Account not found' });
      }
      const eventType = target === req.user.username ? 'password_changed' : 'password_reset';
      await client.query(
        'INSERT INTO auth_password_events (actor_username, target_username, event_type) VALUES ($1, $2, $3)',
        [req.user.username, target, eventType],
      );
      await client.query('COMMIT');
      return res.json({ success: 1, requiresReauthentication: true });
    } catch (err) {
      try { if (client) await client.query('ROLLBACK'); } catch (_rollbackError) { /* transaction may already be closed */ }
      return next(err);
    } finally { client?.release(); }
  });

  // --- profile ---

  app.get('/profileAll', authenticate, authorize('admin'), async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT p.*, a.role AS account_role, a.wallet_address, a.wallet_status FROM profile p JOIN auth a ON a.username = p.username ORDER BY p.username');
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
      const { rows } = await pool.query('SELECT p.*, a.role AS account_role, a.wallet_address, a.wallet_status FROM profile p JOIN auth a ON a.username = p.username WHERE p.username = $1', [username]);
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.get('/admin/wallet-operations', authenticate, authorize('admin'), async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT o.*, COALESCE(json_agg(json_build_object(\'eventType\', e.event_type, \'actor\', e.actor_username, \'details\', e.details, \'createdAt\', e.created_at) ORDER BY e.created_at, e.id) FILTER (WHERE e.id IS NOT NULL), \'[]\') AS events FROM wallet_operations o LEFT JOIN wallet_operation_events e ON e.operation_id = o.id GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100',
      );
      return res.json(rows);
    } catch (err) { return next(err); }
  });

  app.get('/admin/wallet-audit', authenticate, authorize('admin'), async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT username, wallet_address, event_type, details, created_at FROM wallet_account_events ORDER BY created_at DESC, id DESC LIMIT 100',
      );
      return res.json(rows);
    } catch (err) { return next(err); }
  });

  app.get('/admin/password-audit', authenticate, authorize('admin'), async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, actor_username, target_username, event_type, created_at FROM auth_password_events ORDER BY created_at DESC, id DESC LIMIT 100',
      );
      return res.json(rows);
    } catch (err) { return next(err); }
  });

  app.get('/admin/unassigned-products', authenticate, authorize('admin'), async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT p.serialnumber, p.name, p.brand, p.chain_status, p.failure_reason, p.created_at
           FROM product p
          WHERE p.manufacturer_username IS NULL
            AND p.chain_status IN ('needs_retry', 'failed')
            AND p.chain_tx_hash IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM product_chain_attempts a
               WHERE a.serial_number = p.serialnumber AND a.transaction_hash IS NOT NULL
            )
          ORDER BY p.created_at ASC, p.serialnumber LIMIT 100`,
      );
      return res.json(rows);
    } catch (err) { return next(err); }
  });

  app.post('/admin/products/:serialNumber/rekey-legacy', authenticate, authorize('admin'), writeRateLimit, async (req, res, next) => {
    let client;
    try {
      const { serialNumber: previousSerialNumber } = req.params;
      const { newSerialNumber, evidenceReference, sourceRecordVerified } = req.body || {};
      if (!validText(previousSerialNumber, 100) || validProductIdentifier(previousSerialNumber)
        || !validProductIdentifier(newSerialNumber) || newSerialNumber === previousSerialNumber
        || !validText(evidenceReference, 500) || evidenceReference.trim().length < 8
        || sourceRecordVerified !== true) {
        return res.status(400).json({ error: 'A legacy ID, new canonical SS-UUID, verified source-record confirmation, and traceable evidence reference are required' });
      }

      // Fail closed unless both identities are absent from the configured chain.
      const [previousChainProduct, newChainProduct] = await Promise.all([
        verifyScanProduct(previousSerialNumber),
        verifyScanProduct(newSerialNumber),
      ]);
      if (previousChainProduct.exists || newChainProduct.exists) {
        return res.status(409).json({ error: 'One of these identifiers already exists on the configured chain; investigate chain history instead of rekeying' });
      }

      client = await pool.connect();
      await client.query('BEGIN');
      const product = await client.query(
        `SELECT serialnumber, manufacturer_username, chain_status, chain_tx_hash, chain_sender, chain_contract_address, chain_expected_id, chain_id
           FROM product WHERE serialnumber = $1 FOR UPDATE`,
        [previousSerialNumber],
      );
      if (!product.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Legacy product not found' });
      }
      const legacy = product.rows[0];
      if (legacy.manufacturer_username || !['needs_retry', 'failed'].includes(legacy.chain_status)
        || legacy.chain_tx_hash || legacy.chain_sender || legacy.chain_contract_address || legacy.chain_expected_id || legacy.chain_id) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Only unassigned, hashless legacy products with no recorded chain identity can be rekeyed' });
      }
      const attempts = await client.query(
        'SELECT 1 FROM product_chain_attempts WHERE serial_number = $1 AND (transaction_hash IS NOT NULL OR sender_address IS NOT NULL OR contract_address IS NOT NULL) LIMIT 1',
        [previousSerialNumber],
      );
      if (attempts.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Product has recorded chain identity; reconcile it instead of rekeying' });
      }
      const existingTarget = await client.query('SELECT 1 FROM product WHERE serialnumber = $1 FOR KEY SHARE', [newSerialNumber]);
      if (existingTarget.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'The new identifier already exists in the database; generate another canonical ID' });
      }
      const updated = await client.query(
        'UPDATE product SET serialnumber = $1 WHERE serialnumber = $2 RETURNING serialnumber',
        [newSerialNumber, previousSerialNumber],
      );
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Product identity changed while rekeying; refresh and review again' });
      }
      await client.query(
        'INSERT INTO product_identity_rekey_events (previous_serial_number, new_serial_number, actor_username, evidence_reference) VALUES ($1, $2, $3, $4)',
        [previousSerialNumber, newSerialNumber, req.user.username, evidenceReference.trim()],
      );
      await client.query('COMMIT');
      return res.status(201).json({ previousSerialNumber, newSerialNumber, chainStatus: legacy.chain_status, assignedManufacturer: false, oldIdentifierRemainsInvalid: true });
    } catch (err) {
      try { if (client) await client.query('ROLLBACK'); } catch (_rollbackError) { /* transaction may already be closed */ }
      return next(err);
    } finally { client?.release(); }
  });

  app.get('/admin/product-identity-rekey-audit', authenticate, authorize('admin'), async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, previous_serial_number, new_serial_number, actor_username, evidence_reference, created_at FROM product_identity_rekey_events ORDER BY created_at DESC, id DESC LIMIT 100',
      );
      return res.json(rows);
    } catch (err) { return next(err); }
  });

  app.post('/admin/products/:serialNumber/assign-manufacturer', authenticate, authorize('admin'), writeRateLimit, async (req, res, next) => {
    let client;
    try {
      const { serialNumber } = req.params;
      const { manufacturerUsername, evidenceReference, sourceRecordVerified } = req.body || {};
      if (!validProductIdentifier(serialNumber) || !validText(manufacturerUsername, 50)
        || !validText(evidenceReference, 500) || evidenceReference.trim().length < 8 || sourceRecordVerified !== true) {
        return res.status(400).json({ error: 'Product identifier, manufacturer account, source-record confirmation, and a traceable reference (at least 8 characters) are required' });
      }
      client = await pool.connect();
      await client.query('BEGIN');
      const product = await client.query(
        'SELECT serialnumber, manufacturer_username, chain_status, chain_tx_hash FROM product WHERE serialnumber = $1 FOR UPDATE',
        [serialNumber],
      );
      if (!product.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }
      const legacy = product.rows[0];
      if (legacy.manufacturer_username || !['needs_retry', 'failed'].includes(legacy.chain_status) || legacy.chain_tx_hash) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Only unassigned hashless products in a failed or retryable state can be assigned' });
      }
      const target = await client.query('SELECT role FROM auth WHERE username = $1 FOR SHARE', [manufacturerUsername]);
      if (!target.rows.length || target.rows[0].role !== 'manufacturer') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'The selected account is not a manufacturer' });
      }
      const attempts = await client.query(
        'SELECT 1 FROM product_chain_attempts WHERE serial_number = $1 AND transaction_hash IS NOT NULL LIMIT 1',
        [serialNumber],
      );
      if (attempts.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Product has a transaction attempt; resolve its chain history instead of changing its manufacturer' });
      }
      const updated = await client.query(
        'UPDATE product SET manufacturer_username = $1 WHERE serialnumber = $2 AND manufacturer_username IS NULL RETURNING serialnumber',
        [manufacturerUsername, serialNumber],
      );
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Product ownership changed while assigning it; refresh and review again' });
      }
      await client.query(
        'INSERT INTO product_manufacturer_assignment_events (serial_number, previous_manufacturer_username, new_manufacturer_username, actor_username, evidence_reference) VALUES ($1, $2, $3, $4, $5)',
        [serialNumber, legacy.manufacturer_username, manufacturerUsername, req.user.username, evidenceReference.trim()],
      );
      await client.query('COMMIT');
      return res.status(201).json({ serialNumber, manufacturerUsername, status: legacy.chain_status, assigned: true });
    } catch (err) {
      try { if (client) await client.query('ROLLBACK'); } catch (_rollbackError) { /* transaction may already be closed */ }
      return next(err);
    } finally { client?.release(); }
  });

  app.get('/admin/manufacturer-assignment-audit', authenticate, authorize('admin'), async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, serial_number, previous_manufacturer_username, new_manufacturer_username, actor_username, evidence_reference, created_at FROM product_manufacturer_assignment_events ORDER BY created_at DESC, id DESC LIMIT 100',
      );
      return res.json(rows);
    } catch (err) { return next(err); }
  });

  app.post('/admin/wallet-operations', authenticate, authorize('admin'), writeRateLimit, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { username, action } = req.body || {};
      const newWalletAddress = req.body?.newWalletAddress ? normalizedAddress(req.body.newWalletAddress) : null;
      if (!validText(username, 50) || !['link', 'replace', 'suspend', 'revoke', 'restore'].includes(action)) {
        return res.status(400).json({ error: 'A target account and valid wallet operation are required' });
      }
      if (['link', 'replace'].includes(action)) {
        return res.status(403).json({ error: 'Users must request linking or replacement from their own Profile using their wallet. Admins execute the resulting owner-authorized chain operation from the audit queue.' });
      }
      if (['link', 'replace'].includes(action) && !newWalletAddress) return res.status(400).json({ error: 'A valid new wallet address is required' });
      await client.query('BEGIN');
      const result = await client.query(
        'SELECT a.username, a.role, a.wallet_address, a.wallet_status, p.name AS business_name FROM auth a JOIN profile p ON p.username = a.username WHERE a.username = $1 FOR UPDATE OF a',
        [username],
      );
      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Target account/profile not found' });
      }
      const account = result.rows[0];
      const currentWallet = account.wallet_address;
      if (!roleForChain(account.role) || !validText(account.business_name, 100)
        || Buffer.byteLength(account.business_name.trim(), 'utf8') > 100) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Target account needs a supported role and registered business name' });
      }
      const requirements = {
        link: !currentWallet && ['unlinked', 'revoked'].includes(account.wallet_status),
        replace: Boolean(currentWallet) && account.wallet_status === 'active',
        suspend: Boolean(currentWallet) && account.wallet_status === 'active',
        revoke: Boolean(currentWallet) && ['active', 'suspended'].includes(account.wallet_status),
        restore: Boolean(currentWallet) && account.wallet_status === 'suspended',
      };
      if (!requirements[action]) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Operation ${action} is not valid for the account's current wallet state` });
      }
      if (newWalletAddress && currentWallet && newWalletAddress.toLowerCase() === currentWallet.toLowerCase()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'New wallet must differ from the current wallet' });
      }
      if (newWalletAddress) {
        const duplicate = await client.query('SELECT username FROM auth WHERE lower(wallet_address) = lower($1) AND username <> $2', [newWalletAddress, username]);
        if (duplicate.rowCount) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'That wallet is already linked to another account' });
        }
        const { contract } = getChainContract();
        const [contractOwner, newRole, successor] = await Promise.all([
          contract.owner(), contract.roles(newWalletAddress), contract.walletSuccessor(newWalletAddress),
        ]);
        const roleId = roleForChain(account.role);
        const roleConflict = action === 'replace'
          ? Number(newRole) !== 0 || successor !== ethers.ZeroAddress
          : (Number(newRole) !== 0 && Number(newRole) !== roleId) || successor !== ethers.ZeroAddress;
        if (contractOwner.toLowerCase() === newWalletAddress.toLowerCase() || roleConflict) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'The new wallet is the contract owner, already has a conflicting role, or is a retired wallet' });
        }
      }
      const operationId = crypto.randomUUID();
      const initialStatus = ['link', 'replace'].includes(action) ? 'pending_wallet_proof' : 'ready_onchain';
      await client.query(
        'INSERT INTO wallet_operations (id, username, action, old_wallet_address, new_wallet_address, role, business_name, requested_by, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [operationId, username, action, currentWallet, newWalletAddress, account.role, account.business_name, req.user.username, initialStatus],
      );
      await client.query(
        'INSERT INTO wallet_operation_events (operation_id, actor_username, event_type, details) VALUES ($1,$2,$3,$4)',
        [operationId, req.user.username, 'requested', { action, oldWalletAddress: currentWallet, newWalletAddress }],
      );
      let challenge = null;
      if (['link', 'replace'].includes(action)) {
        challenge = await createWalletChallenge(client, {
          username, role: account.role, walletAddress: newWalletAddress, operationId, action, actorUsername: req.user.username,
        });
      }
      await client.query('COMMIT');
      return res.status(201).json({ operationId, action, status: initialStatus, challenge });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* transaction may already be closed */ }
      if (err.code === '23505') return res.status(409).json({ error: 'This account already has a wallet operation awaiting completion' });
      return next(err);
    } finally { client.release(); }
  });

  app.post('/admin/wallet-operations/:id/verify-wallet', authenticate, authorize('admin'), writeRateLimit, async (req, res, next) => {
    return res.status(403).json({ error: 'Wallet ownership proof must be signed by the business user from their own account.' });
  });

  app.post('/admin/wallet-operations/:id/cancel', authenticate, authorize('admin'), writeRateLimit, async (req, res, next) => {
    const client = await pool.connect();
    try {
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid wallet operation identifier' });
      await client.query('BEGIN');
      const result = await client.query('SELECT * FROM wallet_operations WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Wallet operation not found' });
      }
      const operation = result.rows[0];
      if (operation.status !== 'pending_wallet_proof') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Only an operation awaiting wallet proof can be cancelled; ready on-chain operations must be completed or reconciled' });
      }
      await client.query("UPDATE wallet_operations SET status = 'cancelled' WHERE id = $1", [operation.id]);
      await client.query(
        'INSERT INTO wallet_operation_events (operation_id, actor_username, event_type, details) VALUES ($1,$2,$3,$4)',
        [operation.id, req.user.username, 'cancelled', {}],
      );
      await client.query('COMMIT');
      return res.json({ operationId: operation.id, status: 'cancelled' });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* transaction may already be closed */ }
      return next(err);
    } finally { client.release(); }
  });

  app.post('/admin/wallet-operations/:id/record-transaction', authenticate, authorize('admin'), writeRateLimit, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const txHash = req.body?.txHash;
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id) || !/^0x[a-fA-F0-9]{64}$/.test(txHash || '')) {
        return res.status(400).json({ error: 'Valid operation and transaction identifiers are required' });
      }
      const { provider, contract, address } = getChainContract();
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== Number(configuredChainId)) return res.status(503).json({ error: 'Configured wallet-administration RPC is connected to the wrong chain' });
      const transaction = await provider.getTransaction(txHash);
      if (!transaction || transaction.hash.toLowerCase() !== txHash.toLowerCase() || Number(transaction.chainId) !== Number(configuredChainId)) {
        return res.status(409).json({ error: 'Transaction is not available on the configured chain' });
      }
      const operationResult = await pool.query('SELECT * FROM wallet_operations WHERE id = $1', [req.params.id]);
      if (!operationResult.rows.length) return res.status(404).json({ error: 'Wallet operation not found' });
      const candidateOperation = operationResult.rows[0];
      if (candidateOperation.status !== 'ready_onchain') return res.status(409).json({ error: 'Wallet operation is not ready for an owner transaction' });
      const owner = await contract.owner();
      if (candidateOperation.tx_hash && candidateOperation.tx_hash.toLowerCase() !== txHash.toLowerCase()) {
        return res.status(409).json({ error: 'A different transaction is already recorded for this operation' });
      }
      const directOwnerTransaction = isDirectOwnerWalletOperation(transaction, owner, address, candidateOperation);
      let safeReceipt = null;
      if (!directOwnerTransaction) {
        safeReceipt = await provider.getTransactionReceipt(txHash);
        if (!transaction.to || transaction.to.toLowerCase() !== owner.toLowerCase()
          || !safeReceipt || safeReceipt.status !== 1 || !hasExpectedWalletOperationEvent(safeReceipt, address, candidateOperation)) {
          return res.status(409).json({ error: 'Use the exact direct owner call or provide a mined Safe/multisig transaction with the expected role-change event from this contract' });
        }
      }

      await client.query('BEGIN');
      const result = await client.query('SELECT * FROM wallet_operations WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Wallet operation not found' });
      }
      const operation = result.rows[0];
      if (operation.status !== 'ready_onchain') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Wallet operation is not ready for an owner transaction' });
      }
      const lockedDirectTransaction = isDirectOwnerWalletOperation(transaction, owner, address, operation);
      const lockedSafeExecution = Boolean(transaction.to && transaction.to.toLowerCase() === owner.toLowerCase()
        && safeReceipt && safeReceipt.status === 1 && hasExpectedWalletOperationEvent(safeReceipt, address, operation));
      if (!lockedDirectTransaction && !lockedSafeExecution) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'The chain transaction no longer matches the locked wallet operation' });
      }
      const method = expectedCall(operation)?.method;
      if (!method) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Wallet operation has an unsupported action or role' });
      }
      if (operation.tx_hash && operation.tx_hash.toLowerCase() !== txHash.toLowerCase()) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'A different transaction is already recorded for this operation' });
      }
      await client.query('UPDATE wallet_operations SET tx_hash = $1 WHERE id = $2', [txHash, operation.id]);
      await client.query(
        'INSERT INTO wallet_operation_events (operation_id, actor_username, event_type, details) VALUES ($1,$2,$3,$4)',
        [operation.id, req.user.username, 'owner_transaction_submitted', { txHash, method, executionMode: lockedSafeExecution ? 'multisig' : 'direct' }],
      );
      await client.query('COMMIT');
      return res.json({ operationId: operation.id, txHash, status: 'ready_onchain' });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* transaction may already be closed */ }
      return next(err);
    } finally { client.release(); }
  });

  app.post('/admin/wallet-operations/:id/complete', authenticate, authorize('admin'), writeRateLimit, async (req, res, next) => {
    const client = await pool.connect();
    try {
      const suppliedTxHash = req.body?.txHash;
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid wallet operation identifier' });
      if (suppliedTxHash && !/^0x[a-fA-F0-9]{64}$/.test(suppliedTxHash)) return res.status(400).json({ error: 'Invalid transaction hash' });
      const stored = suppliedTxHash ? null : await pool.query('SELECT tx_hash FROM wallet_operations WHERE id = $1', [req.params.id]);
      const txHash = suppliedTxHash || stored?.rows[0]?.tx_hash;
      if (!txHash) return res.status(400).json({ error: 'A transaction hash is required' });
      const { provider, contract, address } = getChainContract();
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== Number(configuredChainId)) return res.status(503).json({ error: 'Configured wallet-administration RPC is connected to the wrong chain' });
      const receipt = await provider.getTransactionReceipt(txHash);
      const transaction = await provider.getTransaction(txHash);
      if (!receipt || !transaction) return res.status(409).json({ error: 'The wallet operation transaction is not mined yet' });
      if (receipt.status !== 1 || transaction.hash.toLowerCase() !== txHash.toLowerCase()
        || Number(transaction.chainId) !== Number(configuredChainId)) {
        return res.status(409).json({ error: 'Transaction failed or does not belong to the configured chain' });
      }

      await client.query('BEGIN');
      const operationResult = await client.query('SELECT * FROM wallet_operations WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!operationResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Wallet operation not found' });
      }
      const operation = operationResult.rows[0];
      if (operation.status !== 'ready_onchain') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Wallet operation is not ready for chain confirmation' });
      }
      if (operation.tx_hash && operation.tx_hash.toLowerCase() !== txHash.toLowerCase()) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Transaction hash does not match the audited owner transaction' });
      }
      const owner = await contract.owner();
      const directOwnerTransaction = isDirectOwnerWalletOperation(transaction, owner, address, operation);
      const multisigExecution = Boolean(transaction.to && transaction.to.toLowerCase() === owner.toLowerCase());
      if ((!directOwnerTransaction && !multisigExecution)
        || !hasExpectedWalletOperationEvent(receipt, address, operation)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Transaction is not an exact direct-owner call or Safe execution of this audited operation' });
      }
      const roleId = roleForChain(operation.role);
      const oldWallet = operation.old_wallet_address;
      const newWallet = operation.new_wallet_address;
      const oldRole = oldWallet ? Number(await contract.roles(oldWallet)) : 0;
      const newRole = newWallet ? Number(await contract.roles(newWallet)) : 0;
      const newName = newWallet ? await contract.businessNames(newWallet) : '';
      const oldName = oldWallet ? await contract.businessNames(oldWallet) : '';
      const eventMatches = hasExpectedWalletOperationEvent(receipt, address, operation);
      const stateMatches = operation.action === 'link'
        ? newRole === roleId && newName === operation.business_name
        : operation.action === 'replace'
          ? oldRole === 0 && newRole === roleId && newName === operation.business_name &&
            (await contract.walletSuccessor(oldWallet)).toLowerCase() === newWallet.toLowerCase()
          : operation.action === 'restore'
            ? oldRole === roleId && oldName === operation.business_name
          : operation.action === 'suspend'
            ? oldRole === 0 && oldName === ''
            : oldRole === 0 && oldName === '';
      if (!stateMatches || !eventMatches) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'On-chain wallet roles do not match the requested operation' });
      }
      const accountResult = await client.query('SELECT wallet_address, wallet_status FROM auth WHERE username = $1 FOR UPDATE', [operation.username]);
      if (!accountResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Target account no longer exists' });
      }
      let update;
      if (operation.action === 'link' || operation.action === 'replace') {
        update = await client.query(
          "UPDATE auth SET wallet_address = $1, wallet_status = 'active' WHERE username = $2 AND (( $4 = 'link' AND wallet_address = $1 AND wallet_status = 'pending_onchain') OR ($4 = 'replace' AND wallet_address IS NOT DISTINCT FROM $3))",
          [newWallet, operation.username, oldWallet, operation.action],
        );
      } else if (operation.action === 'suspend') {
        update = await client.query("UPDATE auth SET wallet_status = 'suspended' WHERE username = $1 AND wallet_address = $2 AND wallet_status = 'active'", [operation.username, oldWallet]);
      } else if (operation.action === 'restore') {
        update = await client.query("UPDATE auth SET wallet_status = 'active' WHERE username = $1 AND wallet_address = $2 AND wallet_status = 'suspended'", [operation.username, oldWallet]);
      } else {
        update = await client.query("UPDATE auth SET wallet_address = NULL, wallet_status = 'revoked' WHERE username = $1 AND wallet_address = $2", [operation.username, oldWallet]);
      }
      if (!update.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Account wallet changed while this operation was pending' });
      }
      await client.query("UPDATE wallet_operations SET status = 'completed', tx_hash = $1, completed_at = now() WHERE id = $2", [txHash, operation.id]);
      await client.query(
        'INSERT INTO wallet_operation_events (operation_id, actor_username, event_type, details) VALUES ($1,$2,$3,$4)',
        [operation.id, req.user.username, 'onchain_operation_completed', { txHash, chainId: Number(transaction.chainId) }],
      );
      if (oldWallet) {
        await client.query(
          'INSERT INTO wallet_account_events (username, wallet_address, event_type, details) VALUES ($1,$2,$3,$4)',
          [operation.username, oldWallet, `wallet_${operation.action}`, { operationId: operation.id, requestedBy: operation.requested_by, txHash }],
        );
      }
      if (newWallet) {
        await client.query(
          'INSERT INTO wallet_account_events (username, wallet_address, event_type, details) VALUES ($1,$2,$3,$4)',
          [operation.username, newWallet, `wallet_${operation.action}`, { operationId: operation.id, requestedBy: operation.requested_by, txHash }],
        );
      }
      await client.query('COMMIT');
      return res.json({ operationId: operation.id, status: 'completed', txHash });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* transaction may already be closed */ }
      if (err.code === '23505') return res.status(409).json({ error: 'Wallet is already linked to another account' });
      return next(err);
    } finally { client.release(); }
  });

  app.post('/addprofile', authenticate, authorize('admin'), writeRateLimit, async (req, res, next) => {
    try {
      const { username, name, description, website, location, image, role } = req.body || {};
      if (!validText(username, 50) || !validText(name, 100) || Buffer.byteLength(name.trim(), 'utf8') > 100 || !ROLES.includes(role)) {
        return res.status(400).json({ success: 0, error: 'A valid username, business name (up to 100 UTF-8 bytes), and role are required' });
      }
      const account = await pool.query('SELECT role FROM auth WHERE username = $1', [username]);
      if (!account.rows.length) return res.status(404).json({ success: 0, error: 'Account not found' });
      if (account.rows[0].role !== role) return res.status(409).json({ success: 0, error: 'Profile role must match the account role' });
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

  app.post('/upload/profile', authenticate, authorize('admin'), uploadRateLimit, uploadHandler(uploadProfile, uploadStore, 'profile'));
  app.post('/upload/product', authenticate, authorize('manufacturer'), uploadRateLimit, uploadHandler(uploadProduct, uploadStore, 'product'));

  app.get('/file/profile/:fileName', sendUpload(uploadStore, 'profile'));
  app.get('/file/product/:fileName', sendUpload(uploadStore, 'product'));

  // --- product ---

  app.get('/product/serialNumber', authenticate, async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT serialNumber FROM product');
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  app.post('/scan-events', scanRateLimit, async (req, res, next) => {
    try {
      const { serialNumber, contractAddress: submittedContractAddress, latitude, longitude } = req.body || {};
      if (!validText(serialNumber, 100)) {
        return res.status(400).json({ error: 'A product identifier is required' });
      }
      const hasLatitude = latitude !== undefined;
      const hasLongitude = longitude !== undefined;
      if (hasLatitude !== hasLongitude) return res.status(400).json({ error: 'Both location coordinates must be provided together' });
      const hasCoords = hasLatitude && hasLongitude;
      if (hasCoords && (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)) {
        return res.status(400).json({ error: 'Invalid scan coordinates' });
      }
      const requestAddress = normalizedAddress(submittedContractAddress);
      const flags = [];
      let outcome = 'invalid';
      let conflictingState = false;
      const requestMatchesConfiguredProduct = validProductIdentifier(serialNumber)
        && expectedContractAddress && requestAddress === expectedContractAddress;
      if (!requestMatchesConfiguredProduct) {
        flags.push('invalid_identifier');
      } else {
        let verification;
        try {
          verification = await verifyScanProduct(serialNumber);
        } catch (_error) {
          return res.status(503).json({ error: 'Authoritative product verification is temporarily unavailable; scan was not recorded' });
        }
        if (!verification?.exists) flags.push('invalid_identifier');
        else {
          outcome = 'valid';
          conflictingState = verification.conflictingState === true;
        }
      }
      const visitorHash = crypto.createHmac('sha256', jwtSecret).update(String(req.ip || req.socket.remoteAddress || 'unknown')).digest('hex');
      const lat = hasCoords ? Number(latitude.toFixed(2)) : null;
      const lon = hasCoords ? Number(longitude.toFixed(2)) : null;
      const locationSource = hasCoords ? 'browser_reported' : 'not_provided';
      const storedContractAddress = requestAddress;
      const priorLocations = hasCoords
        ? await pool.query('SELECT latitude, longitude FROM product_scans WHERE serial_number = $1 AND scanned_at > now() - interval \'1 hour\' AND latitude IS NOT NULL ORDER BY scanned_at DESC LIMIT 50', [serialNumber])
        : { rows: [] };
      if (conflictingState) flags.push('conflicting_product_state');
      const distanceKm = (aLat, aLon, bLat, bLon) => {
        const radians = (degrees) => degrees * Math.PI / 180;
        const dLat = radians(bLat - aLat);
        const dLon = radians(bLon - aLon);
        const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLon / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
      };
      if (priorLocations.rows.some((row) => distanceKm(lat, lon, Number(row.latitude), Number(row.longitude)) > 100)) {
        flags.push('suspicious_location');
      }
      const inserted = await pool.query(
        'INSERT INTO product_scans (serial_number, contract_address, visitor_hash, outcome, latitude, longitude, location_source, flags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [serialNumber, storedContractAddress, visitorHash, outcome, lat, lon, locationSource, flags],
      );
      const frequency = await pool.query('SELECT count(*)::int AS count FROM product_scans WHERE serial_number = $1 AND scanned_at > now() - interval \'10 minutes\'', [serialNumber]);
      if (frequency.rows[0].count >= 10) flags.push('unusual_frequency');
      if (flags.length) await pool.query('UPDATE product_scans SET flags = $1 WHERE id = $2', [flags, inserted.rows[0].id]);
      return res.status(201).json({ flags });
    } catch (err) { return next(err); }
  });

  app.get('/admin/scan-alerts', authenticate, authorize('admin'), async (_req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT serial_number, contract_address, outcome, latitude, longitude, location_source, flags, scanned_at FROM product_scans WHERE cardinality(flags) > 0 ORDER BY scanned_at DESC LIMIT 100');
      return res.json(rows);
    } catch (err) { return next(err); }
  });

  app.post('/addproduct', authenticate, authorize('manufacturer'), writeRateLimit, async (req, res, next) => {
    try {
      const { serialNumber, name, brand, description = '', image = '', actor = '', location = '', timestamp = '' } = req.body || {};
      if (!validProductIdentifier(serialNumber) || !validText(name, 50) || !validText(brand, 50) ||
          !['description', 'image', 'actor', 'location', 'timestamp'].every((field) => typeof req.body?.[field] === 'undefined' || typeof req.body[field] === 'string')) {
        return res.status(400).json({ success: 0, error: 'Valid product identifier, name and brand are required' });
      }
      if (description.length > 2000 || image.length > 255 || actor.length > 100 || location.length > 1000 || timestamp.length > 100 ||
          (image && path.basename(image) !== image)) {
        return res.status(400).json({ success: 0, error: 'Product registration metadata is invalid or too long' });
      }
      const linked = await pool.query('SELECT wallet_address, wallet_status FROM auth WHERE username = $1', [req.user.username]);
      const sender = linked.rows[0];
      const address = normalizedAddress(contractAddress);
      if (!sender?.wallet_address || sender.wallet_status !== 'active') return res.status(403).json({ success: 0, error: 'An active linked manufacturer wallet is required' });
      if (!address) return res.status(503).json({ success: 0, error: 'Contract address is not configured' });
      const created = await pool.query(
        `WITH created_product AS (
           INSERT INTO product (serialNumber, name, brand, manufacturer_username, chain_status, chain_attempt,
             chain_sender, chain_contract_address, chain_expected_id,
             chain_description, chain_image, chain_actor, chain_location, chain_timestamp)
           VALUES ($1, $2, $3, $4, 'pending_wallet', 1, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT DO NOTHING
           RETURNING serialnumber, chain_attempt, chain_sender, chain_contract_address, chain_expected_id, created_at
         )
         INSERT INTO product_chain_attempts (serial_number, attempt_number, status, expected_chain_id, contract_address, sender_address, created_at)
         SELECT serialnumber, chain_attempt, 'pending_wallet', chain_expected_id, chain_contract_address, chain_sender, created_at FROM created_product
         RETURNING serial_number`,
        [serialNumber, name, brand, req.user.username, normalizedAddress(sender.wallet_address), address, configuredChainId, description, image, actor, location, timestamp],
      );
      if (!created.rowCount) return res.status(409).json({ success: 0, error: 'Product identifier already exists' });
      return res.status(201).json({ success: 1, status: 'pending_wallet', attempt: 1 });
    } catch (err) {
      return next(err);
    }
  });

  app.post('/product/:serialNumber/chain-transaction', authenticate, authorize('manufacturer'), writeRateLimit, async (req, res, next) => {
    try {
      const txHash = req.body?.txHash;
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash || '')) return res.status(400).json({ error: 'A valid transaction hash is required' });
      const address = normalizedAddress(contractAddress);
      if (!address) return res.status(503).json({ error: 'Contract address is not configured' });
      const accountResult = await pool.query('SELECT wallet_address, wallet_status FROM auth WHERE username = $1', [req.user.username]);
      const linkedWallet = accountResult.rows[0];
      if (!linkedWallet?.wallet_address || linkedWallet.wallet_status !== 'active') return res.status(403).json({ error: 'An active linked manufacturer wallet is required' });
      const productResult = await pool.query(
        'SELECT chain_status, chain_tx_hash, chain_attempt, chain_sender FROM product WHERE serialnumber = $1 AND manufacturer_username = $2',
        [req.params.serialNumber, req.user.username],
      );
      if (!productResult.rows.length) return res.status(404).json({ error: 'Product not found' });
      const product = productResult.rows[0];
      if (!product.chain_sender || product.chain_sender.toLowerCase() !== linkedWallet.wallet_address.toLowerCase()) {
        return res.status(403).json({ error: 'The linked wallet changed after this product registration was prepared; retry through the recovery flow' });
      }
      if (product.chain_status === 'submitted' && product.chain_tx_hash?.toLowerCase() === txHash.toLowerCase()) {
        return res.json({ success: 1, status: 'submitted', txHash, idempotent: true });
      }
      if (product.chain_status !== 'pending_wallet') return res.status(409).json({ error: `Transaction cannot be attached while product is ${product.chain_status}` });
      const result = await pool.query(
        `WITH changed AS (
           UPDATE product SET chain_status = 'submitted', chain_tx_hash = $1, chain_expected_id = $2,
             chain_sender = $3, chain_contract_address = $4, chain_submitted_at = now(),
             chain_updated_at = now(), failure_reason = NULL
           WHERE serialnumber = $5 AND manufacturer_username = $6 AND chain_status = 'pending_wallet'
             AND chain_attempt = $7
           RETURNING serialnumber, chain_attempt
         )
         UPDATE product_chain_attempts AS attempt SET status = 'submitted', transaction_hash = $1,
           expected_chain_id = $2, sender_address = $3, contract_address = $4, submitted_at = now()
         FROM changed WHERE attempt.serial_number = changed.serialnumber AND attempt.attempt_number = changed.chain_attempt
         RETURNING attempt.serial_number`,
        [txHash, configuredChainId, normalizedAddress(linkedWallet.wallet_address), address, req.params.serialNumber, req.user.username, product.chain_attempt || 1],
      );
      if (result.rowCount === 0) return res.status(409).json({ error: 'Product changed while recording transaction; refresh its status' });
      return res.status(202).json({ success: 1, status: 'submitted', txHash });
    } catch (err) { return next(err); }
  });

  app.post('/product/:serialNumber/retry', authenticate, authorize('manufacturer'), writeRateLimit, async (req, res, next) => {
    try {
      const account = await pool.query('SELECT wallet_address, wallet_status FROM auth WHERE username = $1', [req.user.username]);
      if (!account.rows[0]?.wallet_address || account.rows[0].wallet_status !== 'active') return res.status(403).json({ error: 'An active linked manufacturer wallet is required' });
      const address = normalizedAddress(contractAddress);
      if (!address) return res.status(503).json({ error: 'Contract address is not configured' });
      const result = await pool.query(
        `WITH retried AS (
           UPDATE product SET chain_status = 'pending_wallet', chain_attempt = chain_attempt + 1,
             chain_tx_hash = NULL, chain_id = NULL, chain_expected_id = $5, chain_event_scan_block = NULL,
             chain_sender = $3, chain_contract_address = $4,
             chain_submitted_at = NULL, chain_updated_at = now(), failure_reason = NULL
           WHERE serialnumber = $1 AND manufacturer_username = $2 AND chain_status IN ('failed', 'needs_retry')
           RETURNING serialnumber, chain_attempt, chain_sender, chain_contract_address, chain_expected_id
         )
         INSERT INTO product_chain_attempts (serial_number, attempt_number, status, expected_chain_id, contract_address, sender_address, created_at)
         SELECT serialnumber, chain_attempt, 'pending_wallet', chain_expected_id, chain_contract_address, chain_sender, now() FROM retried
         RETURNING serial_number, attempt_number`,
        [req.params.serialNumber, req.user.username, normalizedAddress(account.rows[0].wallet_address), address, configuredChainId],
      );
      if (!result.rowCount) return res.status(409).json({ error: 'Only failed or retryable registrations can be retried' });
      return res.status(202).json({ status: 'pending_wallet', attempt: result.rows[0].attempt_number });
    } catch (err) { return next(err); }
  });

  app.get('/product/:serialNumber/chain-status', authenticate, authorize('manufacturer', 'admin'), async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT serialnumber, name, brand, chain_description, chain_image, chain_actor, chain_location, chain_timestamp,
                chain_status, chain_tx_hash, chain_id, chain_expected_id, chain_attempt, failure_reason, chain_submitted_at, chain_updated_at, chain_reconciled_at
           FROM product WHERE serialnumber = $1 AND ($2 = 'admin' OR manufacturer_username = $3)`,
        [req.params.serialNumber, req.user.role, req.user.username],
      );
      if (!rows.length) return res.status(404).json({ error: 'Product not found' });
      return res.json(rows[0]);
    } catch (err) { return next(err); }
  });

  app.get('/product/:serialNumber/chain-attempts', authenticate, authorize('manufacturer', 'admin'), async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT attempt.attempt_number, attempt.status, attempt.transaction_hash, attempt.chain_id, attempt.expected_chain_id,
                attempt.contract_address, attempt.sender_address, attempt.failure_reason,
                attempt.recovered_from_chain, attempt.created_at, attempt.submitted_at, attempt.finalized_at
           FROM product_chain_attempts AS attempt
           JOIN product AS p ON p.serialnumber = attempt.serial_number
          WHERE p.serialnumber = $1 AND ($2 = 'admin' OR p.manufacturer_username = $3)
          ORDER BY attempt.attempt_number ASC`,
        [req.params.serialNumber, req.user.role, req.user.username],
      );
      if (!rows.length) {
        const exists = await pool.query('SELECT 1 FROM product WHERE serialnumber = $1 AND ($2 = \'admin\' OR manufacturer_username = $3)', [req.params.serialNumber, req.user.role, req.user.username]);
        if (!exists.rowCount) return res.status(404).json({ error: 'Product not found' });
      }
      return res.json(rows);
    } catch (err) { return next(err); }
  });

  app.get('/product/chain-status', authenticate, authorize('admin', 'manufacturer'), async (req, res, next) => {
    try {
      const requestedStatus = req.query.status;
      const allowedStatuses = ['pending_wallet', 'submitted', 'confirmed', 'failed', 'needs_retry'];
      if (requestedStatus && !allowedStatuses.includes(requestedStatus)) {
        return res.status(400).json({ error: 'Invalid chain status' });
      }
      const params = requestedStatus ? [requestedStatus, req.user.role, req.user.username] : [req.user.role, req.user.username];
      const fields = 'serialnumber, name, brand, chain_description, chain_image, chain_actor, chain_location, chain_timestamp, chain_status, chain_tx_hash, chain_id, chain_expected_id, chain_attempt, chain_sender, chain_contract_address, failure_reason, chain_submitted_at, chain_updated_at, chain_reconciled_at, created_at';
      const query = requestedStatus
        ? `SELECT ${fields} FROM product WHERE chain_status = $1 AND ($2 = 'admin' OR manufacturer_username = $3) ORDER BY created_at DESC`
        : `SELECT ${fields} FROM product WHERE ($1 = 'admin' OR manufacturer_username = $2) ORDER BY created_at DESC`;
      const { rows } = await pool.query(query, params);
      return res.json(rows);
    } catch (err) { return next(err); }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds the 5 MB upload limit' : 'Image upload request is invalid';
      return res.status(400).json({ success: 0, error: message });
    }
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({ success: 0, error: 'Origin not allowed' });
    }
    if (err.code === 'UNSUPPORTED_IMAGE_TYPE') {
      return res.status(415).json({ success: 0, error: 'Only JPEG, PNG, GIF, or WebP images are allowed' });
    }
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
    if (status >= 500) {
      const requestId = crypto.randomUUID();
      const code = typeof err.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(err.code) ? err.code : undefined;
      if (typeof logger?.error === 'function') {
        logger.error(JSON.stringify({ event: 'http_request_failed', requestId, method: req.method, path: req.path, status, ...(code ? { code } : {}) }));
      }
      const message = status === 503 ? 'Service temporarily unavailable' : 'An unexpected server error occurred';
      return res.status(status).json({ success: 0, error: message, requestId });
    }
    if (status === 413) return res.status(status).json({ success: 0, error: 'Request payload is too large' });
    return res.status(status).json({ success: 0, error: 'Invalid request' });
  });

  return app;
}

module.exports = { createApp, ROLES, MAX_UPLOAD_BYTES, PRODUCT_SCAN_ABI, hasConflictingProductState };
