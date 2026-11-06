import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, SwitchCamera, KeyRound, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { vibrateClick, vibrateSuccess, vibrateWarning } from '../utils/haptics';

export default function ScannerTab({ onScanSuccess, verifying, verificationError }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' = back, 'user' = front
  
  const scannerRef = useRef(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      try {
        setCameraError(null);
        const html5QrCode = new Html5Qrcode('reader', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode },
          config,
          (decodedText) => {
            if (!isScanningRef.current && mounted) {
              isScanningRef.current = true;
              vibrateSuccess();
              onScanSuccess(decodedText);
              // Pause scanning momentarily
              setTimeout(() => {
                isScanningRef.current = false;
              }, 2000);
            }
          },
          (_errorMessage) => {
            // Scanning frame failed, normal continuous scan loop
          }
        );

        if (mounted) setCameraActive(true);
      } catch (err) {
        console.warn('Camera start error:', err);
        if (mounted) {
          setCameraError(
            err.name === 'NotAllowedError'
              ? 'Camera permission was denied. Please allow camera access in your device settings or use manual serial code entry below.'
              : 'Could not initialize camera. You can enter or paste the product serial number below.'
          );
          setCameraActive(false);
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((e) => console.warn('Scanner stop error:', e));
      }
    };
  }, [facingMode]);

  const handleFlipCamera = () => {
    vibrateClick();
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => {
        setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
      }).catch((e) => console.warn('Flip error:', e));
    } else {
      setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    vibrateClick();
    onScanSuccess(manualCode.trim());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Viewfinder Container */}
      <div className="scanner-viewport">
        <div id="reader" style={{ width: '100%', height: '100%' }}></div>

        {/* Reticle Overlay */}
        <div className="scanner-overlay-reticle">
          <div className="scanner-corner corner-tl"></div>
          <div className="scanner-corner corner-tr"></div>
          <div className="scanner-corner corner-bl"></div>
          <div className="scanner-corner corner-br"></div>
          <div className="scanner-laser"></div>
        </div>

        {/* Loading Overlay */}
        {verifying && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(11, 19, 43, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              zIndex: 30,
              backdropFilter: 'blur(4px)',
            }}
          >
            <Loader2 className="animate-spin" size={36} color="#3B82F6" style={{ animation: 'spin 1s linear infinite' }} />
            <strong style={{ color: '#FFFFFF', fontSize: 15 }}>
              Verifying Ledger Authenticity…
            </strong>
            <span style={{ color: '#93C5FD', fontSize: 12 }}>
              Auditing Ethereum Sepolia Blockchain
            </span>
          </div>
        )}
      </div>

      {/* Camera Controls Bar */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          className="btn-m-secondary"
          onClick={handleFlipCamera}
          style={{ flex: 1 }}
        >
          <SwitchCamera size={18} />
          <span>Flip Camera</span>
        </button>

        <button
          type="button"
          className="btn-m-secondary"
          onClick={() => {
            vibrateClick();
            setShowManualInput(!showManualInput);
          }}
          style={{ flex: 1 }}
        >
          <KeyRound size={18} />
          <span>{showManualInput ? 'Hide Manual Entry' : 'Manual Serial'}</span>
        </button>
      </div>

      {/* Camera Error Alert */}
      {cameraError && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 14,
            backgroundColor: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-border)',
            color: 'var(--color-warning-dark)',
            fontSize: 13,
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Verification Error Notice */}
      {verificationError && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 14,
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: 'var(--color-danger-dark)',
            fontSize: 13,
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{verificationError}</span>
        </div>
      )}

      {/* Manual Input Form */}
      {showManualInput && (
        <form onSubmit={handleManualSubmit} className="m-card">
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Enter Packaging Serial Number
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="e.g. SS-37010C83-997C-4C67-8547-09419BE82245"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
                fontFamily: 'monospace',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              className="btn-m-primary"
              style={{ width: 'auto', padding: '0 18px', minHeight: 44 }}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      )}

      {/* Consumer Quick Guide */}
      <div className="m-card" style={{ padding: '16px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 8 }}>
          How to Verify Authentic Products
        </h3>
        <ol style={{ paddingLeft: 18, margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          <li>Locate the official <strong>SmartScan QR code</strong> on product packaging or receipt.</li>
          <li>Align the code within the viewfinder corners above.</li>
          <li>Review the certified blockchain origin and brand warranty passport instantly.</li>
        </ol>
      </div>
    </div>
  );
}
