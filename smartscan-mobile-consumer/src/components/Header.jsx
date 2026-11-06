import React from 'react';
import { ShieldCheck, Flashlight, Info } from 'lucide-react';
import logoImg from '../assets/logo.png';
import { vibrateClick } from '../utils/haptics';

export default function Header({ torchActive, onToggleTorch, onShowInfo }) {
  const handleTorch = () => {
    vibrateClick();
    if (onToggleTorch) onToggleTorch();
  };

  const handleInfo = () => {
    vibrateClick();
    if (onShowInfo) onShowInfo();
  };

  return (
    <header className="mobile-header">
      <div className="header-brand">
        <img src={logoImg} alt="SmartScan" className="header-logo" />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="header-title-text">SmartScan</span>
            <span className="header-subtitle-tag">Verify</span>
          </div>
        </div>
      </div>

      <div className="header-actions">
        {onToggleTorch && (
          <button
            type="button"
            className="header-btn"
            onClick={handleTorch}
            aria-label="Toggle flashlight"
            style={{
              backgroundColor: torchActive ? '#2563EB' : 'rgba(255, 255, 255, 0.12)',
              borderColor: torchActive ? '#60A5FA' : 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <Flashlight size={18} />
          </button>
        )}
        <button
          type="button"
          className="header-btn"
          onClick={handleInfo}
          aria-label="App info"
        >
          <Info size={18} />
        </button>
      </div>
    </header>
  );
}
