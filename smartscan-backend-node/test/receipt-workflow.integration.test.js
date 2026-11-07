const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {randomUUID}=require('crypto'),{Pool}=require('pg'),{ethers}=require('ethers'),express=require('express'),request=require('supertest');
const {createEnterprise}=require('../enterprise'),{createAuthority}=require('../authority'),{mountHandovers}=require('../handover-routes'),{createSessions}=require('../sessions'),{mountReports}=require('../report-routes');
const url=process.env.SMARTSCAN_TEST_DATABASE_URL,rpc=process.env.SMARTSCAN_TEST_RECEIPT_RPC;
test('receipt workflow, resumable sessions and report acknowledgements with an isolated database', {skip:!url || !rpc,timeout:120000},async t=>{
  assert.equal(new URL(url).hostname,'127.0.0.1');assert.equal(new URL(rpc).hostname,'127.0.0.1');
  const scenario=async(label,run)=>{await run();t.diagnostic(label);};
  const schema='receipt_test_'+randomUUID().replaceAll('-','');const admin=new Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${schema}`);
  const pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:10,query_timeout:5000,connectionTimeoutMillis:5000});const provider=new ethers.JsonRpcProvider(rpc,undefined,{cacheTimeout:-1});
  const phrase='test test test test test test test test test test test junk';
  const wallets=Array.from({length:5},(_,i)=>ethers.HDNodeWallet.fromPhrase(phrase,undefined,`m/44'/60'/0'/0/${i}`).connect(provider));
  const [owner,maker,supplier,retailer,other]=wallets;
  const artifact=JSON.parse(fs.readFileSync(path.join(__dirname,'../../smartscan-smartcontract-solidty/artifacts/contracts/IdenteefiV3.sol/IdenteefiV3.json')));
  let service;
  try{
    const contract=await new ethers.ContractFactory(artifact.abi,artifact.bytecode,owner).deploy();await contract.waitForDeployment();
    for(const [w,r,n] of [[maker,2,'Maker'],[supplier,3,'Supplier'],[retailer,4,'Retailer'],[other,3,'Other supplier']])await (await contract.grantRole(w.address,r,n)).wait();
    const address=await contract.getAddress(),chainId=String((await provider.getNetwork()).chainId);
    await pool.query(`CREATE TABLE auth(username text PRIMARY KEY,role text,token_version integer DEFAULT 0);
      CREATE TABLE profile(username text PRIMARY KEY,name text,location text);
      CREATE TABLE product(serialnumber text PRIMARY KEY,name text,brand text,manufacturer_username text,chain_sender text,chain_contract_address text,chain_expected_id text,
        chain_status text DEFAULT 'pending_wallet',chain_tx_hash text,chain_id text,chain_updated_at timestamptz,failure_reason text,chain_attempt integer DEFAULT 1,chain_description text,chain_image text);
      CREATE TABLE product_chain_attempts(serial_number text,attempt_number integer,status text,transaction_hash text,failure_reason text,finalized_at timestamptz);
      CREATE TABLE facility_subaccounts(id bigint PRIMARY KEY,parent_username text,role text,status text,subaccount_name text,wallet_address text,
        encrypted_private_key text,key_iv text,key_auth_tag text,key_version integer);
      INSERT INTO auth(username,role) VALUES('maker','manufacturer'),('supplier','supplier'),('retailer','retailer'),('other','supplier'),('admin','admin');`);
    for(const name of ['015_enterprise_operations.sql','016_resumable_sessions.sql','017_receipt_protocol.sql','018_consumer_reports.sql'])await pool.query(fs.readFileSync(path.join(__dirname,'../migrations',name),'utf8'));
    for(const [id,username,role,w] of [[1,'maker','manufacturer',maker],[2,'supplier','supplier',supplier],[3,'retailer','retailer',retailer],[4,'other','supplier',other]])await pool.query("INSERT INTO facility_subaccounts(id,parent_username,role,status,subaccount_name,wallet_address)VALUES($1,$2,$3,'active',$2,$4)",[id,username,role,w.address]);
    const authority=createAuthority({pool,provider,contractAddress:ethers.ZeroAddress,receiptAddress:address,chainId,pilotAccounts:'maker'});
    let signs=0,broadcasts=0;const originalBroadcast=provider.broadcastTransaction.bind(provider);provider.broadcastTransaction=async raw=>{broadcasts++;return originalBroadcast(raw);};
    service=createEnterprise({pool,provider,contractAddress:ethers.ZeroAddress,chainId,authority,readProduct:authority.read,signerFactory:({walletAddress})=>{
      const wallet=wallets.find(w=>w.address.toLowerCase()===walletAddress.toLowerCase());
      return {address:wallet.address,provider,call:tx=>wallet.call(tx),populateTransaction:tx=>wallet.populateTransaction(tx),signTypedData:(...args)=>wallet.signTypedData(...args),signTransaction:tx=>{signs++;return wallet.signTransaction(tx);}};
    }});
    const app=express();app.use(express.json());const pass=(_req,_res,next)=>next();const authenticate=(req,res,next)=>{req.user={username:req.headers['x-user'] || 'maker',role:req.headers['x-role'] || 'manufacturer',tokenVersion:0};next();};
    mountHandovers(app,{pool,authenticate,writeRateLimit:pass,service});
    const sessions=createSessions({pool,jwtSecret:'test-secret-only',jwtExpiresIn:'15m',allowedOrigins:['https://localhost']});sessions.mount(app,pass);
    app.post('/login',async(req,res,next)=>{try{res.json(await sessions.issue({username:'maker',token_version:0},req,res));}catch(e){next(e);}});
    mountReports(app,{pool,authenticate,scanRateLimit:pass,writeRateLimit:pass});
    const users={maker:{username:'maker',role:'manufacturer',tokenVersion:0},supplier:{username:'supplier',role:'supplier',tokenVersion:0},other:{username:'other',role:'supplier',tokenVersion:0},retailer:{username:'retailer',role:'retailer',tokenVersion:0}};
    const location={source:'unavailable',address:'Location unavailable',capturedAt:new Date().toISOString()};
    async function product(){const serial='SS-'+randomUUID();await pool.query("INSERT INTO product(serialnumber,name,brand,manufacturer_username,chain_sender,chain_protocol,chain_contract_address,chain_expected_id)VALUES($1,'Example','Maker','maker',$2,'receipt-v3',$3,$4)",[serial,maker.address,address,chainId]);await (await contract.connect(maker).registerProduct('Example','Maker',serial,'','','','','')).wait();await provider.send('evm_mine',[]);return serial;}
    const body=(serial,action,facilityId,version=1)=>({requestKey:randomUUID(),action,facilityId,items:[{productId:serial,expectedVersion:version}],location});
    await scenario('off-chain dispatch uses no wallet signature or transaction even with zero gas',async()=>{
      const serial=await product();const gas=await provider.getBalance(maker.address);await provider.send('hardhat_setBalance',[maker.address,'0x0']);
      const b=body(serial,'dispatch','1'),before=broadcasts;const o=await service.submit(users.maker,b);assert.equal(o.items[0].status,'confirmed');assert.equal(o.items[0].proofKind,'offchain');assert.equal(o.items[0].txHash,null);assert.equal(signs,0);assert.equal(broadcasts,before);
      assert.equal((await service.submit(users.maker,b)).id,o.id);assert.equal((await contract.getProduct(serial))[7],maker.address);await provider.send('hardhat_setBalance',[maker.address,ethers.toQuantity(gas)]);
    });
    await scenario('missing dispatch requires approval, rejects unrelated sender and transfers exactly once',async()=>{
      const serial=await product();const o=await service.submit(users.supplier,body(serial,'receive','2'));assert.equal(o.items[0].status,'waiting_approval');await service.tick();assert.equal(signs,0);
      const h=(await pool.query('SELECT * FROM handover_requests WHERE operation_id=$1',[o.id])).rows[0];assert.equal(h.dispatch_recorded,false);
      assert.equal((await request(app).post(`/api/enterprise/handovers/${h.id}/decision`).set('x-user','other').set('x-role','supplier').send({decision:'approve'})).status,403);
      const concurrent=await service.submit(users.other,body(serial,'receive','4'));const second=(await pool.query('SELECT id FROM handover_requests WHERE operation_id=$1',[concurrent.id])).rows[0];
      assert.equal((await request(app).post(`/api/enterprise/handovers/${h.id}/decision`).send({decision:'approve'})).status,200);
      assert.equal((await request(app).post(`/api/enterprise/handovers/${second.id}/decision`).send({decision:'approve'})).status,409);
      for(let i=0;i<40;i++){await service.tick();await provider.send('evm_mine',[]);await new Promise(r=>setTimeout(r,200));if((await service.operations(users.supplier)).find(x=>x.id===o.id).items[0].status==='confirmed')break;}
      const updated=(await service.operations(users.supplier)).find(x=>x.id===o.id);assert.equal(updated.items[0].status,'confirmed');assert.equal(signs,1);assert.equal((await contract.getProduct(serial))[7],supplier.address);
      const again=await request(app).post(`/api/enterprise/handovers/${h.id}/decision`).send({decision:'approve'});assert.equal(again.status,200);assert.equal(signs,1);
      const listed=await request(app).get('/api/enterprise/handovers');assert.equal(JSON.stringify(listed.body).includes('signature'),false);assert.equal(JSON.stringify(listed.body).includes('permit'),false);
    });
    await scenario('product authority is immutable and unsupported old clients cannot create new protocol records',async()=>{
      const serial=await product();await assert.rejects(pool.query("UPDATE product SET chain_protocol='v2' WHERE serialnumber=$1",[serial]),/immutable/);
      assert.throws(()=>authority.forNew('maker',1),e=>e.status===426);assert.equal(authority.forNew('maker',3).protocol,'receipt-v3');
    });
    await scenario('refresh secrets are hashed; logout, expiry and account revocation prevent restoration',async()=>{
      const login=await request(app).post('/login').send({sessionMode:'native'});const secret=login.body.refreshToken;assert.ok(secret);const stored=(await pool.query('SELECT token_hash FROM app_sessions WHERE id=$1',[login.body.sessionId])).rows[0];assert.notEqual(stored.token_hash,secret);
      const renewed=await request(app).post('/auth/refresh').send({refreshToken:secret});assert.equal(renewed.status,200);assert.equal(renewed.body.user.username,'maker');
      await request(app).post('/auth/logout').send({refreshToken:secret});assert.equal((await request(app).post('/auth/refresh').send({refreshToken:secret})).status,401);
      const two=(await request(app).post('/login').send({sessionMode:'native'})).body;await pool.query("UPDATE auth SET token_version=1 WHERE username='maker'");assert.equal((await request(app).post('/auth/refresh').send({refreshToken:two.refreshToken})).status,401);
      await pool.query("UPDATE auth SET token_version=0 WHERE username='maker'");await pool.query('UPDATE app_sessions SET expires_at=now()-interval \'1 second\' WHERE id=$1',[two.sessionId]);assert.equal((await request(app).post('/auth/refresh').send({refreshToken:two.refreshToken})).status,401);
    });
    await scenario('browser renewal requires the allowed origin and anti-CSRF header',async()=>{
      const login=await request(app).post('/login').send({sessionMode:'browser'});assert.equal(login.body.refreshToken,undefined);const cookie=login.headers['set-cookie'][0].split(';')[0];assert.match(login.headers['set-cookie'][0],/HttpOnly/);assert.match(login.headers['set-cookie'][0],/Secure/);
      assert.equal((await request(app).post('/auth/refresh').set('Cookie',cookie).set('Origin','https://attacker.test').set('X-SmartScan-Session','1').send({})).status,401);
      assert.equal((await request(app).post('/auth/refresh').set('Cookie',cookie).set('Origin','https://localhost').set('X-SmartScan-Session','1').send({})).status,200);
    });
    await scenario('report retries acknowledge one case; only admins can review and conflicts are visible',async()=>{
      const report={requestId:randomUUID(),serialNumber:'SS-'+randomUUID(),reason:'Other concern',details:'Labelled synthetic test'};
      const a=await request(app).post('/v1/reports').send(report),b=await request(app).post('/v1/reports').send(report);assert.equal(a.status,201);assert.equal(b.body.caseId,a.body.caseId);
      assert.equal((await request(app).post('/v1/reports').send({...report,details:'different'})).status,409);
      assert.equal((await request(app).get('/api/enterprise/reports')).status,403);
      const route=`/api/enterprise/reports/${a.body.caseId}/review`;assert.equal((await request(app).post(route).set('x-user','admin').set('x-role','admin').send({status:'investigating',note:'Review begun',expectedVersion:1})).status,200);
      assert.equal((await request(app).post(route).set('x-user','admin').set('x-role','admin').send({status:'dismissed',note:'Stale review',expectedVersion:1})).status,409);
    });
  }finally{provider.destroy();await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
