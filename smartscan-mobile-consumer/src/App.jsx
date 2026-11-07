import React, { useCallback, useRef, useState } from 'react';
import BottomNav from './components/BottomNav';
import ScannerTab from './components/ScannerTab';
import PassportView from './components/PassportView';
import ReportTab from './components/ReportTab';
import MoreTab from './components/MoreTab';
import { parseQrPayload, fetchProductWithFallback } from './api/verify';
import { saveScanToHistory } from './utils/storage';
import { vibrateSuccess, vibrateWarning } from './utils/haptics';
import { productStatus } from './utils/product';

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const [currentProduct, setCurrentProduct] = useState(null);
  const [reportProduct, setReportProduct] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const pending = useRef(false);
  const scanAttempt = useRef(null);
  const navigationVersion = useRef(0);

  const handleScanSuccess = useCallback(async rawCode => {
    if (pending.current) return;
    pending.current = true;
    const version = navigationVersion.current;
    setVerificationError('');
    setVerifying(true);
    try {
      const { serialNumber } = parseQrPayload(rawCode);
      if (scanAttempt.current?.serialNumber !== serialNumber) scanAttempt.current = { serialNumber, eventId: crypto.randomUUID() };
      const result = await fetchProductWithFallback(serialNumber, { eventId: scanAttempt.current.eventId });
      scanAttempt.current = null;
      const scanned = { ...result, scannedAt: new Date().toISOString() };
      saveScanToHistory(scanned);
      if (version === navigationVersion.current) {
        setCurrentProduct(scanned);
        setActiveTab('passport');
        if (productStatus(scanned).tone === 'authentic') vibrateSuccess();
        else vibrateWarning();
      }
    } catch (error) {
      if (version === navigationVersion.current) setVerificationError(error.message?.startsWith('The scanned') || error.message?.startsWith('Please scan') ? error.message : 'We couldn’t verify this product. Check your connection and try again.');
    } finally {
      setVerifying(false);
      pending.current = false;
    }
  }, []);

  function navigate(tab) {
    navigationVersion.current += 1;
    setActiveTab(tab);
    if (tab === 'report') setReportProduct(null);
  }
  function report(product) { setReportProduct(product); setActiveTab('report'); }
  return <div className="device-frame">
    <main className="app-content">
      <div className="screen-transition" key={activeTab}>
      {activeTab === 'scan' && <ScannerTab onScanSuccess={handleScanSuccess} verifying={verifying} verificationError={verificationError} />}
      {(activeTab === 'passport' || activeTab === 'history') && <PassportView key={activeTab} product={activeTab === 'passport' ? currentProduct : null} title={activeTab === 'passport' ? 'Your product' : 'History'} onScanAgain={() => navigate('scan')} onBack={() => navigate('scan')} onReportProduct={report} />}
      {activeTab === 'report' && <ReportTab initialProduct={reportProduct} onOpenScanner={() => navigate('scan')} />}
      {activeTab === 'more' && <MoreTab />}
      </div>
    </main>
    <BottomNav activeTab={activeTab === 'passport' ? 'scan' : activeTab} onSelectTab={navigate} />
  </div>;
}
