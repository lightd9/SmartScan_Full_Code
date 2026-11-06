import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    CircularProgress,
    Alert,
    IconButton,
    Chip,
    InputAdornment,
    Switch,
    FormControlLabel,
} from '@mui/material';
import PointOfSaleRoundedIcon from '@mui/icons-material/PointOfSaleRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import ShoppingBagRoundedIcon from '@mui/icons-material/ShoppingBagRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';

import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import dayjs from 'dayjs';

import DashboardShell from '../shell/DashboardShell';
import useAuth from '../../hooks/useAuth';
import QrScanner from '../QrScanner';
import POSCustomerReceiptModal from './POSCustomerReceiptModal';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_RPC_URL, CHAIN_ID, CHAIN_NAME, ensureConfiguredNetwork } from '../../config/contract';
import api from '../../api/axios';
import { parseProductQr } from '../../api/productQr';
import { autoDetectLocation } from '../../utils/locationResolver';

const STAGE_LABELS = {
    0: 'None',
    1: 'Manufactured',
    2: 'Dispatched (In Transit)',
    3: 'Delivered (In Store Stock)',
    4: 'Sold (Finalized)',
    5: 'Recalled',
};

export default function POSCheckoutPage() {
    const { auth } = useAuth();
    const navigate = useNavigate();

    // Barcode Scanner Input State
    const [scannedInput, setScannedInput] = useState('');
    const [cameraOpen, setCameraOpen] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
    const [autoSignEnabled, setAutoSignEnabled] = useState(true);

    // Verification State
    const [verifying, setVerifying] = useState(false);
    const [currentResult, setCurrentResult] = useState(null);
    const [posNotice, setPosNotice] = useState(null);

    // On-Chain Execution State
    const [finalizingSale, setFinalizingSale] = useState(false);
    const [receiptModalOpen, setReceiptModalOpen] = useState(false);
    const [activeReceipt, setActiveReceipt] = useState(null);

    // Shift History
    const [shiftLog, setShiftLog] = useState([]);

    // Location state
    const [storeLocation, setStoreLocation] = useState('Retail Store Floor');

    const inputRef = useRef(null);

    // Auto-focus barcode scanner input on mount and after scans
    useEffect(() => {
        if (!cameraOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [cameraOpen, currentResult]);

    // Fast background location resolution
    useEffect(() => {
        autoDetectLocation((loc) => {
            if (loc?.formatted) setStoreLocation(loc.formatted);
        }).catch(() => {});
    }, []);

    // Web Audio Confirmation Synthesizer
    const playPOSChime = useCallback((type = 'success') => {
        if (!audioEnabled) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();

            if (type === 'success') {
                // Cheerful 2-tone cash register success chime
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();

                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.08); // E6

                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);

                osc1.start(ctx.currentTime);
                osc1.stop(ctx.currentTime + 0.1);
                osc2.start(ctx.currentTime + 0.08);
                osc2.stop(ctx.currentTime + 0.35);
            } else {
                // Low warning buzz for fake or already sold
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(165, ctx.currentTime + 0.25);

                gain.gain.setValueAtTime(0.25, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.3);
            }
        } catch (_err) {
            // Audio policy ignore
        }
    }, [audioEnabled]);

    // Handle Barcode or QR Code Verification
    const verifyProductCode = async (rawCode) => {
        const trimmed = (rawCode || '').trim();
        if (!trimmed) return;

        setVerifying(true);
        setPosNotice(null);

        let serial = trimmed;
        try {
            const parsed = parseProductQr(trimmed, CONTRACT_ADDRESS);
            if (parsed?.serialNumber) serial = parsed.serialNumber;
        } catch (_parseErr) {
            // raw input is treated directly as serial if parser throws
        }

        try {
            // 1. First attempt authoritative blockchain check
            const provider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

            let product;
            try {
                product = await contract.getProduct(serial);
            } catch (_contractErr) {
                // If RPC fails or serial doesn't exist, try backend POS endpoint
                const backendRes = await api.post('/api/pos/checkout', {
                    serialNumber: serial,
                    storeId: 'STORE-01',
                    registerId: 'REG-01',
                    cashierName: auth?.username || 'Cashier',
                    location: storeLocation,
                });
                product = backendRes.data;
            }

            const exists = Array.isArray(product) ? (product[0] === serial) : product?.success;

            if (!exists) {
                playPOSChime('error');
                const fakeResult = {
                    serialNumber: serial,
                    status: 'UNREGISTERED_COUNTERFEIT',
                    canSell: false,
                    alertTitle: 'COUNTERFEIT WARNING — UNREGISTERED SERIAL',
                    alertMessage: 'This product identifier was NOT registered on the Ethereum blockchain passport registry. Do NOT ring up or sell this product!',
                    productName: 'Unregistered Item',
                    brand: 'Unknown',
                    stage: 'None',
                    isSold: false,
                    isRecalled: false,
                };
                setCurrentResult(fakeResult);
                setShiftLog((prev) => [fakeResult, ...prev]);
                return;
            }

            // Parse on-chain tuple
            const name = Array.isArray(product) ? product[1] : product.product?.name;
            const brand = Array.isArray(product) ? product[2] : product.product?.brand;
            const stageId = Array.isArray(product) ? Number(product[6]) : product.product?.stageId;
            const currentCustodian = Array.isArray(product) ? product[7] : product.product?.currentCustodian;
            const isSold = Array.isArray(product) ? Boolean(product[9]) : Boolean(product.product?.isSold);
            const isRecalled = Array.isArray(product) ? Boolean(product[10]) : Boolean(product.product?.isRecalled);

            let status = 'AUTHENTIC_READY_FOR_SALE';
            let canSell = true;
            let alertTitle = 'AUTHENTIC PRODUCT — READY FOR SALE';
            let alertMessage = `Authentic digital passport verified on ${CHAIN_NAME}. Physical custody confirmed.`;

            if (isRecalled) {
                status = 'RECALLED';
                canSell = false;
                alertTitle = 'RECALLED PRODUCT';
                alertMessage = 'DO NOT SELL: This product has been recalled by the manufacturer.';
                playPOSChime('error');
            } else if (isSold) {
                status = 'ALREADY_SOLD';
                canSell = false;
                alertTitle = 'RESALE / COUNTERFEIT ALERT — ALREADY MARKED SOLD';
                alertMessage = 'CRITICAL WARNING: This item was already marked sold on-chain. Potential counterfeit copycat or fraudulent return!';
                playPOSChime('error');
            } else if (stageId === 1) {
                status = 'MANUFACTURED_NOT_DISPATCHED';
                canSell = false;
                alertTitle = 'INVENTORY ALERT — NEVER DISPATCHED';
                alertMessage = 'Item is at manufacturer stage and was never dispatched into the official supply chain.';
                playPOSChime('error');
            } else if (stageId === 2) {
                status = 'IN_TRANSIT_NOT_DELIVERED';
                canSell = false;
                alertTitle = 'IN-TRANSIT SHIPMENT';
                alertMessage = 'This product is in transit. Store warehouse receiving receipt must be confirmed before selling.';
                playPOSChime('error');
            } else {
                playPOSChime('success');
            }

            const verifiedItem = {
                serialNumber: serial,
                productName: name,
                brand,
                stage: STAGE_LABELS[stageId] || 'Delivered',
                stageId,
                currentCustodian,
                isSold,
                isRecalled,
                status,
                canSell,
                alertTitle,
                alertMessage,
                timestamp: new Date().toISOString(),
                receiptId: `REC-${dayjs().format('YYYYMMDD')}-${serial.slice(-6).toUpperCase()}`,
            };

            setCurrentResult(verifiedItem);
            setShiftLog((prev) => [verifiedItem, ...prev]);

            // Auto-open receipt if auto-print enabled and item is authentic
            if (autoPrintReceipt && canSell) {
                setActiveReceipt(verifiedItem);
                setReceiptModalOpen(true);
            }
        } catch (err) {
            console.error('POS Verification Error:', err);
            playPOSChime('error');
            setPosNotice({ type: 'error', message: err.message || 'Failed to verify product passport on-chain' });
        } finally {
            setVerifying(false);
            setScannedInput('');
            if (inputRef.current) inputRef.current.focus();
        }
    };

    // Handle Manual / Hardware Barcode Enter Key
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            verifyProductCode(scannedInput);
        }
    };

    // 1-Tap Finalize Sale on Blockchain
    const handleFinalizeSale = async () => {
        if (!currentResult || !currentResult.canSell) return;

        setFinalizingSale(true);
        setPosNotice(null);

        try {
            // 1. First priority: Autonomous Headless Fast-Sign via Facility Keystore (Zero MetaMask Popups)
            if (autoSignEnabled) {
                setPosNotice({ type: 'info', message: '⚡ Fast-signing on blockchain via Facility Custody Keystore...' });
                try {
                    const execRes = await api.post('/api/custody/auto-execute', {
                        serialNumber: currentResult.serialNumber,
                        action: 'mark_sold',
                        location: storeLocation,
                    });
                    const txHash = execRes.data.txHash;
                    const facilityName = execRes.data.facility?.name || 'Facility Keystore';

                    const updated = {
                        ...currentResult,
                        isSold: true,
                        status: 'SOLD_FINALIZED',
                        canSell: false,
                        txHash: txHash,
                        alertTitle: 'SALE FINALIZED ON BLOCKCHAIN',
                        alertMessage: `Digital passport sealed as SOLD by ${facilityName}. Official customer warranty certificate issued.`,
                    };

                    setCurrentResult(updated);
                    setActiveReceipt(updated);
                    setReceiptModalOpen(true);
                    playPOSChime('success');
                    setPosNotice({ type: 'success', message: `⚡ Sale finalized on-chain by ${facilityName}! Tx: ${txHash.slice(0, 14)}...` });
                    return;
                } catch (autoErr) {
                    console.warn('Facility auto-execute attempt:', autoErr.response?.data?.error || autoErr.message);
                    if (!window.ethereum) {
                        throw new Error(autoErr.response?.data?.error || 'Autonomous signing failed and no browser wallet is connected.');
                    }
                }
            }

            // 2. Fallback to Browser Web3 Wallet (MetaMask)
            if (window.ethereum) {
                const browserProvider = new ethers.BrowserProvider(window.ethereum);
                const signer = await browserProvider.getSigner();

                await ensureConfiguredNetwork(window.ethereum);

                const productContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                const timestampSec = Math.floor(Date.now() / 1000).toString();

                setPosNotice({ type: 'info', message: 'Authorizing sale on blockchain... Please confirm transaction in your wallet.' });
                const tx = await productContract.markSold(
                    currentResult.serialNumber,
                    auth?.username || 'Retail Store Checkout',
                    storeLocation,
                    timestampSec
                );

                setPosNotice({ type: 'info', message: `Transaction submitted (${tx.hash.slice(0, 10)}...). Finalizing passport...` });
                await tx.wait();
            } else {
                throw new Error('Connect a wallet or use an approved facility wallet to record this sale.');
            }

            // Update local state to SOLD
            const updated = {
                ...currentResult,
                isSold: true,
                status: 'SOLD_FINALIZED',
                canSell: false,
                alertTitle: 'SALE FINALIZED ON BLOCKCHAIN',
                alertMessage: 'Digital passport is now permanently sealed as SOLD. Official customer warranty certificate generated.',
            };

            setCurrentResult(updated);
            setActiveReceipt(updated);
            setReceiptModalOpen(true);
            playPOSChime('success');
            setPosNotice({ type: 'success', message: `Sale finalized! Product passport permanently recorded on ${CHAIN_NAME}.` });
        } catch (err) {
            console.error('Sale finalization error:', err);
            playPOSChime('error');
            setPosNotice({ type: 'error', message: err.message || 'Sale was not recorded. No receipt was issued.' });
        } finally {
            setFinalizingSale(false);
        }
    };

    const content = (
        <Box sx={{ width: '100%', maxWidth: 1320, boxSizing: 'border-box', margin: '0 auto', p: { xs: 1.5, sm: 3, xl: 4 } }}>
            {/* Register header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2.5,
                mb: 2.5,
                pb: 2.5,
                borderBottom: '1px solid #E2E8F0',
            }}>
                <Box sx={{ minWidth: 0, flex: '1 1 440px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{
                            width: 38,
                            height: 38,
                            borderRadius: '10px',
                            backgroundColor: '#2563EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF'
                        }}>
                            <PointOfSaleRoundedIcon sx={{ fontSize: 22 }} />
                        </Box>
                        <div>
                            <Typography component="h1" variant="h4" sx={{ fontSize: { xs: 24, sm: 28 }, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.035em', lineHeight: 1.2 }}>
                                Retail Checkout
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748B', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, rowGap: 0.5 }}>
                                <span>Store #01 · Register 02</span>
                                <span>Cashier: <strong>{auth?.username || 'Store Staff'}</strong></span>
                                <span style={{ color: '#059669', fontWeight: 700 }}>● {CHAIN_NAME} active ({CHAIN_ID})</span>
                            </Typography>
                        </div>
                    </Box>
                </Box>

                {/* POS Controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', lg: 'flex-end' }, gap: 1, flexWrap: 'wrap', flex: '1 1 460px' }}>
                    <FormControlLabel
                        sx={{ m: 0, px: 1, border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#FFFFFF', minHeight: 40, '& .MuiFormControlLabel-label': { whiteSpace: 'nowrap' } }}
                        control={
                            <Switch
                                size="small"
                                checked={autoSignEnabled}
                                color="success"
                                onChange={(e) => setAutoSignEnabled(e.target.checked)}
                            />
                        }
                        label={<span style={{ fontSize: '12px', fontWeight: 700, color: autoSignEnabled ? '#047857' : '#64748B' }}>Facility auto-sign</span>}
                    />
                    <FormControlLabel
                        sx={{ m: 0, px: 1, border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#FFFFFF', minHeight: 40, '& .MuiFormControlLabel-label': { whiteSpace: 'nowrap' } }}
                        control={
                            <Switch
                                size="small"
                                checked={autoPrintReceipt}
                                onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                            />
                        }
                        label={<span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Auto receipt</span>}
                    />
                    <IconButton
                        size="small"
                        onClick={() => setAudioEnabled(!audioEnabled)}
                        title={audioEnabled ? 'Mute chimes' : 'Enable chimes'}
                        aria-label={audioEnabled ? 'Mute chimes' : 'Enable chimes'}
                        sx={{
                            width: 40,
                            height: 40,
                            backgroundColor: audioEnabled ? '#EFF6FF' : '#F1F5F9',
                            color: audioEnabled ? '#2563EB' : '#64748B',
                            border: '1px solid #E2E8F0',
                            borderRadius: '10px',
                        }}
                    >
                        {audioEnabled ? <VolumeUpRoundedIcon sx={{ fontSize: 18 }} /> : <VolumeOffRoundedIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                    <Button
                        variant={cameraOpen ? 'contained' : 'outlined'}
                        size="small"
                        startIcon={<QrCodeScannerRoundedIcon />}
                        onClick={() => setCameraOpen(!cameraOpen)}
                        sx={{
                            minHeight: 40,
                            px: 1.5,
                            textTransform: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            borderRadius: '10px',
                            borderColor: cameraOpen ? '#2563EB' : '#CBD5E1',
                            color: cameraOpen ? '#FFFFFF' : '#334155',
                            backgroundColor: cameraOpen ? '#2563EB' : '#FFFFFF',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {cameraOpen ? 'Close Camera' : 'Use Camera'}
                    </Button>
                </Box>
            </Box>

            {/* Camera Viewfinder (Collapsible) */}
            {cameraOpen && (
                <Paper
                    elevation={0}
                    sx={{
                        p: 2,
                        mb: 3,
                        borderRadius: '16px',
                        border: '2px solid #3B82F6',
                        backgroundColor: '#F8FAFC',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1E40AF' }}>
                        Point camera at QR code or packaging barcode
                    </Typography>
                    <Box sx={{ width: '100%', maxWidth: 360, borderRadius: '12px', overflow: 'hidden' }}>
                        <QrScanner onScan={(data) => {
                            if (data && !verifying) {
                                setCameraOpen(false);
                                verifyProductCode(data);
                            }
                        }} />
                    </Box>
                </Paper>
            )}

            {/* Hardware Barcode Wedge Ingestion Input */}
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 2, sm: 2.5 },
                    mb: 2.5,
                    borderRadius: '14px',
                    border: '1px solid #C7D7FE',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.035)',
                }}
            >
                <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700, color: '#0F172A', mb: 0.4 }}>
                    Scan to Verify
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', mb: 1.75 }}>
                    Use the camera, a barcode scanner, or enter the serial number.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'stretch', flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                        fullWidth
                        inputRef={inputRef}
                        inputProps={{ 'aria-label': 'Product serial number' }}
                        placeholder="Scan or enter product serial number"
                        value={scannedInput}
                        onChange={(e) => setScannedInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={verifying}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <QrCodeScannerRoundedIcon sx={{ color: '#2563EB' }} />
                                </InputAdornment>
                            ),
                            sx: {
                                fontFamily: 'monospace',
                                fontSize: '15px',
                                borderRadius: '12px',
                                backgroundColor: '#F8FAFC',
                            }
                        }}
                    />
                    <Button
                        variant="contained"
                        onClick={() => verifyProductCode(scannedInput)}
                        disabled={verifying || !scannedInput.trim()}
                        sx={{
                            px: 3.5,
                            py: 1.5,
                            minHeight: 52,
                            minWidth: { sm: 155 },
                            width: { xs: '100%', sm: 'auto' },
                            borderRadius: '12px',
                            textTransform: 'none',
                            fontWeight: 700,
                            backgroundColor: '#2563EB',
                            flexShrink: 0,
                            '&:hover': { backgroundColor: '#1D4ED8' }
                        }}
                    >
                        {verifying ? <CircularProgress size={20} sx={{ color: '#FFFFFF' }} /> : 'Verify product'}
                    </Button>
                </Box>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 1 }}>
                    Handheld barcode scanners submit automatically on Enter.
                </Typography>
            </Paper>

            {/* Notice / Feedback Toast */}
            {posNotice && (
                <Alert
                    severity={posNotice.type}
                    onClose={() => setPosNotice(null)}
                    sx={{ mb: 3, borderRadius: '12px', fontWeight: 600 }}
                >
                    {posNotice.message}
                </Alert>
            )}

            {/* Live Verification Result Banner */}
            {currentResult && (
                <Paper
                    elevation={0}
                    sx={{
                        p: 3,
                        mb: 3,
                        borderRadius: '16px',
                        border: '2px solid',
                        borderColor: currentResult.canSell ? '#10B981' : currentResult.status === 'ALREADY_SOLD' || currentResult.status === 'UNREGISTERED_COUNTERFEIT' ? '#EF4444' : '#F59E0B',
                        backgroundColor: currentResult.canSell ? '#F0FDF4' : currentResult.status === 'ALREADY_SOLD' || currentResult.status === 'UNREGISTERED_COUNTERFEIT' ? '#FEF2F2' : '#FFFBEB',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                            {currentResult.canSell ? (
                                <CheckCircleRoundedIcon sx={{ fontSize: 36, color: '#10B981', mt: 0.3 }} />
                            ) : currentResult.status === 'ALREADY_SOLD' || currentResult.status === 'UNREGISTERED_COUNTERFEIT' ? (
                                <ErrorOutlineRoundedIcon sx={{ fontSize: 36, color: '#EF4444', mt: 0.3 }} />
                            ) : (
                                <WarningAmberRoundedIcon sx={{ fontSize: 36, color: '#F59E0B', mt: 0.3 }} />
                            )}
                            <div>
                                <Typography variant="h6" sx={{
                                    fontWeight: 900,
                                    color: currentResult.canSell ? '#065F46' : currentResult.status === 'ALREADY_SOLD' || currentResult.status === 'UNREGISTERED_COUNTERFEIT' ? '#991B1B' : '#92400E'
                                }}>
                                    {currentResult.alertTitle}
                                </Typography>
                                <Typography variant="body2" sx={{
                                    color: currentResult.canSell ? '#047857' : currentResult.status === 'ALREADY_SOLD' || currentResult.status === 'UNREGISTERED_COUNTERFEIT' ? '#B91C1C' : '#B45309',
                                    fontWeight: 600,
                                    mt: 0.5,
                                    mb: 1.5,
                                }}>
                                    {currentResult.alertMessage}
                                </Typography>

                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                                    <Chip
                                        size="small"
                                        label={currentResult.productName}
                                        sx={{ fontWeight: 700, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                                    />
                                    {currentResult.brand && (
                                        <Chip
                                            size="small"
                                            label={currentResult.brand}
                                            sx={{ fontWeight: 700, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                                        />
                                    )}
                                    <Chip
                                        size="small"
                                        label={currentResult.stage}
                                        sx={{
                                            fontWeight: 700,
                                            backgroundColor: currentResult.canSell ? '#DCFCE7' : '#FEE2E2',
                                            color: currentResult.canSell ? '#15803D' : '#B91C1C',
                                            border: currentResult.canSell ? '1px solid #BBF7D0' : '1px solid #FECACA',
                                        }}
                                    />
                                </Box>

                                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#64748B', display: 'block' }}>
                                    {currentResult.serialNumber}
                                </Typography>
                            </div>
                        </Box>

                        {/* Action Buttons */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: { xs: 'stretch', sm: 'flex-end' }, minWidth: 200 }}>
                            {currentResult.canSell && (
                                <Button
                                    variant="contained"
                                    size="large"
                                    startIcon={finalizingSale ? <CircularProgress size={18} sx={{ color: '#FFFFFF' }} /> : <ShoppingBagRoundedIcon />}
                                    onClick={handleFinalizeSale}
                                    disabled={finalizingSale}
                                    sx={{
                                        backgroundColor: '#059669',
                                        color: '#FFFFFF',
                                        fontWeight: 800,
                                        textTransform: 'none',
                                        borderRadius: '10px',
                                        py: 1.2,
                                        px: 2.5,
                                        '&:hover': { backgroundColor: '#047857' }
                                    }}
                                >
                                    {finalizingSale ? 'Sealing on Chain...' : '🛍️ Finalize Sale & Issue Warranty'}
                                </Button>
                            )}

                            <Box sx={{ display: 'flex', gap: 1 }}>
                                {currentResult.status === 'SOLD_FINALIZED' && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<ReceiptLongRoundedIcon />}
                                        onClick={() => {
                                            setActiveReceipt(currentResult);
                                            setReceiptModalOpen(true);
                                        }}
                                        sx={{ textTransform: 'none', borderRadius: '8px', fontSize: '11.5px', fontWeight: 600 }}
                                    >
                                        View Receipt
                                    </Button>
                                )}
                                <Button
                                    size="small"
                                    variant="text"
                                    startIcon={<ArrowForwardRoundedIcon />}
                                    onClick={() => navigate(`/verify/${currentResult.serialNumber}`)}
                                    sx={{ textTransform: 'none', fontSize: '11.5px', color: '#2563EB', fontWeight: 600 }}
                                >
                                    Passport Link →
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                </Paper>
            )}

            {/* Shift Activity Stream */}
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 2, sm: 2.5 },
                    borderRadius: '14px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A' }}>
                        Session activity
                    </Typography>
                    {shiftLog.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip size="small" label={`${shiftLog.length} scanned`} sx={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600 }} />
                            <Button
                                size="small"
                                variant="text"
                                onClick={() => setShiftLog([])}
                                sx={{ textTransform: 'none', fontSize: '12px', color: '#64748B' }}
                            >
                                Clear session
                            </Button>
                        </Box>
                    )}
                </Box>

                {shiftLog.length === 0 ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, px: 1.75, border: '1px dashed #D7DFEB', borderRadius: '12px', backgroundColor: '#F8FAFC' }}>
                        <Box sx={{ width: 40, height: 40, flex: '0 0 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', backgroundColor: '#FFFFFF', color: '#64748B', border: '1px solid #E2E8F0' }}>
                            <ReceiptLongRoundedIcon sx={{ fontSize: 20 }} />
                        </Box>
                        <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>No scans yet</Typography>
                            <Typography variant="caption" sx={{ color: '#64748B' }}>Verified products will appear here during this session.</Typography>
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {shiftLog.map((item, idx) => (
                            <Box
                                key={`${item.serialNumber}-${idx}`}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    p: 1.2,
                                    borderRadius: '8px',
                                    border: '1px solid #F1F5F9',
                                    backgroundColor: '#F8FAFC',
                                    fontSize: '12px',
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
                                    {item.canSell ? (
                                        <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#10B981' }} />
                                    ) : (
                                        <ErrorOutlineRoundedIcon sx={{ fontSize: 18, color: '#EF4444' }} />
                                    )}
                                    <Box sx={{ overflow: 'hidden' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                            {item.productName} {item.brand ? `· ${item.brand}` : ''}
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#64748B' }}>
                                            {item.serialNumber}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                                    <Chip
                                        size="small"
                                        label={item.status === 'AUTHENTIC_READY_FOR_SALE' ? 'Authentic' : item.status === 'SOLD_FINALIZED' ? 'Sold' : 'Alert'}
                                        sx={{
                                            fontSize: '10.5px',
                                            height: 20,
                                            fontWeight: 700,
                                            backgroundColor: item.canSell ? '#DCFCE7' : '#FEE2E2',
                                            color: item.canSell ? '#15803D' : '#B91C1C',
                                        }}
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            setActiveReceipt(item);
                                            setReceiptModalOpen(true);
                                        }}
                                        title="Print Receipt"
                                    >
                                        <ReceiptLongRoundedIcon sx={{ fontSize: 16, color: '#64748B' }} />
                                    </IconButton>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}
            </Paper>

            {/* Customer Warranty Receipt Modal */}
            <POSCustomerReceiptModal
                open={receiptModalOpen}
                onClose={() => setReceiptModalOpen(false)}
                receiptData={activeReceipt}
                productData={activeReceipt}
            />
        </Box>
    );

    // If logged in, wrap in DashboardShell; if not, present full-bleed POS interface
    if (auth?.username) {
        return <DashboardShell>{content}</DashboardShell>;
    }

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#F8FAFC', py: 4 }}>
            {content}
        </Box>
    );
}
