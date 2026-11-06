import React from 'react';
import { QrCode, ShieldCheck, History, AlertTriangle } from 'lucide-react';
import { vibrateClick } from '../utils/haptics';

export default function BottomNav({ activeTab, onSelectTab, hasScannedItem }) {
  const handleTab = (tab) => {
    vibrateClick();
    onSelectTab(tab);
  };

  return (
    <nav className="bottom-nav" aria-label="Bottom navigation">
      <button
        type="button"
        className={`nav-tab ${activeTab === 'scan' ? 'active' : ''}`}
        onClick={() => handleTab('scan')}
      >
        <QrCode size={22} />
        <span>Scan</span>
      </button>

      <button
        type="button"
        className={`nav-tab ${activeTab === 'passport' ? 'active' : ''}`}
        onClick={() => handleTab('passport')}
        style={{ position: 'relative' }}
      >
        <ShieldCheck size={22} />
        <span>Passport</span>
        {hasScannedItem && (
          <span
            style={{
              position: 'absolute',
              top: 6,
              right: '25%',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#10B981',
            }}
          />
        )}
      </button>

      <button
        type="button"
        className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => handleTab('history')}
      >
        <History size={22} />
        <span>History</span>
      </button>

      <button
        type="button"
        className={`nav-tab ${activeTab === 'report' ? 'active' : ''}`}
        onClick={() => handleTab('report')}
      >
        <AlertTriangle size={22} />
        <span>Report</span>
      </button>
    </nav>
  );
}
