const { ethers } = require('ethers');
const { createEnterprise, SERIAL, ROLES, limited, fail } = require('./enterprise');

function mountEnterprise(app, options) {
  const { pool, authenticate, writeRateLimit, provider, contractAddress, chainId } = options;
  const service = createEnterprise(options);
  const route = handler => async (req, res, next) => {
    try { await service.account(req.user); await handler(req, res); }
    catch (error) {
      if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message });
      next(error);
    }
  };
  app.locals.enterprise = service;
  app.get('/api/enterprise/operations', authenticate, route(async (req, res) => {
    res.json(await service.operations(req.user));
  }));
  app.post('/api/enterprise/operations', authenticate, writeRateLimit, route(async (req, res) => {
    const operation = await service.submit(req.user, req.body);
    res.status(202).json(operation);
    void service.tick();
  }));
  app.post('/api/enterprise/products', authenticate, writeRateLimit, route(async (req, res) => {
    if (req.user.role !== 'manufacturer') fail('Only manufacturers can create products.', 403);
    const { id, name, brand, description = '', image = '', kind, facilityId } = req.body || {};
    if (!SERIAL.test(id || '') || !limited(name, 100, true) || !limited(brand, 100, true)
        || !limited(description, 1000) || !limited(image, 200) || (image && !/^[\w.-]+$/.test(image))
        || !['bottle', 'carton'].includes(kind)) fail('Provide a valid serial, product name, brand and packaging type.');
    const f = await service.facility(req.user, facilityId);
    if (!contractAddress) fail('Blockchain configuration is unavailable.', 503);
    const created = await pool.query(`WITH created_product AS (
      INSERT INTO product(serialnumber,name,brand,manufacturer_username,packaging_kind,chain_status,chain_attempt,
        chain_sender,chain_contract_address,chain_expected_id,chain_description,chain_image)
      VALUES($1,$2,$3,$4,$5,'pending_wallet',1,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING
      RETURNING serialnumber,chain_sender,chain_contract_address,chain_expected_id)
      INSERT INTO product_chain_attempts(serial_number,attempt_number,status,sender_address,contract_address,expected_chain_id)
      SELECT serialnumber,1,'pending_wallet',chain_sender,chain_contract_address,chain_expected_id FROM created_product RETURNING serial_number`,
    [id, name.trim(), brand.trim(), req.user.username, kind, f.wallet_address, contractAddress, String(chainId), description, image]);
    if (!created.rowCount) {
      const existing = (await pool.query(`SELECT manufacturer_username,name,brand,packaging_kind,chain_sender,chain_description,chain_image FROM product WHERE serialnumber=$1`, [id])).rows[0];
      if (!existing || existing.manufacturer_username !== req.user.username || existing.chain_sender?.toLowerCase() !== f.wallet_address.toLowerCase()
          || existing.name !== name.trim() || existing.brand !== brand.trim() || existing.packaging_kind !== kind
          || (existing.chain_description || '') !== description || (existing.chain_image || '') !== image) fail('This serial already belongs to a different product record.', 409);
    }
    res.status(created.rowCount ? 201 : 200).json({ id });
  }));
  app.get('/api/enterprise/snapshot', authenticate, route(async (req, res) => {
    const user = req.user;
    const admin = user.role === 'admin';
    const accounts = await pool.query(`SELECT a.username,a.role,COALESCE(p.name,a.username) AS name
      FROM auth a LEFT JOIN profile p ON p.username=a.username ${admin ? '' : 'WHERE a.username=$1'}`, admin ? [] : [user.username]);
    // Public facility directory supports recipient selection and custody names.
    // Balances are enriched only for this account (or the administrator).
    const rows = await pool.query(`SELECT s.id,s.parent_username,s.subaccount_name,s.facility_code,s.role,s.wallet_address,s.status,
      COALESCE(NULLIF(s.location,''),p.location,'') AS location FROM facility_subaccounts s
      LEFT JOIN profile p ON p.username=s.parent_username
      WHERE s.status='active' OR s.parent_username=$1 OR $2=true`, [user.username, admin]);
    const facilities = [];
    for (const row of rows.rows) {
      let balanceEth = null, chainRole = null;
      if (provider && (admin || row.parent_username === user.username)) {
        const values = await Promise.allSettled([provider.getBalance(row.wallet_address),
          new ethers.Contract(contractAddress, ['function roles(address) view returns(uint8)'], provider).roles(row.wallet_address)]);
        if (values[0].status === 'fulfilled') balanceEth = ethers.formatEther(values[0].value);
        if (values[1].status === 'fulfilled') chainRole = ROLES[Number(values[1].value)] || 'unapproved';
      }
      facilities.push({ id: String(row.id), accountId: row.parent_username, name: row.subaccount_name, code: row.facility_code,
        role: row.role, wallet: row.wallet_address, status: row.status === 'pending_approval' ? 'pending' : row.status,
        location: row.location, balanceEth, chainRole });
    }
    if (admin) {
      let wallet = '', balanceEth = null;
      try {
        wallet = await new ethers.Contract(contractAddress, ['function owner() view returns(address)'], provider).owner();
        balanceEth = ethers.formatEther(await provider.getBalance(wallet));
      } catch { /* Report unavailable rather than a fabricated zero balance. */ }
      facilities.unshift({ id: `admin:${user.username}`, accountId: user.username, name: 'Network administration',
        code: 'ADMIN', role: 'admin', wallet, status: 'active', location: '', balanceEth, chainRole: null });
    }
    const walletId = address => !address || address === ethers.ZeroAddress ? null
      : facilities.find(f => f.wallet.toLowerCase() === address.toLowerCase())?.id || address;
    const registry = await pool.query(`SELECT serialnumber,name,brand,manufacturer_username,packaging_kind,chain_description,chain_image,
      chain_sender,chain_status FROM product WHERE $1 <> 'manufacturer' OR manufacturer_username=$2 ORDER BY created_at DESC`, [user.role, user.username]);
    await service.network();
    const operations = await service.operations(user);
    const products = [];
    const warnings = [];
    // Bounded concurrency avoids flooding the RPC when an inventory is refreshed.
    for (let offset = 0; offset < registry.rows.length; offset += 4) {
      const slice = await Promise.all(registry.rows.slice(offset, offset + 4).map(async row => {
        let chain;
        try { chain = await service.productChain(row.serialnumber); }
        catch { warnings.push('Some custody records could not be checked. Actions on those items are unavailable.'); }
        const pending = operations.some(o => o.items.some(i => i.productId === row.serialnumber && i.status === 'submitted'));
        const history = (chain?.history || []).map(event => {
          const action = ['register','dispatch','receive','sell','recall'][event.action];
          const recorded = operations.find(o => o.action === action && o.facilityId === walletId(event.actorWallet)
            && o.items.some(i => i.productId === row.serialnumber && i.status === 'confirmed' && i.expectedVersion + 1 === event.id));
          return { id: String(event.id), action, actorName: event.actor,
          actorId: walletId(event.actorWallet), recipientId: walletId(event.recipientWallet),
          at: /^\d+$/.test(event.timestamp) ? new Date(Number(event.timestamp) * 1000).toISOString() : event.timestamp,
          location: recorded?.location, note: recorded ? undefined : event.location };
        });
        const lastDispatch = [...(chain?.history || [])].reverse().find(h => h.action === 1);
        const manufacturerId = walletId(chain?.history?.[0]?.actorWallet || row.chain_sender) || '';
        return { id: row.serialnumber, name: chain?.name || row.name, brand: chain?.brand || row.brand,
          description: chain?.description || row.chain_description || '', image: chain?.imageHash || row.chain_image || '',
          kind: row.packaging_kind, registration: pending && !chain?.exists ? 'submitted' : chain?.exists ? 'confirmed'
            : ['failed','needs_retry'].includes(row.chain_status) ? 'needs_retry' : row.chain_status === 'confirmed' ? 'submitted' : row.chain_status,
          stage: chain?.stage || 0, manufacturerId, custodianId: walletId(chain?.custodian) || manufacturerId,
          recipientId: walletId(chain?.pendingRecipient), senderRole: ROLES[lastDispatch?.actorRole],
          version: history.length, history, chainAvailable: Boolean(chain), chainId: String(chainId), contractAddress };
      }));
      products.push(...slice);
    }
    let alerts = [], audit = [];
    if (admin) {
      const flagged = await pool.query(`SELECT id,serial_number,flags,scanned_at FROM product_scans
        WHERE cardinality(flags)>0 AND lower(contract_address)=lower($1) ORDER BY scanned_at DESC LIMIT 100`, [contractAddress]);
      alerts = flagged.rows.map(row => ({ id: String(row.id), productId: row.serial_number, title: 'Scan needs review',
        detail: row.flags.map(flag => flag.replaceAll('_', ' ')).join(' · '), at: row.scanned_at }));
      const events = await pool.query('SELECT id,username,event_type,created_at FROM wallet_account_events ORDER BY created_at DESC LIMIT 100');
      audit = events.rows.map(row => ({ id: String(row.id), title: row.event_type.replaceAll('_', ' '), detail: row.username, at: row.created_at }));
    }
    res.json({ version: 1, scenario: 'normal', accounts: accounts.rows.map(a => ({ id: a.username, username: a.username, name: a.name, role: a.role })),
      facilities, products, operations, drafts: [], audit, alerts, warnings: [...new Set(warnings)],
      network: { chainId: String(chainId), contractAddress, name: String(chainId) === '11155111' ? 'Sepolia test network' : `Chain ${chainId}` } });
  }));
  return service;
}
module.exports = { mountEnterprise };
