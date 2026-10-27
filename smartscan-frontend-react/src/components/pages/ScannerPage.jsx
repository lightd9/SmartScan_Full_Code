import { Box, Paper, Typography, Button, Checkbox, FormControlLabel } from '@mui/material';
import bgImg from '../../img/bg.png';
import QrScanner from '../QrScanner';
import { useCallback, useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_RPC_URL, assertConfiguredChain } from '../../config/contract';
import api from '../../api/axios';
import { submitScanEvent } from '../../api/scanEvents';
import { parseProductQr } from '../../api/productQr';

const ScannerPage = () => {
    const [qrData, setQrData] = useState('');
    const [status, setStatus] = useState('');
    const [shareLocation, setShareLocation] = useState(false);

    const { auth } = useAuth();
    const navigate = useNavigate();

    const passData = (data) => {
        setQrData(data);
    };

    const recordScan = useCallback(async (serialNumber, contractAddress) => {
        const payload = { serialNumber: serialNumber || 'invalid', contractAddress: contractAddress || '' };
        if (shareLocation && navigator.geolocation) {
            try {
                const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 60000, timeout: 5000 }));
                payload.latitude = position.coords.latitude;
                payload.longitude = position.coords.longitude;
            } catch (_error) {
                // Location is optional; scanning and verification continue without it.
            }
        }
        return submitScanEvent(api, payload);
    }, [shareLocation]);

    useEffect(() => {
        if (!qrData) {
            return;
        }

        let contractAddress;
        let serialNumber;
        try {
            ({ contractAddress, serialNumber } = parseProductQr(qrData, CONTRACT_ADDRESS));
        } catch (error) {
            const candidateContract = typeof qrData === 'string' ? (qrData.split(',')[0] || '').trim() : '';
            recordScan('invalid', ethers.isAddress(candidateContract) ? candidateContract : '').catch(() => {});
            const warning = error.message || 'This QR code is not a valid SmartScan code.';
            if (warning.includes('unrecognized contract') || warning.includes('invalid product identifier')) {
                navigate('/fake-product', { state: { warning } });
            } else {
                setStatus(warning);
            }
            return;
        }

        const verifyOnChain = async () => {
            setStatus('Verifying product on the blockchain...');
            try {
                const provider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
                await assertConfiguredChain(provider);
                const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
                if (!(await contract.productExists(serialNumber))) {
                    const warnings = await recordScan(serialNumber, contractAddress);
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
                    navigate('/fake-product');
                    return;
                }
                const warnings = await recordScan(serialNumber, contractAddress);

                if (Number(state.stage) === 5 || state.recalled) {
                    navigate('/fake-product', { state: { warning: 'This product has been recalled. Do not purchase or use it.', warnings, recalled: true } });
                    return;
                }

                if (['admin', 'manufacturer', 'supplier', 'retailer'].includes(auth.role)) {
                    navigate('/update-product', { state: { qrData, warnings } });
                } else {
                    navigate('/authentic-product', { state: { qrData, warnings } });
                }
            } catch (_err) {
                setStatus('Unable to reach the blockchain. Please check your connection and try again.');
            }
        };

        verifyOnChain();
    }, [qrData, auth.role, navigate, recordScan]);

    const handleBack = () => {
        navigate(-1);
    };

    return (
        <Box sx={{
            backgroundImage: `url(${bgImg})`,
            minHeight: "80vh",
            backgroundRepeat: "no-repeat",
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundSize: 'cover',
            zIndex: -2,
            overflowY: "scroll"
        }}>
            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    maxWidth: 460,
                    margin: 'auto',
                    marginTop: '8%',
                    marginBottom: '8%',
                    padding: '36px 32px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '24px',
                    border: '1px solid #ECEEF2',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
                }}
            >
                <Box sx={{ textAlign: 'center' }}>
                    <Typography
                        variant="h2"
                        sx={{
                            textAlign: 'center',
                            marginBottom: '20px',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            fontWeight: 800,
                            fontSize: '1.75rem',
                            color: '#111827',
                        }}
                    >
                        Scan QR Code
                    </Typography>

                    <QrScanner passData={passData} />

                    <FormControlLabel
                        sx={{
                            mt: 2,
                            textAlign: 'left',
                            '& .MuiTypography-root': {
                                fontSize: '0.85rem',
                                color: '#6B7280',
                                lineHeight: 1.4,
                            },
                        }}
                        control={<Checkbox checked={shareLocation} onChange={(event) => setShareLocation(event.target.checked)} sx={{ color: '#2F66EE', '&.Mui-checked': { color: '#2F66EE' } }} />}
                        label="Share approximate browser-reported location (unverified) to help detect suspicious copies"
                    />

                    {status && (
                        <Typography variant="body2" sx={{ marginTop: '16px', color: '#DC2626', fontWeight: 600, fontSize: '0.9rem' }}>
                            {status}
                        </Typography>
                    )}

                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Button
                            onClick={handleBack}
                            variant="outlined"
                            sx={{
                                width: '100%',
                                py: 1.3,
                                borderRadius: '12px',
                                borderColor: '#D1D5DB',
                                color: '#374151',
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                '&:hover': {
                                    borderColor: '#9CA3AF',
                                    backgroundColor: '#F9FAFB',
                                },
                            }}
                        >
                            Back
                        </Button>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default ScannerPage;
