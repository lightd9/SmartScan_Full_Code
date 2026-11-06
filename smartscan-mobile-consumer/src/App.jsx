import React, { useState, useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ScannerTab from './components/ScannerTab';
import PassportView from './components/PassportView';
import HistoryTab from './components/HistoryTab';
import ReportModal from './components/ReportModal';

import { parseQrPayload, fetchProductWithFallback } from './api/verify';
import { vibrateWarning, vibrateSuccess } from './utils/haptics';
import { saveScanToHistory } from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const [currentProduct, setCurrentProduct] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState(null);
  const [torchActive, setTorchActive] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    // Hide splash screen and set dark status bar for mobile
    async function initNative() {
      try {
        await SplashScreen.hide();
      } catch (_e) {
        // Ignored on browser
      }
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0B132B' });
      } catch (_e) {
        // Ignored on browser
      }
    }
    initNative();
  }, []);

  const handleScanSuccess = async (rawCode) => {
    setVerificationError(null);
    setVerifying(true);

    try {
      const { serialNumber } = parseQrPayload(rawCode);
      const result = await fetchProductWithFallback(serialNumber);

      if (result.exists) {
        vibrateSuccess();
        saveScanToHistory(result);
      } else {
        vibrateWarning();
      }

      setCurrentProduct(result);
      setActiveTab('passport');
    } catch (err) {
      console.error('Verification failed:', err);
      vibrateWarning();
      setVerificationError(
        err.message || 'Unable to verify this product record. Please check code or try again.'
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleSelectHistoryItem = (product) => {
    setCurrentProduct(product);
    setActiveTab('passport');
  };

  const handleReportProduct = (product) => {
    setCurrentProduct(product);
    setActiveTab('report');
  };

  return (
    <div className="app-shell">
      <Header
        torchActive={torchActive}
        onToggleTorch={() => setTorchActive(!torchActive)}
        onShowInfo={() => setShowInfo(!showInfo)}
      />

      <main className="mobile-content">
        {showInfo && (
          <div className="m-card" style={{ marginBottom: 16, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1E40AF', marginBottom: 4 }}>
              About SmartScan Verify
            </h3>
            <p style={{ fontSize: 12.5, color: '#1E3A8A', lineHeight: 1.5, margin: 0 }}>
              SmartScan Verify connects directly to the Ethereum Sepolia blockchain network to audit anti-counterfeit merchandise passports in real-time. No login or crypto wallet required.
            </p>
          </div>
        )}

        {activeTab === 'scan' && (
          <ScannerTab
            onScanSuccess={handleScanSuccess}
            verifying={verifying}
            verificationError={verificationError}
          />
        )}

        {activeTab === 'passport' && (
          <PassportView
            product={currentProduct}
            onScanAgain={() => setActiveTab('scan')}
            onReportProduct={handleReportProduct}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            onSelectProduct={handleSelectHistoryItem}
            onOpenScanner={() => setActiveTab('scan')}
          />
        )}

        {activeTab === 'report' && (
          <ReportModal
            initialProduct={currentProduct}
            onClose={() => setActiveTab('passport')}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasScannedItem={Boolean(currentProduct)}
      />
    </div>
  );
}
