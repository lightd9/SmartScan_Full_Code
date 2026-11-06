import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Store,
  Truck,
  Factory,
  PackageCheck,
  Flag,
  RotateCcw,
} from 'lucide-react';
import dayjs from 'dayjs';
import { BLOCK_EXPLORER_URL, CONTRACT_ADDRESS, STAGE_NAMES } from '../config/constants';
import { vibrateClick, vibrateSuccess } from '../utils/haptics';
import { saveScanToHistory } from '../utils/storage';

export default function PassportView({ product, onScanAgain, onReportProduct }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!product) {
    return (
      <div className="m-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
        <ShieldCheck size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 12px auto' }} />
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 6 }}>
          No Product Passport Loaded
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
          Scan an official packaging QR code or barcode to inspect its on-chain authenticity seal.
        </p>
        <button type="button" className="btn-m-primary" onClick={onScanAgain}>
          Open Camera Scanner
        </button>
      </div>
    );
  }

  const isAuthentic = product.status === 'AUTHENTIC';
  const isSold = product.status === 'SOLD' || product.isSold;
  const isCounterfeit = product.status === 'COUNTERFEIT' || !product.exists;

  const handleCopySerial = () => {
    vibrateClick();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(product.serialNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSavePassport = () => {
    vibrateSuccess();
    saveScanToHistory(product);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const renderTimelineIcon = (action) => {
    switch (action) {
      case 0:
        return <Factory size={12} />;
      case 1:
        return <Truck size={12} />;
      case 2:
        return <Store size={12} />;
      default:
        return <PackageCheck size={12} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. Prominent Verdict Seal */}
      <div
        className={`verdict-seal ${
          isAuthentic ? 'authentic' : isSold ? 'sold' : 'counterfeit'
        }`}
      >
        <div className="seal-icon-box">
          {isAuthentic ? (
            <ShieldCheck size={28} />
          ) : isSold ? (
            <AlertTriangle size={28} />
          ) : (
            <ShieldAlert size={28} />
          )}
        </div>
        <div>
          <strong style={{ fontSize: 16, fontWeight: 800, display: 'block', marginBottom: 2 }}>
            {product.verdictTitle || (isAuthentic ? 'Authentic Product' : 'Verification Alert')}
          </strong>
          <span style={{ fontSize: 12.5, opacity: 0.9, lineHeight: 1.4, display: 'block' }}>
            {product.verdictMessage ||
              (isAuthentic
                ? 'Cryptographically verified with genuine manufacturer ledger signature.'
                : 'Warning: This product record cannot be validated on-chain.')}
          </span>
        </div>
      </div>

      {/* 2. Product Specifications Card */}
      <div className="m-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {product.brand || 'Certified Manufacturer'}
            </span>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>
              {product.name || 'Verified Merchandise'}
            </h2>
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: isAuthentic ? '#DCFCE7' : isSold ? '#FEF3C7' : '#FEE2E2',
              color: isAuthentic ? '#15803D' : isSold ? '#B45309' : '#B91C1C',
            }}
          >
            {isAuthentic ? 'Genuine' : isSold ? 'Sold' : 'Invalid'}
          </span>
        </div>

        {/* Serial Badge with Copy */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            backgroundColor: 'var(--color-surface-subtle)',
            borderRadius: 12,
            border: '1px solid var(--color-border)',
            marginBottom: 14,
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>
              Product Serial
            </span>
            <code style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-main)', wordBreak: 'break-all' }}>
              {product.serialNumber}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopySerial}
            style={{
              background: 'none',
              border: 'none',
              color: copied ? '#10B981' : 'var(--color-primary)',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Copy serial number"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        {product.description && (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {product.description}
          </p>
        )}
      </div>

      {/* 3. Provenance Journey Timeline */}
      {Array.isArray(product.history) && product.history.length > 0 && (
        <div className="m-card">
          <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 4 }}>
            Cryptographic Custody Trail
          </h3>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 12 }}>
            Verifiable supply chain checkpoints signed by network nodes.
          </span>

          <div className="timeline-track">
            {product.history.map((event, idx) => {
              const formattedDate = event.timestamp
                ? dayjs(event.timestamp * 1000).format('MMM D, YYYY · h:mm a')
                : 'Timestamp recorded';
              const stageName = STAGE_NAMES[event.action] || 'Custody Handover';

              return (
                <div key={idx} className="timeline-step">
                  <div className="timeline-dot done">
                    {renderTimelineIcon(event.action)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 13, color: 'var(--color-text-main)' }}>
                        {stageName}
                      </strong>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {formattedDate}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginTop: 2 }}>
                      {event.actor} {event.location ? `· ${event.location}` : ''}
                    </span>
                    {event.actorWallet && (
                      <code style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginTop: 2 }}>
                        {event.actorWallet.slice(0, 10)}...{event.actorWallet.slice(-8)}
                      </code>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. On-Chain Cryptographic Proof */}
      <div className="m-card">
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 10 }}>
          Blockchain Security Proof
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Ledger Network</span>
            <strong>Ethereum Sepolia (EVM)</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Smart Contract</span>
            <code style={{ fontSize: 11.5 }}>
              {CONTRACT_ADDRESS.slice(0, 8)}...{CONTRACT_ADDRESS.slice(-6)}
            </code>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Etherscan Proof</span>
            <a
              href={`${BLOCK_EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--color-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              <span>View On Explorer</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* 5. Quick Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        <button
          type="button"
          className="btn-m-primary"
          onClick={handleSavePassport}
          style={{
            backgroundColor: saved ? '#059669' : undefined,
          }}
        >
          <PackageCheck size={18} />
          <span>{saved ? 'Saved to My Passports ✓' : 'Save to My Passports'}</span>
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn-m-secondary"
            onClick={onScanAgain}
            style={{ flex: 1 }}
          >
            <RotateCcw size={16} />
            <span>Scan Another</span>
          </button>

          <button
            type="button"
            className="btn-m-secondary"
            onClick={() => onReportProduct(product)}
            style={{
              flex: 1,
              borderColor: 'var(--color-danger-border)',
              color: 'var(--color-danger-dark)',
            }}
          >
            <Flag size={16} />
            <span>Report Issue</span>
          </button>
        </div>
      </div>
    </div>
  );
}
