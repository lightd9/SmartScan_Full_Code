const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const COOKIE = 'smartscan_session';
const TTL = 30 * 24 * 60 * 60 * 1000;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function createSessions({ pool, jwtSecret, jwtExpiresIn, allowedOrigins }) {
  function credential(req) {
    if (typeof req.body?.refreshToken === 'string') return req.body.refreshToken;
    // Cookie renewal requires an explicit allowed origin and custom header.
    // Cross-site HTML forms must never renew or end another browser's session.
    if (!allowedOrigins.includes(req.headers.origin) || req.headers['x-smartscan-session'] !== '1') return null;
    return (req.headers.cookie || '').split(';').map(p => p.trim()).find(p => p.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  }
  function cookie(res, value, maxAge = TTL) {
    res.cookie(COOKIE, value, { httpOnly: true, secure: true, sameSite: 'none', path: '/auth', maxAge });
  }
  async function issue(account, req, res) {
    if (!['native', 'browser'].includes(req.body?.sessionMode)) return {};
    const token = crypto.randomBytes(32).toString('base64url');
    const sessionId = crypto.randomUUID();
    await pool.query(`INSERT INTO app_sessions(id,username,token_hash,token_version,expires_at)
      VALUES($1,$2,$3,$4,$5)`, [sessionId, account.username, digest(token), Number(account.token_version || 0), new Date(Date.now() + TTL)]);
    if (req.body.sessionMode === 'browser') { cookie(res, token); return { sessionId }; }
    return { refreshToken: token, sessionId };
  }
  function mount(app, limiter) {
    app.post('/auth/refresh', limiter, async (req, res, next) => {
      try {
        const token = credential(req);
        if (!token || !/^[\w-]{43}$/.test(token)) return res.status(401).json({ error: 'Please sign in again.' });
        const { rows } = await pool.query(`UPDATE app_sessions s SET last_used_at=now() FROM auth a
          WHERE s.token_hash=$1 AND s.username=a.username AND s.token_version=COALESCE(a.token_version,0)
          AND s.revoked_at IS NULL AND s.expires_at>now()
          RETURNING a.username,a.role,a.token_version,s.id`, [digest(token)]);
        const account = rows[0];
        if (!account) { cookie(res, '', 0); return res.status(401).json({ error: 'Please sign in again.' }); }
        res.json({ token: jwt.sign({ username: account.username, role: account.role, tokenVersion: Number(account.token_version || 0), sessionId: account.id }, jwtSecret, { expiresIn: jwtExpiresIn }),
          user: { username: account.username, role: account.role } });
      } catch (error) { next(error); }
    });
    app.post('/auth/logout', limiter, async (req, res, next) => {
      try {
        const token = credential(req);
        if (token && /^[\w-]{43}$/.test(token)) await pool.query('UPDATE app_sessions SET revoked_at=now() WHERE token_hash=$1', [digest(token)]);
        cookie(res, '', 0); res.json({ signedOut: true });
      } catch (error) { next(error); }
    });
  }
  return { issue, mount };
}
module.exports = { createSessions, digest };
