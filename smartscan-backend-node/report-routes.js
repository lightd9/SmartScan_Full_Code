const { createHash }=require('crypto');
function mountReports(app,{pool,authenticate,scanRateLimit,writeRateLimit}) {
  app.post('/v1/reports',scanRateLimit,async(req,res,next)=>{
    try {
      const {requestId,serialNumber,reason,details=''}=req.body || {};
      if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(requestId || '') || !/^SS-[\da-f-]{36}$/i.test(serialNumber || '')
        || !['Suspected counterfeit','Broken or tampered seal','Duplicate serial number','Unauthorized retailer','Other concern'].includes(reason)
        || typeof details!=='string' || details.length>2000) return res.status(400).json({error:'Provide a product, report reason and valid request ID.'});
      const digest=createHash('sha256').update(JSON.stringify([serialNumber,reason,details])).digest('hex');
      const inserted=await pool.query(`INSERT INTO consumer_reports(id,serial_number,reason,details,request_digest) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id,submitted_at`,[requestId,serialNumber,reason,details,digest]);
      const row=inserted.rows[0] || (await pool.query('SELECT id,submitted_at,request_digest FROM consumer_reports WHERE id=$1',[requestId])).rows[0];
      if(!inserted.rowCount && row.request_digest!==digest) return res.status(409).json({error:'This request ID was already used for different report details.'});
      res.status(inserted.rowCount ? 201 : 200).json({caseId:row.id,submittedAt:row.submitted_at,status:'submitted'});
    } catch(e){next(e);}
  });
  app.get('/api/enterprise/reports',authenticate,async(req,res,next)=>{
    if(req.user.role!=='admin') return res.status(403).json({error:'Administrator access required.'});
    try {res.json((await pool.query('SELECT id,serial_number AS "productId",reason,details,status,version,submitted_at AS "submittedAt" FROM consumer_reports ORDER BY submitted_at DESC LIMIT 100')).rows);}catch(e){next(e);}
  });
  app.post('/api/enterprise/reports/:id/review',authenticate,writeRateLimit,async(req,res,next)=>{
    if(req.user.role!=='admin') return res.status(403).json({error:'Administrator access required.'});
    const {status,note,expectedVersion}=req.body || {};
    if(!/^[\da-f-]{36}$/i.test(req.params.id) || !['investigating','resolved','dismissed'].includes(status) || typeof note!=='string' || !note.trim() || note.length>2000 || !Number.isInteger(expectedVersion)) return res.status(400).json({error:'Provide a review outcome, note and current version.'});
    try {
      const result=await pool.query(`WITH changed AS (UPDATE consumer_reports SET status=$2,version=version+1,updated_at=now() WHERE id=$1 AND version=$3 RETURNING id)
        INSERT INTO consumer_report_reviews(report_id,reviewer,status,note) SELECT id,$4,$2,$5 FROM changed RETURNING report_id`,[req.params.id,status,expectedVersion,req.user.username,note.trim()]);
      if(!result.rowCount) return res.status(409).json({error:'This report changed. Refresh before reviewing.'});
      res.json({caseId:req.params.id,status,version:expectedVersion+1});
    }catch(e){next(e);}
  });
}
module.exports={mountReports};
