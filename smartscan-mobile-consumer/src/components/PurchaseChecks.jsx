import React, { useRef, useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { fetchProductWithFallback } from '../api/verify';

export default function PurchaseChecks({ product,onUpdated }) {
  const retailer=product.assessment?.retailer;
  const [seller,setSeller]=useState('');
  const [other,setOther]=useState('');
  const [context,setContext]=useState('unknown');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [locationNote,setLocationNote]=useState('');
  const scanId=useRef(product.assessment?.assessmentId || crypto.randomUUID());
  async function check(withLocation=false) {
    if(busy) return;
    setBusy(true);setError('');setLocationNote('');
    const purchase={context,...(seller==='recorded' && retailer ? {sellerId:retailer.id} : seller==='other' && other.trim() ? {otherSeller:other.trim()} : {})};
    if(withLocation && context==='in_store') {
      try {
        const p=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000,maximumAge:0}));
        purchase.location={source:'device',latitude:p.coords.latitude,longitude:p.coords.longitude,accuracyMeters:p.coords.accuracy,capturedAt:new Date(p.timestamp).toISOString()};
      } catch { setLocationNote('Location was unavailable. Your other checks can still be completed.'); }
    }
    try {
      const result=await fetchProductWithFallback(product.serialNumber,{eventId:scanId.current,contractAddress:product.contractAddress,purchase});
      onUpdated({...result,scannedAt:product.scannedAt});
    } catch(e) {setError(e.message || 'Could not update checks. Try again.');}
    finally {setBusy(false);}
  }
  return <section className="purchase-checks" aria-label="Confirm purchase details">
    <h4>Confirm your retailer</h4>
    {retailer ? <p>Last confirmed retailer: <strong>{retailer.name}</strong>{retailer.address ? ` · ${retailer.address}` : ''}</p> : <p>No confirmed retailer receipt is available. A missing transfer needs clarification from the seller.</p>}
    <label htmlFor="purchase-seller">Where did you buy this product?</label>
    <select id="purchase-seller" value={seller} disabled={busy} onChange={e=>setSeller(e.target.value)}>
      <option value="">I have not confirmed the seller</option>
      {retailer && <option value="recorded">From {retailer.name}</option>}
      <option value="other">From a different retailer</option>
    </select>
    {seller==='other' && <input aria-label="Retailer name" maxLength={150} value={other} placeholder="Retailer name or store address" disabled={busy} onChange={e=>setOther(e.target.value)} />}
    <label htmlFor="purchase-context">When are you checking?</label>
    <select id="purchase-context" value={context} disabled={busy} onChange={e=>setContext(e.target.value)}>
      <option value="unknown">Just checking</option><option value="in_store">I am at the purchase store</option><option value="delivery">This was delivered to me</option><option value="after_purchase">After leaving the store</option>
    </select>
    <button className="dark-button" disabled={busy || (seller==='other' && !other.trim())} onClick={()=>void check()}>{busy ? 'Checking…' : 'Update checks'}<ArrowRight size={18}/></button>
    {context==='in_store' && <button className="text-button" disabled={busy || (seller==='other' && !other.trim())} onClick={()=>void check(true)}><MapPin size={16}/>Include my store location</button>}
    {context==='in_store' && <p className="supporting-copy small">Location is optional and is used to compare this store with the recorded retailer location.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}{locationNote && <p role="status">{locationNote}</p>}
  </section>;
}
