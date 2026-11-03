import { Box, Paper, Typography, Alert, TextField, Button, CircularProgress } from '@mui/material';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import '../shell/shell.css';
import { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { ethers } from "ethers";
import axios from '../../api/axios';
import Geocode from "react-geocode";
import dayjs from 'dayjs';
import { useLocation, useNavigate } from 'react-router-dom';
import { CONTRACT_ADDRESS, CONTRACT_ABI, BLOCK_EXPLORER_URL, CHAIN_RPC_URL, ensureConfiguredNetwork } from '../../config/contract';
import { formatScanWarning } from '../../api/scanEvents';
import { formatContractError } from '../../utils/contractErrors';
import { parseProductQr } from '../../api/productQr';
import { determineCustodyAction } from '../../utils/stageActions';

const UpdateProductDetails = () => {

    const [currDate, setCurrDate] = useState('');
    const [currLatitude, setCurrLatitude] = useState("");
    const [currLongtitude, setCurrLongtitude] = useState("");
    const [currName, setCurrName] = useState("");
    const [currLocation, setCurrLocation] = useState("");
    const [locationNotice, setLocationNotice] = useState("");
    const [serialNumber, setSerialNumber] = useState("");
    const [loading, setLoading] = useState("");
    const [statusText, setStatusText] = useState("");
    const [actionError, setActionError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successInfo, setSuccessInfo] = useState(null);
    const [recallReason, setRecallReason] = useState("");
    const [productData, setProductData] = useState({
        stage: 0,
        custodian: '',
        pendingRecipient: '',
        isSold: false,
        isRecalled: false,
        name: '',
        brand: '',
        history: [],
    });
    const [isLoadingProduct, setIsLoadingProduct] = useState(false);
    const [activeWallet, setActiveWallet] = useState('');

    const { auth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const incomingQr = location.state?.qrData || location.state?.serialNumber;
    const scanWarnings = location.state?.warnings || [];

    const loadOnChainProduct = async (serial) => {
        if (!serial) return;
        setIsLoadingProduct(true);
        try {
            const provider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            const product = await contract.getProduct(serial);
            setProductData({
                serialNumber: product[0],
                name: product[1],
                brand: product[2],
                description: product[3],
                image: product[4],
                history: product[5],
                stage: Number(product[6]),
                custodian: product[7],
                pendingRecipient: product[8],
                isSold: Boolean(product[9]),
                isRecalled: Boolean(product[10]),
            });
        } catch (err) {
            console.error('Failed to load on-chain product details:', err);
        } finally {
            setIsLoadingProduct(false);
        }
    };

    useEffect(() => {
        if (serialNumber) {
            loadOnChainProduct(serialNumber);
        }
    }, [serialNumber]);

    useEffect(() => {
        if (auth?.walletAddress) {
            setActiveWallet(auth.walletAddress);
        }
        if (window.ethereum?.selectedAddress) {
            setActiveWallet(window.ethereum.selectedAddress);
        }
        if (window.ethereum?.on) {
            const handleAccountsChanged = (accounts) => {
                if (accounts?.[0]) setActiveWallet(accounts[0]);
            };
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            return () => {
                if (window.ethereum?.removeListener) {
                    window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                }
            };
        }
    }, [auth?.walletAddress]);

    const custodyAction = determineCustodyAction({
        stage: productData.stage,
        custodian: productData.custodian,
        pendingRecipient: productData.pendingRecipient,
        isSold: productData.isSold,
        isRecalled: productData.isRecalled,
        role: auth?.role,
        walletAddress: activeWallet || auth?.walletAddress,
        history: productData.history,
    });


    useEffect(() => {
        if (!incomingQr) {
            navigate('/scanner', { replace: true });
            return;
        }

        try {
            const { serialNumber: resolvedSerial } = parseProductQr(incomingQr, CONTRACT_ADDRESS);
            setSerialNumber(resolvedSerial);
        } catch {
            navigate('/scanner', { replace: true });
        }
    }, [incomingQr, navigate]);

    useEffect(() => {
        setCurrDate(dayjs().unix());
        getUsername();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth?.username]);


    useEffect(() => {
        const apiKey = process.env.REACT_APP_GEOCODING_API_KEY;
        if (!apiKey || currLatitude === '' || currLongtitude === '') {
            if (currLatitude !== '' && currLongtitude !== '' && !apiKey) {
                setLocationNotice('Coordinates were received, but address lookup is not configured. Enter the location manually; browser location is unverified.');
            }
            return;
        }

        try {
            const geocoder = Geocode?.default || Geocode;
            if (typeof geocoder?.setApiKey === 'function' && typeof geocoder?.fromLatLng === 'function') {
                geocoder.setApiKey(apiKey);
                geocoder.fromLatLng(currLatitude, currLongtitude).then(
                    (response) => {
                        const address = response.results?.[0]?.formatted_address || '';
                        setCurrLocation(address.replace(/,/g, ';'));
                        setLocationNotice('Approximate browser-reported location resolved. Review or edit it before submitting.');
                    },
                    () => setLocationNotice('Unable to resolve your location. Check permission and enter it manually.')
                ).catch(() => setLocationNotice('Unable to resolve your location. Check permission and enter it manually.'));
            } else {
                setLocationNotice('Geocoding service unavailable. Enter location manually.');
            }
        } catch {
            setLocationNotice('Unable to resolve your location. Check permission and enter it manually.');
        }

    }, [currLatitude, currLongtitude]);

    const getCurrentTimeLocation = () => {
        setCurrDate(dayjs().unix());
        setLocationNotice('Requesting optional browser location…');
        if (!navigator.geolocation) {
            setLocationNotice('Location is unavailable in this browser. Enter the business location manually if needed.');
            return;
        }
        navigator.geolocation.getCurrentPosition((position) => {
            setCurrLatitude(position.coords.latitude);
            setCurrLongtitude(position.coords.longitude);
            setLocationNotice('Browser coordinates captured.');
        }, () => setLocationNotice('Location permission was not granted or could not be read. Enter the business location manually if needed.'),
            { maximumAge: 60000, timeout: 10000 });
    }

    const getUsername = async () => {
        if (!auth?.username) return;
        try {
            const res = await axios.get(`/profile/${encodeURIComponent(auth.username)}`);
            if (res.data?.[0]?.name) {
                setCurrName(res.data[0].name);
            }
        } catch (error) {
            console.error('Failed to load profile display name', error);
        }
    };

    const updateProduct = async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        setActionError('');
        setSuccessInfo(null);
        setIsSubmitting(true);

        try {
            const { ethereum } = window;

            if (ethereum) {
                if (!serialNumber) {
                    throw new Error("Product identifier is missing. Please re-scan or re-select the product.");
                }

                setStatusText("Connecting wallet...");
                const accounts = await ethereum.request({ method: "eth_requestAccounts" });
                const connectedWallet = accounts?.[0]?.toLowerCase();
                if (!connectedWallet) {
                    throw new Error("No active wallet account found in MetaMask. Please connect an account.");
                }

                setStatusText("Verifying network (Sepolia)...");
                await ensureConfiguredNetwork(ethereum);

                const provider = new ethers.BrowserProvider(ethereum);
                const signer = await provider.getSigner();
                const productContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                const wallet = (await signer.getAddress()).toLowerCase();

                setStatusText("Verifying product on blockchain...");
                let product;
                try {
                    product = await productContract.getProduct(serialNumber);
                } catch (_readErr) {
                    const fallbackProvider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
                    const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, fallbackProvider);
                    product = await readContract.getProduct(serialNumber);
                }
                const currentStage = Number(product[6]);
                const custodian = product[7];
                const pendingRecipient = product[8];
                let transaction;

                if (currentStage === 2) {
                    const history = product[5];
                    const dispatchEvent = history[history.length - 1];
                    const senderRole = Number(dispatchEvent?.actorRole ?? 0);
                    if (custodian.toLowerCase() === wallet) {
                        throw new Error("The dispatching wallet cannot claim its own open delivery. A different eligible registered account must confirm receipt.");
                    }
                    const mayReceive = senderRole === 2
                        ? auth.role === 'supplier'
                        : senderRole === 3 && ['supplier', 'retailer'].includes(auth.role);
                    if (pendingRecipient !== ethers.ZeroAddress && pendingRecipient.toLowerCase() !== wallet) {
                        throw new Error("This product is assigned to a different recipient wallet.");
                    }
                    if (!mayReceive) throw new Error("Your account role is not eligible to confirm receipt of this dispatch.");

                    setStatusText(`Authorizing ${custodyAction.actionTitle}...`);
                    await axios.post('/wallet/authorize-write', { walletAddress: wallet, action: 'confirm_delivery' });

                    setStatusText(`Confirm ${custodyAction.actionTitle} in your wallet popup...`);
                    transaction = await productContract.confirmDelivery(serialNumber, currName, currLocation, currDate.toString());
                } else if (currentStage === 1 || currentStage === 3) {
                    if (custodian.toLowerCase() !== wallet) {
                        throw new Error(currentStage === 1
                            ? "This product has not been dispatched yet. The manufacturer must record the dispatch on-chain before a supplier can confirm receipt. You do not need access to the manufacturer's wallet."
                            : "This product is already marked delivered. Only its recorded custodian can initiate the next handover or mark it sold.");
                    }
                    if (auth.role === "retailer") {
                        setStatusText(`Authorizing ${custodyAction.actionTitle}...`);
                        await axios.post('/wallet/authorize-write', { walletAddress: wallet, action: 'mark_sold' });

                        setStatusText(`Confirm ${custodyAction.actionTitle} in your wallet popup...`);
                        transaction = await productContract.markSold(serialNumber, currName, currLocation, currDate.toString());
                    } else {
                        setStatusText(`Authorizing ${custodyAction.actionTitle}...`);
                        await axios.post('/wallet/authorize-write', { walletAddress: wallet, action: 'dispatch' });

                        setStatusText(`Confirm ${custodyAction.actionTitle} in your wallet popup...`);
                        transaction = await productContract.dispatchProduct(serialNumber, ethers.ZeroAddress, currName, currLocation, currDate.toString());
                    }
                } else {
                    throw new Error("This product is not ready for an action by this account.");
                }

                setStatusText(`Transaction submitted (${transaction.hash.slice(0, 10)}...). Waiting for blockchain confirmation...`);
                await transaction.wait();
                await loadOnChainProduct(serialNumber);

                const actionDescription =
                    currentStage === 2
                        ? 'Delivery confirmed! Physical custody of this product has been successfully transferred to your account on the blockchain.'
                        : auth.role === 'retailer'
                            ? 'Product marked as Sold! This digital passport is now finalized and permanently protected against resale counterfeiting.'
                            : 'Product dispatched! The item is now in transit awaiting confirmation by the recipient.';

                setSuccessInfo({
                    title: currentStage === 2
                        ? 'Custody Handover Confirmed'
                        : auth.role === 'retailer'
                            ? 'Product Marked as Sold'
                            : 'Product Dispatch Confirmed',
                    description: actionDescription,
                    txHash: transaction.hash,
                });
                setStatusText('');
                setLoading('Custody event confirmed on the blockchain.');

            } else {
                throw new Error('Install or enable a wallet to submit a custody action.');
            }
        } catch (error) {
            const formatted = formatContractError(error, 'Unable to submit the custody action.');
            setActionError(formatted);
            setStatusText('');
            setLoading(formatted);
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleRecall = async () => {
        setActionError('');
        setSuccessInfo(null);
        setIsSubmitting(true);
        try {
            if (!recallReason.trim()) throw new Error("Enter a recall reason.");
            if (!serialNumber) throw new Error("Product identifier is missing.");
            const { ethereum } = window;
            if (!ethereum) throw new Error("Install or enable a wallet to submit a recall.");
            await ethereum.request({ method: "eth_requestAccounts" });
            setStatusText("Verifying network (Sepolia)...");
            await ensureConfiguredNetwork(ethereum);
            const signer = await new ethers.BrowserProvider(ethereum).getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            const walletAddress = await signer.getAddress();
            setStatusText("Authorizing recall write...");
            await axios.post('/wallet/authorize-write', {
                walletAddress,
                action: 'recall',
            });
            setStatusText("Confirm recall in your wallet popup...");
            const transaction = await contract.recallProduct(serialNumber, recallReason, currName, currLocation, currDate.toString());
            setStatusText(`Recall submitted (${transaction.hash.slice(0, 10)}...). Waiting for confirmation...`);
            await transaction.wait();
            setSuccessInfo({
                title: 'Emergency Product Recall Recorded',
                description: 'Product recall has been finalized on-chain. All future scans will immediately warn consumers of this recall.',
                txHash: transaction.hash,
            });
            setStatusText('');
            setLoading("Recall recorded. Verification scans will show a recall warning.");
        } catch (error) {
            const formatted = formatContractError(error, 'Unable to record recall.');
            setActionError(formatted);
            setStatusText('');
            setLoading(formatted);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await updateProduct(e);
    }

    const handleBack = () => {
        navigate(-1);
    }


    return (
        <DashboardShell>
            <GreetingBanner
                title={custodyAction.actionTitle || "Update Physical Custody & Transition"}
                subtitle={custodyAction.actionDescription || "Dispatch into the registered supply chain or confirm receipt from your linked business wallet."}
                metrics={[
                    {
                        icon: <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>ID</span>,
                        value: serialNumber ? serialNumber.slice(0, 14) + '...' : 'Unknown',
                        label: 'Active Identifier',
                    },
                    {
                        icon: <span style={{ color: '#10B981', fontWeight: 700 }}>STAGE</span>,
                        value: custodyAction.stageLabel || 'Active',
                        label: 'Current Status',
                    },
                    {
                        icon: <span style={{ color: '#9333EA', fontWeight: 700 }}>ROLE</span>,
                        value: (auth?.role || 'Partner').toUpperCase(),
                        label: 'Signing Role',
                    },
                ]}
            />

            {scanWarnings.map((warning) => <Alert key={warning} severity="warning" sx={{ mb: 1 }}>{formatScanWarning(warning)}</Alert>)}

            <div className="dashboard-grid-dual">
                {/* Left Card: Custody Action Form */}
                <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Explicit Action Card */}
                    <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--color-surface-subtle, #F8FAFC)',
                        border: '1px solid var(--color-border, #E2E8F0)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Action To Be Performed
                            </span>
                            <span className={`status-pill ${custodyAction.pillColor}`}>
                                {custodyAction.stageLabel}
                            </span>
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                            {custodyAction.actionTitle}
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                            {custodyAction.actionDescription}
                        </p>
                        {productData.name && (
                            <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                Product: <strong style={{ color: 'var(--color-text-main)' }}>{productData.name}</strong> {productData.brand ? `· ${productData.brand}` : ''}
                            </div>
                        )}
                    </div>

                    <h2 style={{ margin: '4px 0 0 0', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        Handover Information & Signer Details
                    </h2>

                    <TextField
                        fullWidth
                        label="Product Identifier"
                        disabled
                        value={serialNumber}
                    />

                    <TextField
                        fullWidth
                        label="Custodian / Signer Name"
                        disabled
                        value={currName}
                    />

                    <TextField
                        fullWidth
                        label="Current Location"
                        multiline
                        minRows={2}
                        value={currLocation.replace(/;/g, ",")}
                        onChange={(event) => setCurrLocation(event.target.value.replace(/,/g, ';'))}
                        helperText={locationNotice || "Recorded with this on-chain event."}
                    />

                    <Button type="button" fullWidth variant="text" onClick={getCurrentTimeLocation} sx={{ textTransform: 'none' }} disabled={isSubmitting}>
                        📍 Detect Browser Location
                    </Button>

                    <TextField
                        fullWidth
                        label="Effective Blockchain Timestamp"
                        disabled
                        value={dayjs(currDate * 1000).format("MMMM D, YYYY h:mm A")}
                    />

                    {!custodyAction.canExecute && custodyAction.reason && (
                        <Alert severity="warning" sx={{ width: '100%' }}>
                            {custodyAction.reason}
                        </Alert>
                    )}

                    {actionError && (
                        <Alert severity="error" sx={{ width: '100%' }}>{actionError}</Alert>
                    )}

                    {statusText && (
                        <div style={{ padding: '12px', borderRadius: 8, backgroundColor: 'var(--color-primary-subtle)', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 600, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <CircularProgress size={16} sx={{ color: 'var(--color-primary)' }} />
                            <span>{statusText}</span>
                        </div>
                    )}

                    {successInfo ? (
                        <div style={{
                            padding: '20px',
                            borderRadius: '12px',
                            backgroundColor: '#ECFDF5',
                            border: '1px solid #A7F3D0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            marginTop: '8px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <CheckCircleOutlineRoundedIcon sx={{ fontSize: 24, color: '#10B981' }} />
                                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#065F46' }}>
                                    {successInfo.title}
                                </h4>
                            </div>
                            <p style={{ margin: 0, fontSize: '13px', color: '#047857', lineHeight: 1.5 }}>
                                {successInfo.description}
                            </p>
                            {successInfo.txHash && (
                                <div style={{ fontSize: '12px', color: '#065F46', wordBreak: 'break-all' }}>
                                    <strong>Transaction Hash: </strong>
                                    <a
                                        href={`${BLOCK_EXPLORER_URL}/tx/${successInfo.txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: '#047857', textDecoration: 'underline', fontWeight: 600 }}
                                    >
                                        {successInfo.txHash.slice(0, 16)}...{successInfo.txHash.slice(-8)}
                                    </a>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                                {auth.role === 'retailer' && successInfo.title === 'Custody Handover Confirmed' && (
                                    <button
                                        type="button"
                                        className="btn-primary-action"
                                        style={{ width: '100%', justifyContent: 'center', padding: '12px', backgroundColor: '#059669' }}
                                        onClick={() => {
                                            setSuccessInfo(null);
                                            setActionError('');
                                            setStatusText('');
                                        }}
                                    >
                                        Proceed to Mark Product as Sold Now →
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn-primary-action"
                                    style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                                    onClick={() => navigate('/update-product', { state: { qrData: serialNumber } })}
                                >
                                    View Updated Custody Timeline →
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary-action"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() => navigate(`/${auth.role || ''}`)}
                                >
                                    Return to Dashboard
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <button
                                type="button"
                                className="btn-primary-action"
                                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                                onClick={handleSubmit}
                                disabled={isSubmitting || !custodyAction.canExecute}
                            >
                                {isSubmitting ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <CircularProgress size={16} color="inherit" />
                                        Executing on Blockchain...
                                    </span>
                                ) : (
                                    custodyAction.buttonLabel
                                )}
                            </button>

                            <button
                                type="button"
                                className="btn-secondary-action"
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={handleBack}
                                disabled={isSubmitting}
                            >
                                Cancel & Return
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Card: Emergency Recall & Protocol Actions */}
                <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h2 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        Protocol Governance & Recalls
                    </h2>

                    {(auth.role === "manufacturer" || auth.role === "admin") ? (
                        <div style={{ background: 'var(--status-red-bg)', border: '1px solid #FECACA', borderRadius: 12, padding: 18 }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 700, color: 'var(--status-red-text)' }}>
                                Emergency Product Recall
                            </h3>
                            <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                                Initiating a recall permanently sets this product state to Recalled on IdenteefiV2. All public verification scans will instantly display an emergency alert.
                            </p>
                            <TextField
                                fullWidth
                                label="Official Recall Reason"
                                multiline
                                minRows={2}
                                value={recallReason}
                                onChange={(event) => setRecallReason(event.target.value)}
                                sx={{ backgroundColor: '#FFFFFF', borderRadius: 1 }}
                            />
                            <button
                                type="button"
                                className="btn-secondary-action"
                                style={{ marginTop: 12, width: '100%', justifyContent: 'center', borderColor: '#DC2626', color: '#DC2626' }}
                                onClick={handleRecall}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Processing Recall..." : "Execute On-Chain Recall"}
                            </button>
                        </div>
                    ) : (
                        <div style={{ background: 'var(--color-surface-subtle)', borderRadius: 12, padding: 18, border: '1px solid var(--color-border)' }}>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                Custody Authorization Rules
                            </h3>
                            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                                <li><strong>Manufacturer dispatch:</strong> Any registered supplier can confirm receipt from its linked wallet.</li>
                                <li><strong>Supplier receipt:</strong> A registered supplier claims an inbound product on-chain.</li>
                                <li><strong>Supplier dispatch:</strong> A registered supplier or retailer can confirm receipt.</li>
                                <li><strong>Retailer Mark Sold:</strong> Locks the asset from any subsequent transfer.</li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}

export default UpdateProductDetails;
