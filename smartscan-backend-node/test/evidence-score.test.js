const test=require('node:test');const assert=require('node:assert/strict');
const {assessProduct}=require('../assessment');const {normalizePurchase,purchaseFindings}=require('../purchase-evidence');
const product={serialNumber:'SS-test',exists:true,source:'chain',stage:4,isSold:true};
const evidence={issuer:{active:true},retailer:{id:'10',name:'Test store'},selectedSeller:{status:'active'},retailerLocation:{source:'device',latitude:6.5,longitude:3.3,accuracyMeters:10}};
const options={product,evidence,monitoring:'complete',historyChecked:true,purchase:{context:'after_purchase',sellerId:'10'}};
test('sold lifecycle stays secondary to a passing assessment',()=>{
  const a=assessProduct(options);assert.equal(a.summary.status,'VERIFIED');assert.equal(a.score.value,90);assert.equal(a.lifecycle.sold,true);assert.doesNotMatch(a.summary.title,/sale/i);
});
test('70+ without the required seller check is incomplete, never falsely authentic',()=>{
  const a=assessProduct({...options,purchase:null});assert.equal(a.score.value,70);assert.equal(a.summary.status,'INCOMPLETE');
});
test('missing evidence cannot be renormalized to 100 and does not assert counterfeit',()=>{
  const a=assessProduct({product});assert.equal(a.score.value,25);assert.equal(a.summary.status,'INCOMPLETE');assert.doesNotMatch(a.summary.title,/inauthentic|counterfeit/i);
  assert.equal(assessProduct({product:{...product,source:'registry'}}).score,null);
});
test('seller mismatch and recall override a high score',()=>{
  assert.equal(assessProduct({...options,purchase:{context:'delivery',otherSeller:'Different seller'}}).summary.status,'CONCERN');
  const a=assessProduct({...options,product:{...product,recalled:true,stage:5}});assert.equal(a.score.value,90);assert.equal(a.summary.status,'RECALLED');
});
test('distance is relevant only to fresh accurate in-store context',()=>{
  const location={source:'device',latitude:9,longitude:7,accuracyMeters:10,capturedAt:new Date().toISOString()};
  for(const context of ['delivery','after_purchase','unknown'])assert.equal(purchaseFindings({context,location},evidence).find(f=>f.domain==='location').state,'unknown');
  assert.equal(purchaseFindings({context:'in_store',location},evidence).find(f=>f.domain==='location').state,'concern');
  assert.equal(purchaseFindings({context:'in_store',location:{...location,latitude:6.5,longitude:3.3}},evidence).find(f=>f.domain==='location').state,'supported');
  for(const changed of [{accuracyMeters:5000},{capturedAt:'2020-01-01T00:00:00Z'}])assert.equal(purchaseFindings({context:'in_store',location:{...location,...changed}},evidence).find(f=>f.domain==='location').state,'unknown');
});
test('invalid location, conflicting seller input and identity spoofing are rejected',()=>{
  for(const value of [{context:'invalid'},{context:'in_store',sellerId:'10',otherSeller:'Store'},{context:'in_store',location:{source:'device',latitude:100,longitude:3}}])assert.throws(()=>normalizePurchase(value));
});
