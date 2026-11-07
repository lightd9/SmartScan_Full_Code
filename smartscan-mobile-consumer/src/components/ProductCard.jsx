import React, { useState } from 'react';
import { ArrowUpRight, Box, Clock3, Ellipsis, MapPin, ShieldCheck, ShieldAlert, ExternalLink } from 'lucide-react';
import { productImage, productStatus, scanDate } from '../utils/product';
import { BLOCK_EXPLORER_URL, CONTRACT_ADDRESS } from '../config/constants';

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

export default function ProductCard({ product, onDetails, onReport }) {
  const status = productStatus(product);
  const StatusIcon = status.tone === 'authentic' ? ShieldCheck : ShieldAlert;
  const contract = /^0x[a-fA-F0-9]{40}$/.test(product.contractAddress || '') ? product.contractAddress : CONTRACT_ADDRESS;
  return <article className="passport-card">
    <ProductPhoto product={product} />
    <div className="passport-card-body">
      <span className={`status-badge ${status.tone}`}><StatusIcon size={13} />{status.label}</span>
      <h2>{status.title}</h2>
      <p className="product-name">{product.name || 'Unregistered product'}</p>
      <p className="metadata"><MapPin size={15} /><span>{product.brand || product.manufacturer || 'Origin not available'}</span></p>
      <p className="metadata"><Clock3 size={14} /><span>Scanned {scanDate(product)}{product.isSold ? ' · Previously sold' : ''}</span></p>
      <div className="card-actions">
        <button className="dark-button" onClick={onDetails}><ArrowUpRight size={18} />View checks</button>
        <a className="circle-button" href={`${BLOCK_EXPLORER_URL}/address/${contract}`} target="_blank" rel="noreferrer" aria-label="View blockchain contract"><ExternalLink size={18} /></a>
        <button className="circle-button" onClick={onReport} aria-label="Report this product"><Ellipsis size={21} /></button>
      </div>
    </div>
  </article>;
}
