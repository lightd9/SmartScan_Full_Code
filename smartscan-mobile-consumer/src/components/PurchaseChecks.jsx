import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { fetchProductWithFallback } from '../api/verify';

export default function PurchaseChecks({ product, onUpdated }) {
  const fieldId = useId();
  const retailer = product.assessment?.retailer;
  const previous = product.purchaseAnswers;
  const [seller, setSeller] = useState(previous?.seller || '');
  const [other, setOther] = useState(previous?.other || '');
  const [context, setContext] = useState(previous?.context || '');
  const [includeLocation, setIncludeLocation] = useState(previous?.includeLocation || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const mounted = useRef(true);
  const scanId = useRef(product.scanEventId || product.assessment?.assessmentId || crypto.randomUUID());
  const complete = Boolean(seller && context && (seller !== 'other' || other.trim()) && (seller !== 'recorded' || retailer));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function check(event) {
    event.preventDefault();
    if (running.current || !complete) return;
    running.current = true;
    setBusy(true); setError('');
    const purchase = { context, ...(seller === 'recorded' && retailer ? { sellerId: retailer.id } : seller === 'other' ? { otherSeller: other.trim() } : {}) };
    let locationNote = '';
    try {
      if (includeLocation && context === 'in_store') {
        try {
          const p = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }));
          purchase.location = { source: 'device', latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyMeters: p.coords.accuracy, capturedAt: new Date(p.timestamp).toISOString() };
        } catch { locationNote = 'Location was unavailable. Your other checks were completed.'; }
      }
      if (!mounted.current) return;
      const result = await fetchProductWithFallback(product.serialNumber, { eventId: scanId.current, contractAddress: product.contractAddress, purchase });
      if (mounted.current) onUpdated({ ...result, scannedAt: product.scannedAt, scanEventId: scanId.current, purchaseLocationNote: locationNote,
        purchaseAnswers: { completed: true, seller, other: seller === 'other' ? other.trim() : '', context, includeLocation: includeLocation && context === 'in_store' } });
    } catch (e) {
      if (mounted.current) setError(e.message || 'Could not complete your checks. Your answers are saved here; try again.');
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <form className="purchase-checks" aria-label="Purchase questions" aria-busy={busy} onSubmit={check}>
    <div className="purchase-question">
      <label htmlFor={`${fieldId}-seller`}><span className="question-number" aria-hidden="true">1</span>Where did you get this product?</label>
      <p id={`${fieldId}-retailer`} className="supporting-copy">{retailer ? <>Recorded retailer: <strong>{retailer.name}</strong>{retailer.address ? ` · ${retailer.address}` : ''}</> : 'No confirmed retailer is recorded for this product yet.'}</p>
      <select id={`${fieldId}-seller`} aria-describedby={`${fieldId}-retailer`} required value={seller} disabled={busy} onChange={e => setSeller(e.target.value)}>
        <option value="" disabled>Choose your answer</option>
        {retailer && <option value="recorded">From {retailer.name}</option>}
        <option value="other">From {retailer ? 'a different' : 'a'} retailer</option>
        <option value="not_bought">I haven’t bought it yet</option>
        <option value="unsure">I’m not sure</option>
      </select>
      {seller === 'other' && <><label className="other-seller-label" htmlFor={`${fieldId}-other`}>Retailer name or store address</label><input id={`${fieldId}-other`} required maxLength={150} value={other} placeholder="Enter the store name or address" disabled={busy} onChange={e => setOther(e.target.value)} /></>}
    </div>
    <div className="purchase-question">
      <label htmlFor={`${fieldId}-context`}><span className="question-number" aria-hidden="true">2</span>When are you checking?</label>
      <select id={`${fieldId}-context`} required value={context} disabled={busy} onChange={e => setContext(e.target.value)}>
        <option value="" disabled>Choose your answer</option>
        <option value="in_store">I am at the purchase store</option>
        <option value="delivery">This was delivered to me</option>
        <option value="after_purchase">After leaving the store</option>
        <option value="unknown">Just checking / I’m not sure</option>
      </select>
      {context === 'in_store' && <label className="purchase-location"><input type="checkbox" checked={includeLocation} disabled={busy} onChange={e => setIncludeLocation(e.target.checked)} /><span><MapPin size={16} aria-hidden="true"/>Include my current location<small>Optional. Helps compare this store with the recorded retailer.</small></span></label>}
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="dark-button" disabled={busy || !complete}>{busy ? 'Checking your product…' : 'Show verification result'}<ArrowRight size={18}/></button>
    {!complete && <p className="supporting-copy small">Answer both questions to see your result.</p>}
  </form>;
}
