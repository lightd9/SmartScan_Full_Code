import React, { createContext, useContext, useState, useCallback } from 'react';
import ScannerModal from '../components/scanner/ScannerModal';

const ScannerContext = createContext({
  isScannerOpen: false,
  openScanner: () => {},
  closeScanner: () => {},
});

export function ScannerProvider({ children }) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [initialCode, setInitialCode] = useState('');

  const openScanner = useCallback((prefillCode = '') => {
    setInitialCode(typeof prefillCode === 'string' ? prefillCode : '');
    setIsScannerOpen(true);
  }, []);

  const closeScanner = useCallback(() => {
    setIsScannerOpen(false);
    setInitialCode('');
  }, []);

  return (
    <ScannerContext.Provider value={{ isScannerOpen, openScanner, closeScanner }}>
      {children}
      <ScannerModal
        open={isScannerOpen}
        onClose={closeScanner}
        initialCode={initialCode}
      />
    </ScannerContext.Provider>
  );
}

export function useScanner() {
  const context = useContext(ScannerContext);
  if (!context) {
    throw new Error('useScanner must be used within a ScannerProvider');
  }
  return context;
}

export default ScannerContext;
