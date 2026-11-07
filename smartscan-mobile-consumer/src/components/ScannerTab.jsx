import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ArrowRight, Camera, Image, Keyboard, Loader2, ScanLine, ShieldCheck, SwitchCamera, Zap } from 'lucide-react';
import Sheet from './Sheet';

function cameraErrorMessage(error) {
  // html5-qrcode wraps some DOMExceptions in strings, so handle both forms.
  const details = `${error?.name || ''} ${error?.message || error || ''}`;
  if (/NotAllowedError|PermissionDeniedError|SecurityError/i.test(details)) {
    return 'Camera access was blocked. Allow Camera for this website in Safari, then tap Try camera.';
  }
  if (/NotFoundError|DevicesNotFoundError/i.test(details)) return 'No camera was found. Upload a photo or enter the serial instead.';
  if (/NotReadableError|TrackStartError|AbortError/i.test(details)) return 'The camera could not start. Close other apps using it, then tap Try camera.';
  if (/OverconstrainedError|ConstraintNotSatisfiedError/i.test(details)) return 'This camera is unavailable. Try Flip camera, upload a photo, or enter the serial.';
  return 'The camera could not open. Tap Try camera, upload a photo, or enter the serial.';
}

export default function ScannerTab({ onScanSuccess, verifying, verificationError }) {
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [cameraState, setCameraState] = useState('idle');
  const [facingMode, setFacingMode] = useState('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [notice, setNotice] = useState('');
  const [readingPhoto, setReadingPhoto] = useState(false);
  const scannerRef = useRef(null);
  const cameraQueue = useRef(Promise.resolve());
  const fileInput = useRef(null);
  const callback = useRef(onScanSuccess);
  const busy = useRef(false);
  const hintCopy = useRef(null);
  const hintWasScanning = useRef(false);
  const loading = verifying || readingPhoto;
  const scanning = cameraState === 'ready' && !loading && !manualOpen;
  callback.current = onScanSuccess;
  busy.current = verifying || readingPhoto || manualOpen;

  useLayoutEffect(() => {
    if (hintWasScanning.current === scanning) return;
    hintWasScanning.current = scanning;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Keep the moving badge from crossing visible lettering in either direction.
    // The instruction remains available to assistive technology throughout.
    const animation = hintCopy.current?.animate([
      { opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 },
    ], { duration: 500, easing: 'ease-out' });
    return () => animation?.cancel();
  }, [scanning]);

  useEffect(() => {
    if (!cameraEnabled) return;
    let disposed = false;
    let scanner;
    // Finish closing each camera stream before starting the next one.
    const start = cameraQueue.current.catch(() => {}).then(async () => {
      if (disposed) return;
      setCameraState('starting');
      setNotice('');
      setTorchOn(false);
      setTorchSupported(false);
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCameraState('error');
        setNotice(!window.isSecureContext
          ? 'Camera access needs a secure connection. Open the HTTPS test address, or upload a photo or enter the serial.'
          : 'Live camera access is unavailable in this browser. Open in Safari, upload a photo, or enter the serial.');
        return;
      }
      try {
        scanner = new Html5Qrcode('camera-reader', { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
        scannerRef.current = scanner;
        await scanner.start({ facingMode }, { fps: 10, disableFlip: false }, async code => {
          if (disposed || busy.current) return;
          busy.current = true;
          scanner.pause(true);
          try { await callback.current(code); }
          finally {
            if (!disposed && scanner.isScanning) scanner.resume();
            busy.current = false;
          }
        }, () => {});
        if (disposed) return;
        setCameraState('ready');
        // Optional capabilities can be missing or throw in Safari. A working
        // video stream must remain usable when flashlight detection fails.
        try { setTorchSupported(Boolean(scanner.getRunningTrackCapabilities()?.torch)); }
        catch { setTorchSupported(false); }
        setNotice('');
      } catch (error) {
        if (!disposed) {
          setCameraState('error');
          setNotice(cameraErrorMessage(error));
        }
      }
    });
    cameraQueue.current = start;
    return () => {
      disposed = true;
      cameraQueue.current = start.catch(() => {}).then(async () => {
        // start() can resolve before the first video frame sets isScanning.
        // The state machine already owns a stream at that point, so close it too.
        if (scanner && [Html5QrcodeScannerState.SCANNING, Html5QrcodeScannerState.PAUSED].includes(scanner.getState())) {
          await scanner.stop().catch(() => {});
        }
        try { scanner?.clear(); } catch { /* The stream is closed even if its detached view cannot be cleared. */ }
        if (scannerRef.current === scanner) scannerRef.current = null;
      });
    };
  }, [cameraEnabled, cameraAttempt, facingMode]);

  function enableCamera() {
    setCameraState('starting');
    setCameraEnabled(true);
    setCameraAttempt(attempt => attempt + 1);
  }

  async function toggleTorch() {
    if (!torchSupported) { setNotice('Flashlight is available with a supported rear camera.'); return; }
    try {
      await scannerRef.current.applyVideoConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch { setNotice('This camera could not turn on its flashlight.'); }
  }

  async function readPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReadingPhoto(true);
    setNotice('');
    const scanner = new Html5Qrcode('photo-reader', { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
    try { await callback.current(await scanner.scanFile(file, false)); }
    catch { setNotice('No QR code found in that photo. Try a clearer image or enter the serial manually.'); }
    finally { scanner.clear(); setReadingPhoto(false); event.target.value = ''; }
  }

  return <section className="scan-screen" aria-label="Scan a product">
    <input type="file" accept="image/*" ref={fileInput} hidden onChange={readPhoto} aria-label="Upload QR code photo" />
    <div id="photo-reader" hidden />
    <div className={`scanner-hero ${cameraState === 'ready' ? 'camera-live' : ''}`}>
      <div className="scanner-ambient" />
      <div id="camera-reader" />
      <div className="scanner-camera-shade" />
      <div className="scan-greeting"><p>A little scan. Total confidence.</p><h1>Scan your product</h1></div>
      <div className="scanner-target" aria-hidden="true"><div className="viewfinder"><i /><i /><i /><i /><ScanLine className="finder-icon" size={44} strokeWidth={1} /></div></div>
      <div className="scanner-bottom">
        <div className={`scanner-glass-hint ${scanning ? 'is-scanning' : ''}`}>
          <span className="scan-hint-track" aria-hidden="true"><span className="scan-hint-icon"><ScanLine size={22} /></span></span>
          <span className="scan-hint-copy" ref={hintCopy}>Place the QR code inside the frame</span>
          <ArrowRight className="scan-hint-arrow" size={16} aria-hidden="true" />
        </div>
        <div className="scanner-info-card">
          <div className="scanner-info-copy"><h2>Know what you’re buying.</h2><p><ShieldCheck size={15} />Trace its origin. Check it’s authentic.</p></div>
          <div className="scanner-info-footer"><span>SmartScan Verify</span><button className="dark-button" disabled={loading || cameraState === 'starting' || cameraState === 'ready'} onClick={enableCamera}>
            {cameraState === 'starting' ? <Loader2 className="spin" size={16} /> : <Camera size={16} />}
            {cameraState === 'ready' ? 'Camera ready' : cameraState === 'starting' ? 'Opening…' : cameraState === 'error' ? 'Try camera' : 'Enable camera'}
          </button></div>
        </div>
      </div>
      {loading && <div className="scanner-loading" role="status"><Loader2 className="spin" size={32} /><h2>{readingPhoto ? 'Reading your photo…' : 'Checking your product…'}</h2><p>This will only take a moment.</p></div>}
    </div>
    <div className="scanner-controls">
      <button className={`camera-control ${torchOn ? 'active' : ''}`} onClick={toggleTorch} disabled={loading || cameraState !== 'ready' || !torchSupported} aria-label="Flashlight" aria-pressed={torchOn}><span className="circle-button raised"><Zap size={22} /></span><span>Flashlight</span></button>
      <span className="camera-status">{cameraState === 'ready' ? 'Ready to scan' : 'Scan. Verify. Trust.'}</span>
      <button className="camera-control" disabled={loading || cameraState === 'starting'} onClick={() => { setFacingMode(mode => mode === 'environment' ? 'user' : 'environment'); enableCamera(); }} aria-label="Flip camera"><span className="circle-button raised"><SwitchCamera size={22} /></span><span>Flip camera</span></button>
    </div>
    {(verificationError || notice) && <p className="scan-notice" role="alert">{verificationError || notice}</p>}
    <section className="shortcuts"><h2>Shortcuts</h2><div className="shortcut-pills">
      <button disabled={loading} onClick={() => fileInput.current?.click()}><Image size={18} /><span>Upload from photos</span></button>
      <button disabled={loading} onClick={() => setManualOpen(true)}><Keyboard size={18} /><span>Enter serial manually</span></button>
    </div></section>
    {manualOpen && <Sheet title="Enter serial manually" onClose={() => setManualOpen(false)}><p className="supporting-copy">Find the serial number on your product’s label or packaging.</p><form className="sheet-form" onSubmit={event => { event.preventDefault(); if (manualCode.trim()) { setManualOpen(false); onScanSuccess(manualCode.trim()); } }}>
      <label htmlFor="serial-number">Serial number</label><input id="serial-number" data-autofocus value={manualCode} onChange={event => setManualCode(event.target.value)} placeholder="e.g. SS-…" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={150} required />
      <button className="dark-button" disabled={!manualCode.trim() || verifying}>Verify product<ArrowRight size={18} /></button>
    </form></Sheet>}
  </section>;
}
