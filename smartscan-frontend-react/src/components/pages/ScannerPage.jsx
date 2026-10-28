import { Box, Paper, Typography, Button, Checkbox, FormControlLabel, CircularProgress, Alert, TextField, IconButton } from '@mui/material';
import QrScanner from '../QrScanner';
import { useCallback, useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_RPC_URL, assertConfiguredChain } from '../../config/contract';
import api from '../../api/axios';
import { submitScanEvent } from '../../api/scanEvents';
import { parseProductQr } from '../../api/productQr';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import '../scanner/scannerModal.css';

const ScannerPage = () => {
    const [activeTab, setActiveTab] = useState(0); // 0: Camera, 1: Manual
    const [manualInput, setManualInput] = useState('');
    const [status, setStatus] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [shareLocation, setShareLocation] = useState(false);
    const [lastScanned, setLastScanned] = useState('');

    const { auth } = useAuth();
    const navigate = useNavigate();

    const recordScan = useCallback(async (serialNumber, contractAddress) => {
        const payload = { serialNumber: serialNumber || 'invalid', contractAddress: contractAddress || '' };
        if (shareLocation && navigator.geolocation) {
            try {
                const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 60000, timeout: 5000 }));
                payload.latitude = position.coords.latitude;
                payload.longitude = position.coords.longitude;
            } catch (_error) {
                // Location is optional
            }
        }
        return submitScanEvent(api, payload);
    }, [shareLocation]);

    const verifyProductCode = useCallback(async (rawCode) => {
        const trimmed = (rawCode || '').trim();
        if (!trimmed || verifying) return;

        setVerifying(true);
        setStatus('Verifying product on Ethereum Sepolia...');

        let formattedQr = trimmed;
        if (/^SS-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
            formattedQr = `${CONTRACT_ADDRESS},${trimmed}`;
        }

        let contractAddress;
        let serialNumber;
        try {
            ({ contractAddress, serialNumber } = parseProductQr(formattedQr, CONTRACT_ADDRESS));
        } catch (error) {
            setVerifying(false);
            const candidateContract = typeof formattedQr === 'string' ? (formattedQr.split(',')[0] || '').trim() : '';
            recordScan('invalid', ethers.isAddress(candidateContract) ? candidateContract : '').catch(() => {});
            const warning = error.message || 'This QR code is not a valid SmartScan code.';
            if (warning.includes('unrecognized contract') || warning.includes('invalid product identifier')) {
                navigate('/fake-product', { state: { warning } });
            } else {
                setStatus(warning);
            }
            return;
        }

        try {
            const provider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
            await assertConfiguredChain(provider);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            if (!(await contract.productExists(serialNumber))) {
                const warnings = await recordScan(serialNumber, contractAddress);
                setVerifying(false);
                navigate('/fake-product', { state: { warning: 'This product identifier is not registered on the configured blockchain.', warnings } });
                return;
            }
            const product = await contract.getProduct(serialNumber);
            const onChainSerial = product[0];
            const state = {
                stage: product[6],
                currentCustodian: product[7],
                pendingRecipient: product[8],
                sold: product[9],
                recalled: product[10],
            };

            if (!onChainSerial || onChainSerial !== serialNumber) {
                recordScan(serialNumber, contractAddress).catch(() => {});
                setVerifying(false);
                navigate('/fake-product');
                return;
            }
            const warnings = await recordScan(serialNumber, contractAddress);

            if (Number(state.stage) === 5 || state.recalled) {
                setVerifying(false);
                navigate('/fake-product', { state: { warning: 'This product has been recalled. Do not purchase or use it.', warnings, recalled: true } });
                return;
            }

            setVerifying(false);
            if (['admin', 'manufacturer', 'supplier', 'retailer'].includes(auth?.role)) {
                navigate('/update-product', { state: { qrData: formattedQr, warnings } });
            } else {
                navigate('/authentic-product', { state: { qrData: formattedQr, warnings } });
            }
        } catch (_err) {
            setVerifying(false);
            setStatus('Unable to reach the blockchain. Please check your connection and try again.');
        }
    }, [verifying, recordScan, navigate, auth?.role]);

    const handleCameraScan = (data) => {
        if (!data || data === lastScanned || verifying) return;
        setLastScanned(data);
        verifyProductCode(data);
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!manualInput.trim()) {
            setStatus('Please enter a product serial number or full QR code.');
            return;
        }
        verifyProductCode(manualInput.trim());
    };

    const handlePasteClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setManualInput(text.trim());
                setStatus('');
            }
        } catch (_err) {
            setStatus('Unable to read clipboard. Please paste manually.');
        }
    };

    const handleBack = () => {
        if (auth?.role) {
            navigate(`/${auth.role}`);
        } else {
            navigate('/');
        }
    };

    return (
        <Box sx={{
            minHeight: "100vh",
            backgroundColor: "#F8F9FB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
            fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    maxWidth: 500,
                    backgroundColor: '#FFFFFF',
                    borderRadius: '24px',
                    border: '1px solid #ECEEF2',
                    boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.12)',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '24px 28px 16px',
                    borderBottom: '1px solid #ECEEF2'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '12px',
                            backgroundColor: '#EBF1FE',
                            color: '#2F66EE',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <QrCodeScannerRoundedIcon sx={{ fontSize: 24 }} />
                        </Box>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#111827', fontSize: '1.2rem', lineHeight: 1.2 }}>
                                Verify Product Barcode
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 500 }}>
                                Cryptographic on-chain provenance on Sepolia
                            </Typography>
                        </Box>
                    </Box>
                    <Button
                        onClick={handleBack}
                        startIcon={<ArrowBackRoundedIcon />}
                        size="small"
                        sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            color: '#6B7280',
                            borderRadius: '10px',
                            '&:hover': { backgroundColor: '#F3F4F6', color: '#111827' }
                        }}
                    >
                        Back
                    </Button>
                </Box>

                {/* Mode Selector Tabs */}
                <div className="scanner-mode-tabs" style={{ margin: '18px 24px 14px' }}>
                    <button
                        type="button"
                        className={`scanner-tab-btn ${activeTab === 0 ? 'active' : ''}`}
                        onClick={() => { setActiveTab(0); setStatus(''); }}
                        disabled={verifying}
                    >
                        <CameraAltRoundedIcon sx={{ fontSize: 18 }} />
                        <span>Live Camera</span>
                    </button>
                    <button
                        type="button"
                        className={`scanner-tab-btn ${activeTab === 1 ? 'active' : ''}`}
                        onClick={() => { setActiveTab(1); setStatus(''); }}
                        disabled={verifying}
                    >
                        <KeyboardRoundedIcon sx={{ fontSize: 18 }} />
                        <span>Manual Entry</span>
                    </button>
                </div>

                {/* Live Camera Viewfinder */}
                {activeTab === 0 && (
                    <div className="scanner-viewport-wrap" style={{ margin: '0 24px 16px' }}>
                        {!verifying && (
                            <div className="scanner-camera-container">
                                <QrScanner passData={handleCameraScan} />
                            </div>
                        )}

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

                        {verifying && (
                            <div className="scanner-verifying-overlay">
                                <CircularProgress size={44} sx={{ color: '#38BDF8' }} thickness={4} />
                                <span className="scanner-verifying-text">Verifying with Ethereum Sepolia...</span>
                                <span className="scanner-verifying-subtext">Validating anti-counterfeit cryptographic proof</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Manual Input Tab */}
                {activeTab === 1 && (
                    <Box component="form" onSubmit={handleManualSubmit} sx={{ padding: '8px 24px 20px' }}>
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
                                sx: { borderRadius: '12px', fontFamily: 'monospace', fontSize: '0.85rem' },
                                endAdornment: (
                                    <IconButton onClick={handlePasteClipboard} size="small" title="Paste from clipboard">
                                        <ContentPasteRoundedIcon fontSize="small" />
                                    </IconButton>
                                )
                            }}
                        />
                        <Typography variant="caption" sx={{ color: '#9CA3AF', display: 'block', mt: 0.8 }}>
                            Accepts canonical <code>SS-UUID</code> or full QR string <code>0xContract,SS-UUID</code>
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
                                backgroundColor: '#2F66EE',
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                '&:hover': { backgroundColor: '#2554CA' }
                            }}
                        >
                            {verifying ? <CircularProgress size={22} sx={{ color: '#FFFFFF' }} /> : 'Verify On-Chain'}
                        </Button>
                    </Box>
                )}

                {status && (
                    <Box sx={{ px: 3, pb: 1.5 }}>
                        <Alert severity="error" sx={{ borderRadius: '12px' }}>
                            {status}
                        </Alert>
                    </Box>
                )}

                {/* Telemetry Toggle */}
                <Box sx={{ px: 3, pb: 2.5 }}>
                    <div className="scanner-location-toggle">
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={shareLocation}
                                    onChange={(event) => setShareLocation(event.target.checked)}
                                    size="small"
                                    sx={{ color: '#2F66EE', '&.Mui-checked': { color: '#2F66EE' }, p: 0.5 }}
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
                </Box>
            </Paper>
        </Box>
    );
};

export default ScannerPage;
