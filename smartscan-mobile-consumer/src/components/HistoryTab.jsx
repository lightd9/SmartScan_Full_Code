import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, ShieldAlert, Trash2, ArrowRight } from 'lucide-react';
import dayjs from 'dayjs';
import { getScanHistory, clearScanHistory } from '../utils/storage';
import { vibrateClick } from '../utils/haptics';

export default function HistoryTab({ onSelectProduct, onOpenScanner }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(getScanHistory());
  }, []);

  const handleClear = () => {
    vibrateClick();
    if (window.confirm('Clear all saved product passports from this device?')) {
      clearScanHistory();
      setHistory([]);
    }
  };

  if (history.length === 0) {
    return (
      <div className="m-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
        <History size={44} color="var(--color-text-muted)" style={{ margin: '0 auto 12px auto' }} />
        <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 6 }}>
          No Scan History Yet
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
          Products you scan will be saved locally here for offline warranty and purchase proof.
        </p>
        <button type="button" className="btn-m-primary" onClick={onOpenScanner}>
          Start Scanning
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-text-main)' }}>
            Saved Passports
          </h2>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {history.length} verified item{history.length === 1 ? '' : 's'} cached offline
          </span>
        </div>
        <button
          type="button"
          onClick={handleClear}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-danger-dark)',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            padding: '6px 8px',
          }}
        >
          <Trash2 size={14} />
          <span>Clear</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {history.map((item, index) => {
          const isAuthentic = item.status === 'AUTHENTIC';
          const isSold = item.status === 'SOLD' || item.isSold;
          const formattedDate = item.scannedAt
            ? dayjs(item.scannedAt).format('MMM D, YYYY')
            : 'Recently';

          return (
            <div
              key={`${item.serialNumber}-${index}`}
              className="m-card"
              onClick={() => {
                vibrateClick();
                onSelectProduct(item);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                cursor: 'pointer',
                marginBottom: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isAuthentic ? '#DCFCE7' : isSold ? '#FEF3C7' : '#FEE2E2',
                    color: isAuthentic ? '#15803D' : isSold ? '#B45309' : '#B91C1C',
                    flexShrink: 0,
                  }}
                >
                  {isAuthentic ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                </div>

                <div style={{ overflow: 'hidden' }}>
                  <strong
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--color-text-main)',
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.name || 'Verified Product'}
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      {item.brand || 'Brand'}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>•</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {formattedDate}
                    </span>
                  </div>
                </div>
              </div>

              <ArrowRight size={16} color="var(--color-text-muted)" style={{ flexShrink: 0, marginLeft: 8 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
