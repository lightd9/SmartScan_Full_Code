const { fail } = require('./enterprise');
function mountHandovers(app, { pool, authenticate, writeRateLimit, service }) {
  app.get('/api/enterprise/handovers', authenticate, async (req,res,next) => {
    try {
      await service.account(req.user);
      const { rows } = await pool.query(`SELECT h.id,h.serial_number AS "productId",h.expected_version AS "expectedVersion",
        h.sender_id::text AS "senderId",h.receiver_id::text AS "receiverId",h.status,h.requested_at AS "requestedAt",
        h.approved_at AS "approvedAt",h.expires_at AS "expiresAt",h.dispatch_recorded AS "dispatchRecorded",
        h.operation_id AS "operationId",s.subaccount_name AS "senderName",r.subaccount_name AS "receiverName",
        s.parent_username=$1 AS "canApprove"
        FROM handover_requests h JOIN facility_subaccounts s ON s.id=h.sender_id JOIN facility_subaccounts r ON r.id=h.receiver_id
        WHERE s.parent_username=$1 OR r.parent_username=$1 OR $2='admin' ORDER BY h.requested_at DESC LIMIT 100`, [req.user.username,req.user.role]);
      res.json(rows);
    } catch(error) { next(error); }
  });
  app.post('/api/enterprise/handovers/:id/decision', authenticate, writeRateLimit, async (req,res,next) => {
    const db = await pool.connect();
    try {
      if (!/^[\da-f-]{36}$/i.test(req.params.id) || !['approve','reject','cancel'].includes(req.body?.decision)) fail('Choose approve, reject or cancel.');
      await service.account(req.user,db);
      await db.query('BEGIN');
      let h = (await db.query('SELECT * FROM handover_requests WHERE id=$1', [req.params.id])).rows[0];
      if (!h) fail('Receipt request not found.',404);
      await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`handover:${h.serial_number}`]);
      h = (await db.query('SELECT * FROM handover_requests WHERE id=$1 FOR UPDATE', [h.id])).rows[0];
      const decision = req.body.decision;
      await service.facility(req.user, String(h.sender_id), db);
      const desired = { approve:'approved',reject:'rejected',cancel:'cancelled' }[decision];
      if (h.status === desired || (decision === 'approve' && ['submitted','received'].includes(h.status))) {
        await db.query('COMMIT'); return res.json({ id:h.id,status:h.status });
      }
      if (h.permit || h.signature || ['submitted','received'].includes(h.status)) fail('This authorization has been signed. It cannot be cancelled by changing a database record; use on-chain invalidation or wait for its expiry and reconcile the receipt.',409);
      if (!['requested','approved'].includes(h.status)) fail('This request has already been closed.',409);
      if (decision === 'approve') {
        if(process.env.RECEIPT_WRITES_ENABLED==='false') fail('Receipt-protocol approvals are temporarily paused.',503);
        const chain = await service.productChain(h.serial_number,true,db);
        const sender = await service.facility(req.user,String(h.sender_id),db);
        const receiver = (await db.query("SELECT 1 FROM facility_subaccounts WHERE id=$1 AND status='active'",[h.receiver_id])).rows[0];
        if (!receiver || chain.protocol !== 'receipt-v3' || chain.history.length !== h.expected_version || ![1,3].includes(chain.stage) || chain.custodian.toLowerCase() !== sender.wallet_address.toLowerCase()) fail('Custody or receiver eligibility changed. Refresh the product.',409);
        await db.query("UPDATE handover_requests SET status='approved',approved_at=now(),approved_by=$2,approval_token_version=$3,expires_at=now()+interval '24 hours' WHERE id=$1", [h.id,req.user.username,Number(req.user.tokenVersion || 0)]);
        await db.query("UPDATE enterprise_operation_items SET status='queued',message='Sender approved. Preparing the receipt transaction.' WHERE operation_id=$1 AND serial_number=$2 AND status='waiting_approval'", [h.operation_id,h.serial_number]);
      } else {
        await db.query('UPDATE handover_requests SET status=$2 WHERE id=$1',[h.id,desired]);
        await db.query("UPDATE enterprise_operation_items SET status='failed',message=$3 WHERE operation_id=$1 AND serial_number=$2 AND signed_transaction IS NULL",[h.operation_id,h.serial_number,decision === 'reject' ? 'Sender declined the receipt request.' : 'Sender cancelled the authorization before signing.']);
      }
      await db.query('COMMIT'); res.json({ id:h.id,status:desired }); void service.tick();
    } catch(error) {
      await db.query('ROLLBACK');
      if (error.code === '23505') return res.status(409).json({ error:'Another handover for this product is already approved or processing.' });
      if (error.status) return res.status(error.status).json({ error:error.message }); next(error);
    } finally { db.release(); }
  });
}
module.exports = { mountHandovers };
