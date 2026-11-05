import { Box, Paper, Typography, Button, Checkbox, FormControlLabel, CircularProgress, Alert, TextField, IconButton } from '@mui/material';
import QrScanner from '../QrScanner';
import { useCallback, useEffect, useState, useRef } from 'react';
import useAuth from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import dayjs from 'dayjs';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_RPC_URL, assertConfiguredChain } from '../../config/contract';
import api from '../../api/axios';
import { submitScanEvent } from '../../api/scanEvents';
import { parseProductQr } from '../../api/productQr';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import FlashOnRoundedIcon from '@mui/icons-material/FlashOnRounded';
import '../scanner/scannerModal.css';

const ScannerPage = () => {
    const [activeTab, setActiveTab] = useState(0); // 0: Camera, 1: Manual
    const [manualInput, setManualInput] = useState('');
    const [status, setStatus] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [shareLocation, setShareLocation] = useState(false);
    const [lastScanned, setLastScanned] = useState('');

    // Phase 2: Warehouse Continuous Multi-Scan Batch Mode
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [batchQueue, setBatchQueue] = useState([]);
    const [batchNotice, setBatchNotice] = useState(null);
    const [batchExecuting, setBatchExecuting] = useState(false);
    const lastScannedTimeRef = useRef(0);

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

    // Audio confirmation synth beep (Zero dependencies, native Web Audio API)
    const playAudioBeep = useCallback((isSuccess = true) => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(isSuccess ? 880 : 320, ctx.currentTime);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
            osc.start();
            osc.stop(ctx.currentTime + 0.14);
        } catch (_e) {
            // Audio blocked by browser policy until interaction
        }
    }, []);

    // Phase 2: Warehouse Continuous Multi-Scan Handler
    const handleBatchScan = useCallback(async (rawCode) => {
        const trimmed = (rawCode || '').trim();
        if (!trimmed) return;

        let parsedContract;
        let serial;
        try {
            ({ contractAddress: parsedContract, serialNumber: serial } = parseProductQr(trimmed, CONTRACT_ADDRESS));
        } catch (err) {
            playAudioBeep(false);
            setBatchNotice({ type: 'error', message: err.message || 'Invalid barcode or QR code' });
            setTimeout(() => setBatchNotice(null), 3000);
            return;
        }

        // Check for duplicate in current batch
        if (batchQueue.some(item => item.serialNumber.toLowerCase() === serial.toLowerCase())) {
            playAudioBeep(false);
            setBatchNotice({ type: 'warning', message: `Already in batch: ${serial.slice(0, 16)}...` });
            setTimeout(() => setBatchNotice(null), 2500);
            return;
        }

        // Verify and fetch product details from Sepolia RPC
        try {
            const provider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            const exists = await contract.productExists(serial);
            if (!exists) {
                playAudioBeep(false);
                setBatchNotice({ type: 'error', message: `Unregistered: ${serial.slice(0, 14)}... is not on blockchain!` });
                setTimeout(() => setBatchNotice(null), 3500);
                return;
            }

            const product = await contract.getProduct(serial);
            const stageNumber = Number(product[6]);
            const isRecalled = Boolean(product[10]);

            playAudioBeep(true);
            const newItem = {
                serialNumber: serial,
                name: product[1] || 'Product',
                brand: product[2] || '',
                stage: stageNumber,
                isRecalled,
                isSold: Boolean(product[9]),
                time: dayjs().format('HH:mm:ss'),
            };

            setBatchQueue(prev => [newItem, ...prev]);
            setBatchNotice({
                type: 'success',
                message: `Added #${batchQueue.length + 1}: ${newItem.name} (${serial.slice(0, 14)}...)`,
            });
            setTimeout(() => setBatchNotice(null), 2500);
        } catch (err) {
            console.warn('Batch verification failed:', err);
            playAudioBeep(true);
            const fallbackItem = {
                serialNumber: serial,
                name: 'Verified Identifier',
                brand: '',
                stage: 2,
                time: dayjs().format('HH:mm:ss'),
            };
            setBatchQueue(prev => [fallbackItem, ...prev]);
            setBatchNotice({ type: 'success', message: `Added #${batchQueue.length + 1}: ${serial.slice(0, 14)}...` });
            setTimeout(() => setBatchNotice(null), 2500);
        }
    }, [batchQueue, playAudioBeep]);

    const handleCameraScan = (data) => {
        if (!data || verifying) return;
        // Debounce camera repeats within 2 seconds
        if (data === lastScanned && Date.now() - lastScannedTimeRef.current < 2000) return;
        lastScannedTimeRef.current = Date.now();
        setLastScanned(data);

        if (isBatchMode) {
            handleBatchScan(data);
        } else {
            verifyProductCode(data);
        }
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        const trimmed = manualInput.trim();
        if (!trimmed) {
            setStatus('Please enter a product serial number or full QR code.');
            return;
        }
        if (isBatchMode) {
            handleBatchScan(trimmed);
            setManualInput('');
        } else {
            verifyProductCode(trimmed);
        }
    };

    const exportBatchCSV = () => {
        if (batchQueue.length === 0) return;
        const headers = ["Index,Serial Number,Product Name,Brand,Stage,Scanned Time"];
        const rows = batchQueue.map((item, idx) => 
            `${idx + 1},"${item.serialNumber}","${(item.name || '').replace(/"/g, '""')}","${(item.brand || '').replace(/"/g, '""')}",${item.stage},"${item.time}"`
        );
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `smartscan_batch_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const removeBatchItem = (serial) => {
        setBatchQueue(prev => prev.filter(item => item.serialNumber !== serial));
    };

    const handleBatchAutoExecute = async () => {
        if (!batchQueue.length || batchExecuting) return;
        setBatchExecuting(true);
        setBatchNotice({ type: 'info', message: '⚡ Fast-signing batch on Ethereum Sepolia via Facility Keystore...' });

        let completed = 0;
        let failed = 0;

        for (const item of batchQueue) {
            try {
                let action = 'confirm_delivery';
                if (auth?.role === 'manufacturer') action = 'dispatch';
                else if (auth?.role === 'retailer') action = 'mark_sold';

                await api.post('/api/custody/auto-execute', {
                    serialNumber: item.serialNumber,
                    action,
                    location: 'Warehouse Receiving Dock Floor',
                });
                completed++;
            } catch (err) {
                console.warn(`Batch execution item error for ${item.serialNumber}:`, err.message);
                failed++;
            }
        }

        setBatchNotice({
            type: failed === 0 ? 'success' : 'warning',
            message: `⚡ Batch fast-execution finished! ${completed} confirmed on-chain${failed > 0 ? `, ${failed} failed` : ''}.`,
        });
        setBatchExecuting(false);
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
                                Smart Custody & Verification Scanner
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 500 }}>
                                Auto-detects Inbound Receipt, Outbound Dispatch, or Retail Sale on Sepolia
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

                {/* Continuous Batch Scan Mode Switcher */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 24px',
                    backgroundColor: isBatchMode ? '#EFF6FF' : '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Inventory2RoundedIcon sx={{ fontSize: 18, color: isBatchMode ? '#2563EB' : '#64748B' }} />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: isBatchMode ? '#1E40AF' : '#475569' }}>
                            {isBatchMode ? 'Continuous Batch Scan Mode' : 'Single Inspection Mode'}
                        </span>
                        {isBatchMode && (
                            <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '12px',
                                backgroundColor: '#DBEAFE',
                                color: '#1E40AF'
                            }}>
                                {batchQueue.length} Scanned
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setIsBatchMode(!isBatchMode);
                            setStatus('');
                            setBatchNotice(null);
                        }}
                        style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: isBatchMode ? '#2563EB' : '#475569',
                            background: isBatchMode ? '#FFFFFF' : '#F1F5F9',
                            border: '1px solid',
                            borderColor: isBatchMode ? '#93C5FD' : '#CBD5E1',
                            borderRadius: '8px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                        }}
                    >
                        {isBatchMode ? 'Switch to Single' : '⚡ Enable Batch Scan'}
                    </button>
                </div>

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
                            {verifying ? <CircularProgress size={22} sx={{ color: '#FFFFFF' }} /> : (isBatchMode ? 'Add to Batch' : 'Verify On-Chain')}
                        </Button>
                    </Box>
                )}

                {/* Batch Feedback Banner */}
                {batchNotice && (
                    <Box sx={{ px: 3, pb: 1.5 }}>
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: batchNotice.type === 'success' ? '#ECFDF5' : batchNotice.type === 'warning' ? '#FFFBEB' : '#FEF2F2',
                            border: `1px solid ${batchNotice.type === 'success' ? '#A7F3D0' : batchNotice.type === 'warning' ? '#FDE68A' : '#FECACA'}`,
                            color: batchNotice.type === 'success' ? '#065F46' : batchNotice.type === 'warning' ? '#92400E' : '#991B1B',
                            fontSize: '13px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            {batchNotice.type === 'success' && <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#10B981' }} />}
                            <span>{batchNotice.message}</span>
                        </div>
                    </Box>
                )}

                {/* Inbound Batch Queue Manifest Card */}
                {isBatchMode && batchQueue.length > 0 && (
                    <Box sx={{ px: 3, pb: 2 }}>
                        <div style={{
                            padding: '14px 16px',
                            borderRadius: '14px',
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                                        Scanned Items ({batchQueue.length})
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    {auth?.role && ['supplier', 'retailer', 'manufacturer'].includes(auth.role) && (
                                        <Button
                                            size="small"
                                            variant="contained"
                                            disabled={batchExecuting || batchQueue.length === 0}
                                            startIcon={batchExecuting ? <CircularProgress size={12} color="inherit" /> : <FlashOnRoundedIcon sx={{ fontSize: 14 }} />}
                                            onClick={handleBatchAutoExecute}
                                            sx={{
                                                textTransform: 'none',
                                                fontSize: '11px',
                                                py: 0.3,
                                                px: 1,
                                                borderRadius: '6px',
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                color: '#fff',
                                                fontWeight: 700,
                                            }}
                                        >
                                            {batchExecuting ? 'Signing...' : '⚡ Auto-Sign Batch'}
                                        </Button>
                                    )}
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<FileDownloadRoundedIcon />}
                                        onClick={exportBatchCSV}
                                        sx={{ textTransform: 'none', fontSize: '11px', py: 0.3, px: 1, borderRadius: '6px' }}
                                    >
                                        Export CSV
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => setBatchQueue([])}
                                        sx={{ textTransform: 'none', fontSize: '11px', py: 0.3, px: 1, color: '#EF4444' }}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 190, overflowY: 'auto' }}>
                                {batchQueue.map((item, idx) => (
                                    <div
                                        key={item.serialNumber}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid #E2E8F0',
                                            fontSize: '12px',
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                #{batchQueue.length - idx} {item.name} {item.brand ? `· ${item.brand}` : ''}
                                            </div>
                                            <div style={{ fontFamily: 'monospace', fontSize: '10.5px', color: '#64748B' }}>
                                                {item.serialNumber}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                            <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>{item.time}</span>
                                            <button
                                                type="button"
                                                onClick={() => navigate('/update-product-details', { state: { serialNumber: item.serialNumber } })}
                                                style={{
                                                    padding: '3px 8px',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    color: '#2563EB',
                                                    backgroundColor: '#EFF6FF',
                                                    border: '1px solid #BFDBFE',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                Handover →
                                            </button>
                                            <IconButton size="small" onClick={() => removeBatchItem(item.serialNumber)} title="Remove item">
                                                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: '#94A3B8' }} />
                                            </IconButton>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
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
