import { expect } from 'chai';
import { network } from 'hardhat';
const { ethers }=await network.getOrCreate();
const types={Transfer:[{name:'serialHash',type:'bytes32'},{name:'sender',type:'address'},{name:'receiver',type:'address'},{name:'version',type:'uint256'},{name:'nonce',type:'bytes32'},{name:'deadline',type:'uint256'},{name:'senderEpoch',type:'uint256'},{name:'receiverEpoch',type:'uint256'},{name:'authorizationEpoch',type:'uint256'}]};
describe('Receipt protocol V3',function(){
  let c,owner,maker,supplier,retailer,other;const serial='SS-00000000-0000-4000-8000-000000000003';
  beforeEach(async()=>{
    [owner,maker,supplier,retailer,other]=await ethers.getSigners();
    c=await (await ethers.getContractFactory('IdenteefiV3')).deploy();await c.waitForDeployment();
    for(const [w,role,name] of [[maker,2,'Maker'],[supplier,3,'Supplier'],[retailer,4,'Retailer'],[other,3,'Other supplier']])await c.grantRole(w.address,role,name);
    await c.connect(maker).registerProduct('Test','Maker',serial,'','','','event reference','');
  });
  async function permit(sender=maker,receiver=supplier,overrides={},domainOverrides={}){
    const p=await c.getProduct(serial),block=await ethers.provider.getBlock('latest');
    const value={serialHash:ethers.id(serial),sender:sender.address,receiver:receiver.address,version:p[5].length,nonce:ethers.hexlify(ethers.randomBytes(32)),deadline:block.timestamp+800,senderEpoch:await c.credentialEpoch(sender.address),receiverEpoch:await c.credentialEpoch(receiver.address),authorizationEpoch:await c.authorizationEpoch(serial),...overrides};
    const domain={name:'SmartScanReceipt',version:'3',chainId:(await ethers.provider.getNetwork()).chainId,verifyingContract:await c.getAddress(),...domainOverrides};
    return {value,signature:await sender.signTypedData(domain,types,value)};
  }
  const receive=(p,who=supplier)=>c.connect(who).confirmReceipt(serial,p.value,p.signature,'event reference');
  it('transfers in one receipt transaction with no chain dispatch and preserves sale/recall',async()=>{
    expect(c.interface.hasFunction('dispatchProduct')).to.equal(false);
    expect(c.interface.hasFunction('confirmDelivery')).to.equal(false);
    const p=await permit();await expect(receive(p)).to.emit(c,'ReceiptAuthorized');
    let state=await c.getProduct(serial);expect(state[7]).to.equal(supplier.address);expect(state[5].map(e=>Number(e.action))).to.deep.equal([0,2]);
    await receive(await permit(supplier,retailer),retailer);
    await c.connect(retailer).markSold(serial,'','','');
    await c.connect(maker).recallProduct(serial,'test recall','','','');
    state=await c.getProduct(serial);expect(state[9]).to.equal(true);expect(state[10]).to.equal(true);
  });
  it('copied QR and a registered account cannot receive without the current sender signature',async()=>{
    await expect(receive(await permit(other,supplier))).to.be.revertedWith('IdenteefiV3: sender or receiver mismatch');
    const p=await permit();await expect(receive(p,other)).to.be.revertedWith('IdenteefiV3: sender or receiver mismatch');
    await expect(receive({...p,signature:'0x'})).to.be.revertedWith('IdenteefiV3: invalid signature');
  });
  it('rejects modified receiver, wrong subject and wrong signing domain',async()=>{
    const p=await permit();await expect(receive({...p,value:{...p.value,receiver:other.address}},other)).to.be.revertedWith('IdenteefiV3: invalid signature');
    await expect(receive(await permit(maker,supplier,{serialHash:ethers.id('another product')}))).to.be.revertedWith('IdenteefiV3: subject or version mismatch');
    for(const domainOverrides of [{chainId:1},{verifyingContract:other.address},{version:'2'}])await expect(receive(await permit(maker,supplier,{},domainOverrides))).to.be.revertedWith('IdenteefiV3: invalid signature');
  });
  it('allows only one receiver at the signed custody version and rejects replay',async()=>{
    const a=await permit(),b=await permit(maker,other);await receive(a);
    await expect(receive(b,other)).to.be.revertedWith('IdenteefiV3: subject or version mismatch');
    await expect(receive(a)).to.be.revertedWith('IdenteefiV3: subject or version mismatch');
  });
  it('rejects expired permits and forbids future-dated long-lived authorization',async()=>{
    const block=await ethers.provider.getBlock('latest');
    await expect(receive(await permit(maker,supplier,{deadline:block.timestamp-1}))).to.be.revertedWith('IdenteefiV3: authorization expired or too long');
    await expect(receive(await permit(maker,supplier,{deadline:block.timestamp+86400}))).to.be.revertedWith('IdenteefiV3: authorization expired or too long');
  });
  it('on-chain cancellation invalidates an already issued signature',async()=>{
    const p=await permit();await expect(c.connect(other).invalidateAuthorizations(serial)).to.be.revertedWith('IdenteefiV3: not custodian');
    await c.connect(maker).invalidateAuthorizations(serial);
    await expect(receive(p)).to.be.revertedWith('IdenteefiV3: authorization revoked');
    await receive(await permit());
  });
  it('role revocation then regrant cannot revive a permit',async()=>{
    const p=await permit();await c.revokeRole(maker.address);await c.grantRole(maker.address,2,'Maker');
    await expect(receive(p)).to.be.revertedWith('IdenteefiV3: authorization revoked');
    const fresh=await permit();await c.revokeRole(supplier.address);await c.grantRole(supplier.address,3,'Supplier');
    await expect(receive(fresh)).to.be.revertedWith('IdenteefiV3: authorization revoked');
  });
  it('wallet replacement invalidates old sender authorization and preserves custody',async()=>{
    const p=await permit();const replacement=(await ethers.getSigners())[6];
    await c.replaceRole(maker.address,replacement.address,'Replacement maker');
    expect((await c.getProduct(serial))[7]).to.equal(replacement.address);
    await expect(receive(p)).to.be.revertedWith('IdenteefiV3: sender or receiver mismatch');
    await receive(await permit(replacement,supplier));
  });
  it('recall and invalid role transitions cannot be bypassed by valid signatures',async()=>{
    await expect(receive(await permit(maker,retailer),retailer)).to.be.revertedWith('IdenteefiV3: invalid custody transition');
    const p=await permit();await c.recallProduct(serial,'recall','','','');await expect(receive(p)).to.be.revertedWith('IdenteefiV3: product closed or missing');
  });
});
