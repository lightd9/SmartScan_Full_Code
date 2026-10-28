import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import QrScanner from '../QrScanner';
import useAuth from '../../hooks/useAuth';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_RPC_URL, assertConfiguredChain } from '../../config/contract';
import api from '../../api/axios';
import { submitScanEvent } from '../../api/scanEvents';
import { parseProductQr } from '../../api/productQr';
import './scannerModal.css';

export default function ScannerModal({ open, onClose, initialCode = '' }) {
  const [activeTab, setActiveTab] = useState(0); // 0: Camera, 1: Manual
  const [manualInput, setManualInput] = useState('');
  const [shareLocation, setShareLocation] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyingStatus, setVerifyingStatus] = useState('');
  const [scanError, setScanError] = useState('');
  const [lastScanned, setLastScanned] = useState('');

  const { auth } = useAuth();
  const navigate = useNavigate();

  // Reset state when opening or closing
  useEffect(() => {
    if (open) {
      setScanError('');
      setVerifying(false);
      setVerifyingStatus('');
      setLastScanned('');
      if (initialCode) {
        setManualInput(initialCode);
        setActiveTab(1);
      } else {
        setManualInput('');
        setActiveTab(0);
      }
    }
  }, [open, initialCode]);

  const recordScanTelemetry = useCallback(async (serialNumber, contractAddress) => {
    const payload = { serialNumber: serialNumber || 'invalid', contractAddress: contractAddress || '' };
    if (shareLocation && navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 60000, timeout: 5000 })
        );
        payload.latitude = position.coords.latitude;
        payload.longitude = position.coords.longitude;
      } catch (_error) {
        // Location telemetry is optional
      }
    }
    return submitScanEvent(api, payload);
  }, [shareLocation]);

  const processProductCode = useCallback(async (rawInput) => {
    const trimmed = (rawInput || '').trim();
    if (!trimmed || verifying) return;

    setVerifying(true);
    setScanError('');
    setVerifyingStatus('Reading barcode data...');

    let formattedQr = trimmed;
    // If the input is just an SS-UUID, prefix with the configured contract address
    if (/^SS-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      formattedQr = `${CONTRACT_ADDRESS},${trimmed}`;
    }

    let parsedContract;
    let parsedSerial;
    try {
      const parsed = parseProductQr(formattedQr, CONTRACT_ADDRESS);
      parsedContract = parsed.contractAddress;
      parsedSerial = parsed.serialNumber;
    } catch (parseErr) {
      setVerifying(false);
      const candidateContract = typeof formattedQr === 'string' ? (formattedQr.split(',')[0] || '').trim() : '';
      recordScanTelemetry('invalid', ethers.isAddress(candidateContract) ? candidateContract : '').catch(() => {});
      const warning = parseErr.message || 'This is not a valid SmartScan barcode or QR code.';
      if (warning.includes('unrecognized contract') || warning.includes('invalid product identifier')) {
        onClose();
        navigate('/fake-product', { state: { warning } });
      } else {
        setScanError(warning);
      }
      return;
    }

    try {
      setVerifyingStatus('Connecting to Ethereum Sepolia blockchain...');
      const provider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
      await assertConfiguredChain(provider);

      setVerifyingStatus(`Querying contract ${parsedContract.slice(0, 6)}...${parsedContract.slice(-4)}`);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const exists = await contract.productExists(parsedSerial);
      if (!exists) {
        const warnings = await recordScanTelemetry(parsedSerial, parsedContract);
        setVerifying(false);
        onClose();
        navigate('/fake-product', {
          state: {
            warning: 'This product identifier is not registered on the configured blockchain.',
            warnings,
          },
        });
        return;
      }

      setVerifyingStatus('Verifying cryptographic custody & lifecycle history...');
      const product = await contract.getProduct(parsedSerial);
      const onChainSerial = product[0];
      const state = {
        stage: product[6],
        currentCustodian: product[7],
        pendingRecipient: product[8],
        sold: product[9],
        recalled: product[10],
      };

      if (!onChainSerial || onChainSerial !== parsedSerial) {
        recordScanTelemetry(parsedSerial, parsedContract).catch(() => {});
        setVerifying(false);
        onClose();
        navigate('/fake-product');
        return;
      }

      const warnings = await recordScanTelemetry(parsedSerial, parsedContract);

      if (Number(state.stage) === 5 || state.recalled) {
        setVerifying(false);
        onClose();
        navigate('/fake-product', {
          state: {
            warning: 'This product has been recalled. Do not purchase or use it.',
            warnings,
            recalled: true,
          },
        });
        return;
      }

      // Authentic product verified!
      setVerifying(false);
      onClose();

      if (['admin', 'manufacturer', 'supplier', 'retailer'].includes(auth?.role)) {
        navigate('/update-product', { state: { qrData: formattedQr, warnings } });
      } else {
        navigate('/authentic-product', { state: { qrData: formattedQr, warnings } });
      }
    } catch (err) {
      console.error('Scan verification error:', err);
      setVerifying(false);
      setScanError('Unable to reach Ethereum Sepolia. Please verify your connection and try again.');
    }
  }, [verifying, recordScanTelemetry, onClose, navigate, auth?.role]);

  const handleCameraScan = (data) => {
    if (!data || data === lastScanned || verifying) return;
    setLastScanned(data);
    processProductCode(data);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) {
      setScanError('Please enter a product serial number or full QR code.');
      return;
    }
    processProductCode(manualInput.trim());
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setManualInput(text.trim());
        setScanError('');
      }
    } catch (_clipError) {
      setScanError('Clipboard permission not granted. Please paste manually.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={verifying ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: 'scanner-dialog-paper',
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
          },
        },
      }}
    >
      {/* Header */}
      <div className="scanner-modal-header">
        <div className="scanner-header-title-wrap">
          <div className="scanner-icon-badge" aria-hidden="true">
            <QrCodeScannerRoundedIcon sx={{ fontSize: 22 }} />
          </div>
          <div className="scanner-title-text">
            <h3>Verify Product Barcode</h3>
            <p>Direct smart contract verification on Sepolia</p>
          </div>
        </div>
        <IconButton
          className="scanner-close-btn"
          onClick={onClose}
          disabled={verifying}
          aria-label="Close scanner popup"
          size="small"
        >
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </div>

      <DialogContent sx={{ p: 0 }}>
        {/* Mode Selector Tabs */}
        <div className="scanner-mode-tabs" role="tablist">
          <button
            type="button"
            className={`scanner-tab-btn ${activeTab === 0 ? 'active' : ''}`}
            onClick={() => { setActiveTab(0); setScanError(''); }}
            disabled={verifying}
            role="tab"
            aria-selected={activeTab === 0}
          >
            <CameraAltRoundedIcon sx={{ fontSize: 18 }} />
            <span>Live Camera</span>
          </button>
          <button
            type="button"
            className={`scanner-tab-btn ${activeTab === 1 ? 'active' : ''}`}
            onClick={() => { setActiveTab(1); setScanError(''); }}
            disabled={verifying}
            role="tab"
            aria-selected={activeTab === 1}
          >
            <KeyboardRoundedIcon sx={{ fontSize: 18 }} />
            <span>Manual Entry</span>
          </button>
        </div>

        {/* Viewport: Live Camera Tab */}
        {activeTab === 0 && (
          <div className="scanner-viewport-wrap">
            {open && !verifying && (
              <div className="scanner-camera-container">
                <QrScanner passData={handleCameraScan} />
              </div>
            )}

            {/* Optical HUD Target Overlay */}
            <div className="scanner-hud-overlay">
              <div className="scanner-hud-frame">
                <span className="scanner-corner top-left"></span>
                <span className="scanner-corner top-right"></span>
                <span className="scanner-corner bottom-left"></span>
                <span className="scanner-corner bottom-right"></span>
                {!verifying && <div className="scanner-laser-beam"></div>}
              </div>
              <span className="scanner-hud-hint">
                Align QR / Barcode inside the frame
              </span>
            </div>

            {/* Verifying Loader Overlay */}
            {verifying && (
              <div className="scanner-verifying-overlay" role="status" aria-live="polite">
                <CircularProgress size={44} sx={{ color: '#38BDF8' }} thickness={4} />
                <span className="scanner-verifying-text">{verifyingStatus}</span>
                <span className="scanner-verifying-subtext">Verifying anti-counterfeit cryptographic proof</span>
              </div>
            )}
          </div>
        )}

        {/* Viewport: Manual Input Tab */}
        {activeTab === 1 && (
          <div className="scanner-manual-wrap">
            <Box component="form" onSubmit={handleManualSubmit}>
              <Typography variant="body2" sx={{ color: '#4B5563', mb: 1, fontWeight: 600 }}>
                Enter Serial Number or Full QR Data:
              </Typography>
              <TextField
                fullWidth
                size="medium"
                placeholder="e.g. SS-b49bfa81-2287-43f1-b844-3c66f7f3e827"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                disabled={verifying}
                autoFocus
                InputProps={{
                  sx: {
                    borderRadius: '12px',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  },
                  endAdornment: (
                    <IconButton
                      onClick={handlePasteClipboard}
                      size="small"
                      title="Paste from clipboard"
                      sx={{ color: '#6B7280' }}
                    >
                      <ContentPasteRoundedIcon fontSize="small" />
                    </IconButton>
                  ),
                }}
              />
              <Typography variant="caption" sx={{ color: '#9CA3AF', display: 'block', mt: 0.8 }}>
                Accepts canonical format <code>SS-UUID</code> or full QR data <code>0xContract,SS-UUID</code>
              </Typography>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={verifying || !manualInput.trim()}
                sx={{
                  mt: 2,
                  py: 1.2,
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-primary, #2F66EE)',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: 'var(--color-primary-hover, #2554CA)',
                    boxShadow: '0 4px 12px rgba(47, 102, 238, 0.3)',
                  },
                }}
              >
                {verifying ? <CircularProgress size={22} sx={{ color: '#FFFFFF' }} /> : 'Verify On-Chain'}
              </Button>
            </Box>
          </div>
        )}

        {/* Error Banner */}
        {scanError && (
          <Box sx={{ px: 3, pb: 1.5 }}>
            <Alert severity="error" sx={{ borderRadius: '12px' }}>
              {scanError}
            </Alert>
          </Box>
        )}

        {/* Telemetry & Options Footer */}
        <div className="scanner-footer-options">
          <div className="scanner-location-toggle">
            <FormControlLabel
              control={
                <Checkbox
                  checked={shareLocation}
                  onChange={(e) => setShareLocation(e.target.checked)}
                  disabled={verifying}
                  size="small"
                  sx={{
                    color: 'var(--color-primary, #2F66EE)',
                    '&.Mui-checked': { color: 'var(--color-primary, #2F66EE)' },
                    p: 0.5,
                  }}
                />
              }
              label={
                <Typography variant="caption" sx={{ color: '#4B5563', lineHeight: 1.3, display: 'block' }}>
                  <strong>Attach telemetry location:</strong> Supplies browser coordinates to detect suspicious duplicate scans across regions.
                </Typography>
              }
              sx={{ m: 0, alignItems: 'flex-start' }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
