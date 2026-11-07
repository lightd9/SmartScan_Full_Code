import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Box, Clock3, Ellipsis, MapPin, ShieldCheck, ShieldAlert, ExternalLink } from 'lucide-react';
import { canShowEvidenceScore, needsPurchaseDetails, productImage, productStatus, scanDate } from '../utils/product';
import { BLOCK_EXPLORER_URL, CONTRACT_ADDRESS } from '../config/constants';
import PurchaseChecks from './PurchaseChecks';

export function ProductPhoto({ product, compact = false }) {
  const source = productImage(product);
  const [failedSource, setFailedSource] = useState(null);
  const [loadedSource, setLoadedSource] = useState(null);
  return <div className={`product-photo ${compact ? 'compact' : ''}`}>
    {source && source !== failedSource ? <img src={source} className={loadedSource === source ? 'is-loaded' : ''} alt={product.name || 'Scanned product'} decoding="async" onLoad={() => setLoadedSource(source)} onError={() => setFailedSource(source)} /> :
      <div className="product-photo-placeholder"><Box strokeWidth={0.8} aria-hidden="true" /><span>Product passport</span></div>}
  </div>;
}

export function ProductRow({ product, onClick, selected }) {
  const status = productStatus(product);
  return <button type="button" className={`product-row ${selected ? 'selected' : ''}`} onClick={onClick}>
    <ProductPhoto product={product} compact />
    <span className="product-row-copy">
      <span className={`status-badge ${status.tone}`}>{status.label}</span>
      <strong>{product.name || 'Unregistered product'}</strong>
      <span className="metadata"><MapPin size={14} /><span>{product.brand || product.manufacturer || scanDate(product)}</span></span>
    </span>
  </button>;
}

export default function ProductCard({ product, onDetails, onReport, onUpdated, onStartPurchase, editingPurchase = false }) {
  const answering = editingPurchase;
  const card = useRef(null);
  const resultHeading = useRef(null);
  const completedHere = useRef(false);
  useEffect(() => {
    if (card.current) card.current.scrollTop = 0;
    if (!answering && completedHere.current) {
      resultHeading.current?.focus({ preventScroll: true });
      completedHere.current = false;
    }
  }, [answering]);
  const status = productStatus(product);
  const summary = product.assessment?.summary;
  const warning = ['RECALLED', 'CONCERN'].includes(summary?.status);
  const StatusIcon = status.tone === 'authentic' ? ShieldCheck : ShieldAlert;
  const contract = /^0x[a-fA-F0-9]{40}$/.test(product.contractAddress || '') ? product.contractAddress : CONTRACT_ADDRESS;
  return <article ref={card} className={`passport-card${answering ? ' answering-purchase' : ''}`}>
    {!answering && <ProductPhoto product={product} />}
    <div className="passport-card-body">
      {answering ? <>
        <div className="card-purchase-intro"><span className="status-badge neutral">Two quick questions</span><h2>{product.name || 'Registered product'}</h2><p className="supporting-copy">Answer below to see your verification result.</p></div>
        {warning && <div className="purchase-warning" role="alert"><ShieldAlert size={22}/><div><strong>{summary.title}</strong><p>{summary.description}</p></div></div>}
        <PurchaseChecks product={product} onUpdated={updated => { completedHere.current = true; onUpdated(updated); }} />
      </> : <>
      <span className={`status-badge ${status.tone}`}><StatusIcon size={13} />{status.label}</span>
      <h2 ref={resultHeading} tabIndex={-1}>{status.title}</h2>
      {canShowEvidenceScore(product) && <p className="evidence-score"><strong>{product.assessment.score.value}<small>/100</small></strong><span>Evidence score</span></p>}
      <p className="product-name">{product.name || 'Unregistered product'}</p>
      <p className="metadata"><MapPin size={15} /><span>{product.brand || product.manufacturer || 'Origin not available'}</span></p>
      <p className="metadata"><Clock3 size={14} /><span>Scanned {scanDate(product)}{product.isSold ? ' · Previously sold' : ''}</span></p>
      <div className="card-actions">
        <button className="dark-button" onClick={needsPurchaseDetails(product) ? onStartPurchase : onDetails}><ArrowUpRight size={18} />{needsPurchaseDetails(product) ? 'Finish verification' : 'View checks'}</button>
        <a className="circle-button" href={`${BLOCK_EXPLORER_URL}/address/${contract}`} target="_blank" rel="noreferrer" aria-label="View blockchain contract"><ExternalLink size={18} /></a>
        <button className="circle-button" onClick={onReport} aria-label="Report this product"><Ellipsis size={21} /></button>
      </div>
      </>}
    </div>
  </article>;
}
