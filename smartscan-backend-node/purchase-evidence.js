const { ethers } = require('ethers');
function normalizePurchase(value) {
  if (value === undefined) return null;
  const bad = () => { const e = new Error('Provide a valid purchase context and seller.'); e.status=400; throw e; };
  if (!value || !['in_store','delivery','after_purchase','unknown'].includes(value.context)) bad();
  if (value.sellerId != null && !/^\d{1,15}$/.test(String(value.sellerId))) bad();
  if (value.otherSeller != null && (typeof value.otherSeller !== 'string' || value.otherSeller.length>150)) bad();
  if (value.sellerId && value.otherSeller) bad();
  const result = { context:value.context,sellerId:value.sellerId ? String(value.sellerId) : null,otherSeller:value.otherSeller?.trim() || null };
  if (value.location) {
    const l=value.location;
    if (l.source!=='device' || typeof l.latitude!=='number' || !Number.isFinite(l.latitude) || Math.abs(l.latitude)>90 || typeof l.longitude!=='number' || !Number.isFinite(l.longitude) || Math.abs(l.longitude)>180 || !Number.isFinite(l.accuracyMeters) || l.accuracyMeters<0 || !Number.isFinite(Date.parse(l.capturedAt))) bad();
    result.location={ source:'device',latitude:l.latitude,longitude:l.longitude,accuracyMeters:l.accuracyMeters,capturedAt:new Date(l.capturedAt).toISOString() };
  }
  return result;
}
function distanceKm(a,b) {
  const rad=n=>n*Math.PI/180;
  const x=Math.sin(rad(b.latitude-a.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
}
async function loadEvidence(pool,product,purchase) {
  if (!product.exists || product.source!=='chain') return {};
  const issuerWallet=product.history?.find(h=>h.action===0)?.actorWallet;
  const rows=(await pool.query(`SELECT s.id,s.wallet_address,s.status,s.role,s.subaccount_name,COALESCE(NULLIF(s.location,''),p.location,'') AS address
    FROM facility_subaccounts s LEFT JOIN profile p ON p.username=s.parent_username
    WHERE lower(s.wallet_address)=ANY($1::text[]) OR s.id::text=$2`,[[issuerWallet,product.custodian].filter(Boolean).map(x=>x.toLowerCase()),purchase?.sellerId || ''])).rows;
  const issuer=rows.find(r=>r.wallet_address?.toLowerCase()===issuerWallet?.toLowerCase() && r.role==='manufacturer');
  const latestReceipt=[...(product.history || [])].reverse().find(h=>[0,2].includes(h.action));
  const holder=rows.find(r=>r.wallet_address?.toLowerCase()===product.custodian?.toLowerCase() && r.role==='retailer');
  const retailer=holder && latestReceipt?.actorRole===4 ? { id:String(holder.id),wallet:holder.wallet_address,name:holder.subaccount_name,address:holder.address,status:holder.status } : null;
  const events=(await pool.query(`SELECT o.location,o.facility_id,o.action,i.expected_version,i.operation_id,s.location AS public_address,s.subaccount_name
    FROM enterprise_operation_items i JOIN enterprise_operations o ON o.id=i.operation_id
    LEFT JOIN facility_subaccounts s ON s.id::text=o.facility_id
    WHERE i.serial_number=$1 AND i.status='confirmed' AND i.proof_kind='blockchain' ORDER BY i.expected_version`,[product.serialNumber])).rows;
  const retailerEvent=retailer ? [...events].reverse().find(e=>String(e.facility_id)===retailer.id && ['receive','sell'].includes(e.action)) : null;
  const publicHistory=(product.history||[]).map(h=>{
    if (product.protocol!=='receipt-v3') return h;
    const event=events.find(e=>e.expected_version+1===h.id);
    return { ...h,location:event?.public_address || 'Location not published', locationSource:event?.location?.source || 'unavailable',
      ...(event?.location?.source==='device' ? { coordinates:[Number(event.location.latitude.toFixed(2)),Number(event.location.longitude.toFixed(2))],approximate:true } : {}) };
  });
  return { issuer:issuer ? { registered:true,active:issuer.status==='active',name:issuer.subaccount_name } : null,retailer,
    selectedSeller:rows.find(r=>String(r.id)===purchase?.sellerId && r.role==='retailer') || null,
    retailerLocation:retailerEvent?.location || null,publicHistory };
}
function purchaseFindings(purchase,evidence,now=Date.now()) {
  const findings=[];
  const add=(domain,code,state,explanation,source)=>findings.push({domain,code,state,explanation,source});
  const { retailer,retailerLocation }=evidence;
  if (!purchase?.sellerId && !purchase?.otherSeller) add('seller','seller_not_compared','unknown',retailer ? `Confirm whether you bought this product from ${retailer.name}.` : 'No confirmed retailer receipt is available for comparison.','not_provided');
  else if (!retailer) add('seller','retailer_custody_missing','concern','You reported a seller, but this item has no confirmed retailer custody. Ask the seller or manufacturer to resolve the gap.','chain_and_buyer');
  else if (purchase.sellerId===retailer.id && evidence.selectedSeller?.status==='active') add('seller','seller_match','supported','The retailer you selected matches the last confirmed retailer. This comparison relies on your purchase information.','chain_and_buyer');
  else add('seller','seller_mismatch','concern',`Your reported seller does not match the last confirmed retailer, ${retailer.name}. Resale or a missing transfer may explain this; check before relying on the product.`,'chain_and_buyer');
  const point=purchase?.location;
  if (purchase?.context!=='in_store') add('location','purchase_location_unknown','unknown','Store distance is only checked when you confirm you are scanning at the purchase store. Delivery and later scans do not count against the product.','not_provided');
  else if (!point || point.accuracyMeters>1000 || Math.abs(now-Date.parse(point.capturedAt))>10*60*1000 || retailerLocation?.source!=='device' || !Number.isFinite(retailerLocation.accuracyMeters) || retailerLocation.accuracyMeters>1000) add('location','purchase_location_unavailable','unknown','A sufficiently accurate purchase-store location and recorded retailer location are both needed. Missing location is not a failed check.','device_reported');
  else {
    const distance=distanceKm(point,retailerLocation), uncertainty=(point.accuracyMeters+retailerLocation.accuracyMeters)/1000;
    if (distance-uncertainty>100) add('location','purchase_location_mismatch','concern',`The reported purchase store is about ${Math.round(distance)} km from the recorded retailer receipt. Confirm the seller and address.`,'device_reported');
    else if (distance+uncertainty<=5) add('location','purchase_location_match','supported','The reported purchase-store location is within 5 km of the recorded retailer receipt. Device locations are supporting evidence and can be inaccurate.','device_reported');
    else add('location','purchase_location_uncertain','unknown','The available locations do not establish a store match. Verify the retailer address.','device_reported');
  }
  return findings;
}
module.exports={ normalizePurchase,loadEvidence,purchaseFindings,distanceKm };
