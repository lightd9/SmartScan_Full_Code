import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

const QrScanner = ({ passData }) => {
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const hasScannedRef = useRef(false);

  useEffect(() => {
    let controls = null;
    let mounted = true;
    const codeReader = new BrowserMultiFormatReader();

    async function startScanner() {
      if (!navigator?.mediaDevices?.getUserMedia) {
        if (mounted) setCameraError('Camera access is not supported by this browser.');
        return;
      }

      try {
        const constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        controls = await codeReader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result, _error) => {
            if (!mounted) return;
            if (result && !hasScannedRef.current) {
              const text = result.getText ? result.getText() : String(result);
              if (text) {
                hasScannedRef.current = true;
                passData(text);
              }
            }
          }
        );
      } catch (err) {
        if (!mounted) return;
        const msg = err?.message || String(err);
        if (err?.name === 'NotAllowedError' || msg.includes('Permission')) {
          setCameraError('Camera permission was denied. Please allow camera access in browser settings.');
        } else if (err?.name === 'NotFoundError' || msg.includes('DevicesNotFoundError')) {
          setCameraError('No video camera was found on this device.');
        } else if (err?.name === 'NotReadableError') {
          setCameraError('Camera is already in use by another application.');
        } else {
          setCameraError('Unable to start optical camera. Enter serial manually below.');
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (controls && typeof controls.stop === 'function') {
        controls.stop();
      }
    };
  }, [passData]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '260px', overflow: 'hidden', background: '#000000', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {cameraError ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#FCA5A5', fontSize: '13px', lineHeight: 1.5 }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📷</div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Camera Inaccessible</div>
          <div>{cameraError}</div>
        </div>
      ) : (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </div>
  );
};

export default QrScanner;
