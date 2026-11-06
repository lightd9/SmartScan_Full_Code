import React, { useState } from 'react';
import { AlertTriangle, Send, CheckCircle2, ShieldAlert } from 'lucide-react';
import { saveReport } from '../utils/storage';
import { vibrateSuccess, vibrateClick } from '../utils/haptics';

export default function ReportModal({ initialProduct, onClose }) {
  const [serial, setSerial] = useState(initialProduct?.serialNumber || '');
  const [storeName, setStoreName] = useState('');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('Counterfeit or fake packaging');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    vibrateSuccess();

    saveReport({
      serialNumber: serial.trim(),
      storeName: storeName.trim(),
      location: location.trim(),
      reason,
      notes: notes.trim(),
      productName: initialProduct?.name || 'Unspecified Product',
    });

    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 2500);
  };

  if (submitted) {
    return (
      <div className="m-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
        <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 12px auto' }} />
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 6 }}>
          Report Submitted Successfully
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
          Thank you for protecting consumer safety. Your incident has been flagged to brand compliance and recorded in the verification registry.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="m-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-main)' }}>
              Report Suspicious Product
            </h2>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Help brand authorities investigate counterfeits
            </span>
          </div>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
          If you encounter a forged packaging QR, duplicate code, or tampered seal, report it directly here.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
            Product Serial Number
          </label>
          <input
            type="text"
            placeholder="e.g. SS-37010C83-997C-4C67-8547-09419BE82245"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid var(--color-border)',
              fontFamily: 'monospace',
              fontSize: 12.5,
              outline: 'none',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
            Store / Seller Name
          </label>
          <input
            type="text"
            required
            placeholder="Store name, marketplace seller, or street vendor"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid var(--color-border)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
            City or Physical Location
          </label>
          <input
            type="text"
            placeholder="City, mall name, or address"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid var(--color-border)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
            Primary Concern
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid var(--color-border)',
              fontSize: 13,
              backgroundColor: '#FFFFFF',
              outline: 'none',
            }}
          >
            <option value="Counterfeit or fake packaging">Counterfeit or fake packaging</option>
            <option value="Broken or missing tamper seal">Broken or missing tamper seal</option>
            <option value="Duplicate QR code detected">Duplicate QR code detected</option>
            <option value="Unregistered product ID">Unregistered product ID</option>
            <option value="Store refused authenticity proof">Store refused authenticity proof</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
            Additional Details
          </label>
          <textarea
            rows={3}
            placeholder="Describe what seemed suspicious (price, packaging quality, seller claims)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid var(--color-border)',
              fontSize: 13,
              outline: 'none',
              resize: 'none',
            }}
          />
        </div>

        <button type="submit" className="btn-m-primary" style={{ marginTop: 6 }}>
          <Send size={16} />
          <span>Submit Incident Report</span>
        </button>
      </form>
    </div>
  );
}
