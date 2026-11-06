import { Box, Paper, Typography, TextField, Button, CircularProgress } from '@mui/material';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import '../shell/shell.css';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ethers } from "ethers";
import axios from '../../api/axios';
import QRCode from 'qrcode.react';
import dayjs from 'dayjs';
import useAuth from '../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import Geocode from "react-geocode";
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_ID_HEX, CHAIN_NAME, CHAIN_RPC_URL, BLOCK_EXPLORER_URL, NATIVE_CURRENCY_NAME, NATIVE_CURRENCY_SYMBOL, NATIVE_CURRENCY_DECIMALS } from '../../config/contract';
import { formatContractError } from '../../utils/contractErrors';
import { autoDetectLocation, detectLocation } from '../../utils/locationResolver';
import ThermalPackagingLabelModal from './ThermalPackagingLabelModal';

function createProductIdentifier() {
    if (window.crypto.randomUUID) return `SS-${window.crypto.randomUUID()}`;
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `SS-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const AddProduct = () => {

    const [serialNumber, setSerialNumber] = useState(createProductIdentifier);
    const [name, setName] = useState("");
    const [brand, setBrand] = useState("");
    const [description, setDescription] = useState("");
    const [image, setImage] = useState({
        file: [],
        filepreview: null
    });
    const [qrData, setQrData] = useState('');
    const [manuDate, setManuDate] = useState('');
    const [manuLatitude, setManuLatitude] = useState("");
    const [manuLongtitude, setManuLongtitude] = useState("");
    const [manuName, setManuName] = useState("");
    const [loading, setLoading] = useState("");
    const [manuLocation, setManuLocation] = useState("");
    const [isDetectingLocation, setIsDetectingLocation] = useState(false);
    const [isUnique, setIsUnique] = useState(true);
    const [productCreated, setProductCreated] = useState(false);
    const [retryAvailable, setRetryAvailable] = useState(false);
    const [savedImageName, setSavedImageName] = useState("");
    const [unpersistedTxHash, setUnpersistedTxHash] = useState("");
    const [chainNotice, setChainNotice] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [retryableProducts, setRetryableProducts] = useState([]);
    const [autoDispatchOnCreate, setAutoDispatchOnCreate] = useState(false);
    const [isDispatched, setIsDispatched] = useState(false);
    const [dispatchLoading, setDispatchLoading] = useState(false);
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

    const { auth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setManuDate(dayjs().unix());
        getUsername();
        loadRetryableProducts();
        if (location.state?.resumeProduct) {
            const resumeProd = location.state.resumeProduct;
            if (resumeProd.chain_status === 'confirmed') {
                navigate(`/product-details/${encodeURIComponent(resumeProd.serialnumber)}`, { replace: true });
                return;
            }
            resumeProductRetry(resumeProd);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    const loadRetryableProducts = async () => {
        try {
            const [pending, retryable, failed] = await Promise.all([
                axios.get('/product/chain-status?status=pending_wallet'),
                axios.get('/product/chain-status?status=needs_retry'),
                axios.get('/product/chain-status?status=failed'),
            ]);
            const products = [...pending.data, ...retryable.data, ...failed.data];
            setRetryableProducts(products);
        } catch (_error) {
            setChainNotice('Unable to load recoverable registrations. Refresh before starting another registration.');
        }
    };

    const resetForm = () => {
        setSerialNumber(createProductIdentifier());
        setName("");
        setBrand("");
        setDescription("");
        setImage({ file: [], filepreview: null });
        setSavedImageName("");
        setProductCreated(false);
        setRetryAvailable(false);
        setSubmitError("");
        setChainNotice("You can now register another product.");
        setQrData("");
        setIsDispatched(false);
        setAutoDispatchOnCreate(false);
        setDispatchLoading(false);
    };

    const handleDiscardDraft = async () => {
        if (!window.confirm("Are you sure you want to discard this unconfirmed product draft? It will be permanently removed from your inventory.")) {
            return;
        }
        try {
            setLoading("Discarding draft registration...");
            await axios.delete(`/product/${encodeURIComponent(serialNumber)}`);
            resetForm();
            await loadRetryableProducts();
        } catch (err) {
            setSubmitError(err.response?.data?.error || "Failed to discard draft");
        } finally {
            setLoading("");
        }
    };

    const resumeProductRetry = (product) => {
        setSerialNumber(product.serialnumber);
        setName(product.name || "");
        setBrand(product.brand || "");
        setDescription(product.chain_description || "");
        setManuName(product.chain_actor || manuName);
        setManuLocation(product.chain_location || "");
        setManuDate(product.chain_timestamp || dayjs().unix().toString());
        setSavedImageName(product.chain_image || "");
        setProductCreated(true);
        setRetryAvailable(true);
        setChainNotice(`Product ${product.serialnumber} is recoverable (${product.chain_status}${product.failure_reason ? `: ${product.failure_reason}` : ''}). You can retry registration or discard the draft.`);
        setImage({ file: [], filepreview: null });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const isLocationManuallyEditedRef = useRef(false);

    const resolveLocationProgressive = useCallback(async (isManualTrigger = false) => {
        if (isManualTrigger) {
            isLocationManuallyEditedRef.current = false;
        }
        setManuDate(dayjs().unix());
        setIsDetectingLocation(true);
        if (isManualTrigger) {
            setChainNotice('Resolving location (device & network)...');
        }
        try {
            const apiKey = process.env.REACT_APP_GEOCODING_API_KEY;
            await autoDetectLocation({
                googleApiKey: apiKey,
                onUpdate: (res) => {
                    if (isLocationManuallyEditedRef.current) return;
                    if (res.latitude) setManuLatitude(res.latitude);
                    if (res.longitude) setManuLongtitude(res.longitude);
                    if (res.location) {
                        setManuLocation(res.location.replace(/,/g, ';'));
                    }
                    if (res.notice) {
                        setChainNotice(res.notice);
                    }
                },
            });
        } catch (err) {
            console.warn('Location detection failed:', err);
            if (!manuLocation) {
                setChainNotice(err.message || 'Unable to detect location automatically. Please enter your location manually.');
            }
        } finally {
            setIsDetectingLocation(false);
        }
    }, [manuLocation]);

    const handleDetectLocation = () => {
        resolveLocationProgressive(true);
    };

    // Automatically resolve location on mount if empty
    useEffect(() => {
        if (!manuLocation) {
            resolveLocationProgressive(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const generateQRCode = (serialNum) => {
        const baseUrl = typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : '';
        const verifyUrl = `${baseUrl}/verify/${serialNum}`;
        setQrData(verifyUrl);
    };

    const downloadQR = () => {
        const canvas = document.getElementById("QRCode");
        const pngUrl = canvas
            .toDataURL("image/png")
            .replace("image/png", "image/octet-stream");
        let downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `${serialNumber}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    const handleDispatchProduct = async () => {
        if (!serialNumber) return;
        setDispatchLoading(true);
        setSubmitError("");
        setChainNotice("Initiating outbound transit dispatch via facility wallet...");
        try {
            setLoading("Dispatching consignment via facility wallet...");
            const autoRes = await axios.post('/api/custody/auto-execute', {
                serialNumber,
                action: 'dispatch',
                location: manuLocation,
                recipientWallet: ethers.ZeroAddress,
            });

            if (autoRes.data?.success) {
                setIsDispatched(true);
                setChainNotice("🚀 Consignment dispatched to distribution network! Registered logistics partners can now confirm receipt.");
            } else {
                throw new Error(autoRes.data?.error || "Consignment dispatch failed.");
            }
        } catch (err) {
            console.error("Dispatch failed:", err);
            const formatted = err.response?.data?.error || err.message || "Unable to record dispatch.";
            setSubmitError(formatted);
            setChainNotice(formatted);
        } finally {
            setDispatchLoading(false);
            setLoading("");
        }
    };


    const handleBack = () => {
        navigate(-1)
    }

    const handleImage = async (e) => {
        setImage({
            ...image,
            file: e.target.files[0],
            filepreview: URL.createObjectURL(e.target.files[0])
        })
    }

    const getUsername = async (e) => {
        await axios.get(`/profile/${auth.username}`)
            .then(res => {
                setManuName(res?.data[0].name);

            })
    }


    // to upload image
    const uploadImage = async (image) => {
        const file = image?.file;
        if (!file || (Array.isArray(file) && file.length === 0) || !(file instanceof File || file instanceof Blob)) {
            return "";
        }
        const data = new FormData();
        data.append("image", file);

        const res = await axios.post("/upload/product", data, {
            headers: { "Content-Type": "multipart/form-data" }
        });

        if (res.data?.success !== 1) {
            throw new Error(res.data?.error || "Image upload failed");
        }
        return res.data.fileName;
    }

    const registerProduct = async (retry = false) => {
        setLoading("1/3: Preparing product passport and digital asset...");
        setSubmitError("");
        try {
            let imageName = savedImageName;
            if (retry) {
                await axios.post(`/product/${encodeURIComponent(serialNumber)}/retry`);
            } else {
                imageName = await uploadImage(image);
                setSavedImageName(imageName);
                await addProductDB(imageName);
                setProductCreated(true);
            }

            setLoading("2/3: Signing registration via automated facility wallet...");
            const autoRes = await axios.post('/api/custody/auto-execute', {
                serialNumber,
                action: 'register_product',
                name,
                brand,
                description: description.replace(/,/g, ';'),
                image: imageName,
                location: manuLocation,
                manuDate: manuDate.toString(),
            });

            const txHash = autoRes.data?.txHash;
            if (txHash) {
                setLoading("3/3: Finalizing passport record...");
                try {
                    await axios.post(`/product/${encodeURIComponent(serialNumber)}/chain-transaction`, { txHash });
                    setUnpersistedTxHash("");
                } catch (_persistenceError) {
                    setUnpersistedTxHash(txHash);
                }

                setLoading("");
                generateQRCode(serialNumber);
                setProductCreated(true);
                setRetryAvailable(false);
                setChainNotice(`Product registered and confirmed on ${CHAIN_NAME} via the facility wallet. Packaging QR code generated.`);

                if (autoDispatchOnCreate) {
                    setLoading("Auto-dispatching product into distribution transit (Open Dispatch)...");
                    try {
                        await axios.post('/api/custody/auto-execute', {
                            serialNumber,
                            action: 'dispatch',
                            location: manuLocation,
                            recipientWallet: ethers.ZeroAddress,
                        });
                        setIsDispatched(true);
                        setChainNotice("✅ Product successfully registered AND dispatched to distribution network! Packaging QR tag generated.");
                    } catch (_dispatchErr) {
                        console.warn("Auto-dispatch warning:", _dispatchErr.message);
                        setChainNotice("Product registered on blockchain! Automatic dispatch could not complete; you can click '1-Click Dispatch' below.");
                    }
                    setLoading("");
                }
                return txHash;
            } else {
                throw new Error(autoRes.data?.error || "Registration could not be completed by facility wallet.");
            }
        } catch (err) {
            console.error("Product registration error:", err);
            const errMsg = err.response?.data?.error || err.message || "Product registration failed.";
            setSubmitError(errMsg);
            setChainNotice(errMsg);
            setRetryAvailable(true);
            throw err;
        } finally {
            setLoading("");
        }
    };

    const addProductDB = async (imageName) => {
        const profileData = JSON.stringify({
            "serialNumber": serialNumber,
            "name": name,
            "brand": brand,
            "description": description.replace(/,/g, ';'),
            "image": imageName,
            "actor": manuName,
            "location": manuLocation,
            "timestamp": manuDate.toString(),
        });
        const res = await axios.post('/addproduct', profileData, {
            headers: { 'Content-Type': 'application/json' },
        });
        return res.data;
    }

    const checkUnique = async () => {
        try {
            const res = await axios.get("/product/serialNumber");

            const existingSerialNumbers = res.data.map((product) => product.serialnumber);
            const isDuplicate = existingSerialNumbers.includes(serialNumber);

            setIsUnique(!isDuplicate);
            return !isDuplicate; // return result to be used in handleSubmit
        } catch (_err) {
            setSubmitError("Unable to verify the serial number uniqueness. Please check your network connection and try again.");
            return false;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError("");

        if (!serialNumber || !name || !brand) {
            setSubmitError("Please fill in the product serial number, name, and brand.");
            return;
        }

        try {
            if (productCreated && !retryAvailable) {
                await refreshChainStatus();
                return;
            }
            if (!retryAvailable) {
                const unique = await checkUnique();
                if (!unique) {
                    setSubmitError("This product serial number already exists on the registry. Please enter or generate a unique one.");
                    return;
                }
            }
            setLoading(retryAvailable ? "Retrying product registration..." : "Registering product on blockchain...");
            await registerProduct(retryAvailable);
        } catch (err) {
            const friendlyMessage = formatContractError(err, "Registration did not complete. The transaction was either rejected or failed on the blockchain.");
            try {
                if (productCreated && !qrData) {
                    await axios.post(`/product/${encodeURIComponent(serialNumber)}/failed`, {
                        reason: friendlyMessage
                    }).catch(() => { });
                    await refreshChainStatus();
                }
            } catch (_statusError) { setChainNotice('Unable to read the latest registration status. Please refresh before retrying.'); }
            setLoading("");
            setSubmitError(friendlyMessage);
            setChainNotice(friendlyMessage);
            setRetryAvailable(true);
        }
    };

    const refreshChainStatus = async () => {
        const response = await axios.get(`/product/${encodeURIComponent(serialNumber)}/chain-status`);
        const status = response.data.chain_status;
        setChainNotice(`Registration status: ${status}${response.data.failure_reason ? ` — ${response.data.failure_reason}` : ''}`);
        setRetryAvailable(status === 'needs_retry' || status === 'failed');
        setProductCreated(true);
        await loadRetryableProducts();
        return status;
    };

    const persistTransactionHash = async () => {
        if (!unpersistedTxHash) return;
        try {
            await axios.post(`/product/${encodeURIComponent(serialNumber)}/chain-transaction`, { txHash: unpersistedTxHash });
            setUnpersistedTxHash("");
            setChainNotice("Transaction hash saved. The server will verify its receipt and registration event.");
        } catch (error) {
            setChainNotice(`Hash is still not saved: ${error.response?.data?.error || error.message}`);
        }
    };


    return (
        <DashboardShell>
            <GreetingBanner
                title="Register Product"
                subtitle="Create a verified on-chain product record and generate packaging QR passport"
                metrics={[
                    {
                        icon: <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>ID</span>,
                        value: serialNumber ? `${serialNumber.slice(0, 18)}…` : 'Generating…',
                        label: 'Serial Identifier',
                    },
                    {
                        icon: <span style={{ color: '#10B981', fontWeight: 700 }}>EVM</span>,
                        value: 'Sepolia',
                        label: 'Target Ledger',
                    },
                    {
                        icon: <span style={{ color: '#9333EA', fontWeight: 700 }}>GPS</span>,
                        value: manuLocation ? 'Detected' : 'Manual',
                        label: 'Factory Location',
                    },
                ]}
            />

            {retryableProducts.length > 0 && (
                <div className="dashboard-card" style={{ padding: '16px 24px', backgroundColor: 'var(--status-purple-bg)', borderColor: '#D8B4FE' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 700, color: 'var(--status-purple-text)' }}>
                        Recoverable Registrations Pending
                    </h3>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {retryableProducts.map((product) => (
                            <button
                                key={product.serialnumber}
                                type="button"
                                className="btn-secondary-action"
                                onClick={() => resumeProductRetry(product)}
                                style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                                {product.serialnumber.slice(0, 16)}... — ({product.chain_status}) · Resume
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {chainNotice && (
                <div style={{ padding: '12px 18px', borderRadius: '10px', backgroundColor: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)', fontSize: '13px', color: 'var(--color-text-main)' }}>
                    {chainNotice}
                </div>
            )}

            {unpersistedTxHash && (
                <div style={{ padding: '12px 18px', borderRadius: '10px', backgroundColor: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Unsaved Tx Hash: {unpersistedTxHash.slice(0, 18)}...</span>
                    <button type="button" className="btn-secondary-action" onClick={persistTransactionHash}>
                        Retry Saving Hash
                    </button>
                </div>
            )}

            {productCreated && qrData ? (
                <div className="dashboard-grid-dual" style={{ width: '100%' }}>
                    {/* Left Column: Product Confirmation Card */}
                    <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="status-pill pill-green" style={{ fontSize: '13px', padding: '6px 14px' }}>
                                ✅ Cryptographic Passport Minted
                            </span>
                        </div>

                        <div>
                            <h2 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                {name || 'Registered Product'}
                            </h2>
                            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                Brand: <strong style={{ color: 'var(--color-text-main)' }}>{brand || '—'}</strong>
                            </p>
                        </div>

                        <div style={{ background: 'var(--color-surface-subtle)', padding: '14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                Serial Number
                            </span>
                            <code style={{ fontSize: '13px', color: 'var(--color-text-main)', wordBreak: 'break-all' }}>
                                {serialNumber}
                            </code>
                        </div>

                        {description && (
                            <div>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                    Product Description
                                </span>
                                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--color-text-main)', lineHeight: 1.4 }}>
                                    {description}
                                </p>
                            </div>
                        )}

                        <div style={{ background: 'var(--color-surface-subtle)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                                Origin Location
                            </span>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-main)' }}>
                                {manuLocation.replace(/;/g, ', ') || 'Registered Facility'}
                            </p>
                        </div>

                        {image.filepreview && (
                            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border)', maxHeight: 180, display: 'flex', justifyContent: 'center' }}>
                                <img src={image.filepreview} alt="Product preview" style={{ maxWidth: '100%', objectFit: 'contain' }} />
                            </div>
                        )}

                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12 }}>
                            <button
                                type="button"
                                className="btn-secondary-action"
                                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}
                                onClick={() => navigate(`/product-details/${encodeURIComponent(serialNumber)}`)}
                            >
                                🔍 View Complete Product Passport
                            </button>
                            <button
                                type="button"
                                className="btn-primary-action"
                                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px', backgroundColor: '#059669' }}
                                onClick={resetForm}
                                disabled={loading !== "" || dispatchLoading}
                            >
                                + Register Another Product
                            </button>
                            <button
                                type="button"
                                className="btn-secondary-action"
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={() => navigate('/manufacturer')}
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Packaging QR Tag & Dispatch Action */}
                    <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ background: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Official Packaging QR Tag
                                </Typography>
                                <span className={`status-pill ${isDispatched ? 'pill-orange' : 'pill-green'}`} style={{ fontSize: '11px' }}>
                                    {isDispatched ? 'Consignment In Transit' : 'Manufactured'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, background: '#FFFFFF', padding: 14, borderRadius: 10, width: 'fit-content', margin: '0 auto 14px auto', border: '1px solid var(--color-border)' }}>
                                <QRCode value={qrData} id="QRCode" size={160} />
                            </div>
                            <Button variant="outlined" fullWidth onClick={downloadQR} sx={{ textTransform: 'none', borderRadius: '10px', mb: 1 }}>
                                Download High-Res PNG Label
                            </Button>
                            <Button
                                variant="outlined"
                                fullWidth
                                onClick={() => setIsLabelModalOpen(true)}
                                sx={{
                                    textTransform: 'none',
                                    borderRadius: '10px',
                                    mb: 1.5,
                                    borderColor: '#3B82F6',
                                    color: '#1D4ED8',
                                    fontWeight: 600,
                                    '&:hover': { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' }
                                }}
                            >
                                Print 4×6″ Packaging Label
                            </Button>

                            {!isDispatched ? (
                                <div style={{ marginTop: 10 }}>
                                    <div style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', fontSize: '12.5px', marginBottom: 10, textAlign: 'left' }}>
                                        <strong>Ready for Logistics:</strong> Dispatch this item into the distribution network for downstream partner receipt.
                                    </div>
                                    <Button
                                        variant="contained"
                                        fullWidth
                                        onClick={handleDispatchProduct}
                                        disabled={loading !== "" || dispatchLoading}
                                        sx={{
                                            py: 1.2,
                                            backgroundColor: '#2563EB',
                                            fontWeight: 700,
                                            textTransform: 'none',
                                            borderRadius: '10px',
                                            '&:hover': { backgroundColor: '#1D4ED8' }
                                        }}
                                    >
                                        {dispatchLoading ? (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <CircularProgress size={16} color="inherit" />
                                                Signing Outbound Dispatch…
                                            </span>
                                        ) : (
                                            'Dispatch to Distribution Network'
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 }}>
                                    <span>Consignment Dispatched & In Transit</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    <div className="dashboard-grid-dual">
                        {/* Left Column: Product Metadata */}
                        <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                Product Details
                            </h2>

                            <TextField
                                fullWidth
                                error={!isUnique}
                                helperText={!isUnique ? "Serial Number already exists" : ""}
                                id="outlined-basic"
                                label="Serial Number"
                                variant="outlined"
                                InputProps={{ readOnly: true }}
                                value={serialNumber}
                            />

                            <TextField
                                fullWidth
                                id="outlined-name"
                                label="Product Name"
                                variant="outlined"
                                required
                                onChange={(e) => setName(e.target.value)}
                                value={name}
                            />

                            <TextField
                                fullWidth
                                id="outlined-brand"
                                label="Brand"
                                variant="outlined"
                                required
                                onChange={(e) => setBrand(e.target.value)}
                                value={brand}
                            />

                            <TextField
                                fullWidth
                                id="outlined-description"
                                label="Description"
                                variant="outlined"
                                multiline
                                minRows={3}
                                onChange={(e) => setDescription(e.target.value)}
                                value={description}
                            />

                            <div>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                                    Product Image Asset
                                </label>
                                <Button variant="outlined" component="label" fullWidth sx={{ textTransform: 'none', borderRadius: '10px', padding: '10px' }}>
                                    Choose Image File
                                    <input type="file" hidden accept="image/*" onChange={handleImage} />
                                </Button>
                                {image.filepreview && (
                                    <div style={{ marginTop: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border)', maxHeight: 200, display: 'flex', justifyContent: 'center' }}>
                                        <img src={image.filepreview} alt="Product preview" style={{ maxWidth: '100%', objectFit: 'contain' }} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Location, Packaging QR & Minting */}
                        <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                Manufacturing Details
                            </h2>

                            <TextField
                                fullWidth
                                label="Facility Location"
                                value={manuLocation.replace(/;/g, ',')}
                                onChange={(event) => {
                                    isLocationManuallyEditedRef.current = true;
                                    setManuLocation(event.target.value.replace(/,/g, ';'));
                                }}
                                helperText={chainNotice && chainNotice.includes('Location') ? chainNotice : "Recorded with this on-chain registration"}
                            />

                            <Button
                                type="button"
                                variant="text"
                                fullWidth
                                onClick={handleDetectLocation}
                                sx={{ textTransform: 'none', fontWeight: 600, color: 'var(--color-primary)' }}
                                disabled={isDetectingLocation}
                            >
                                {isDetectingLocation ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <CircularProgress size={14} color="inherit" />
                                        Detecting Location…
                                    </span>
                                ) : (
                                    'Detect Location'
                                )}
                            </Button>

                            {/* Optional Auto-Dispatch Card */}
                            {!productCreated && (
                                <div style={{
                                    padding: '12px 14px',
                                    borderRadius: '10px',
                                    backgroundColor: 'var(--color-surface-subtle, #F8FAFC)',
                                    border: '1px solid var(--color-border, #E2E8F0)',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '10px',
                                }}>
                                    <input
                                        type="checkbox"
                                        id="autoDispatchToggle"
                                        checked={autoDispatchOnCreate}
                                        onChange={(e) => setAutoDispatchOnCreate(e.target.checked)}
                                        style={{ marginTop: '2px', width: '16px', height: '16px', cursor: 'pointer' }}
                                        disabled={loading !== ""}
                                    />
                                    <label htmlFor="autoDispatchToggle" style={{ cursor: 'pointer', fontSize: '13px' }}>
                                        <strong style={{ color: 'var(--color-text-main)', display: 'block', marginBottom: '2px' }}>
                                            Auto-Dispatch for Distribution
                                        </strong>
                                        <span style={{ color: 'var(--color-text-secondary)', lineHeight: 1.35, display: 'block', fontSize: '12px' }}>
                                            Immediately transitions item into transit (Open Dispatch) so downstream partners can accept custody without separate re-scanning.
                                        </span>
                                    </label>
                                </div>
                            )}

                            {submitError && (
                                <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', color: '#EF4444', fontSize: '13px', fontWeight: 600 }}>
                                    ⚠️ {submitError}
                                </div>
                            )}

                            {loading && (
                                <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: 'var(--color-primary-subtle)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontSize: '13px', textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <CircularProgress size={16} sx={{ color: 'var(--color-primary)' }} />
                                    {loading}
                                </div>
                            )}

                            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <button
                                    type="submit"
                                    className="btn-primary-action"
                                    style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '14px' }}
                                    disabled={loading !== ""}
                                >
                                    {retryAvailable ? "Retry Registration" : "Register Product"}
                                </button>

                                {productCreated && !qrData && (
                                    <button
                                        type="button"
                                        className="btn-secondary-action"
                                        style={{ width: '100%', justifyContent: 'center', borderColor: '#EF4444', color: '#EF4444' }}
                                        onClick={handleDiscardDraft}
                                        disabled={loading !== ""}
                                    >
                                        Discard Draft Registration
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className="btn-secondary-action"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={handleBack}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            <ThermalPackagingLabelModal
                open={isLabelModalOpen}
                onClose={() => setIsLabelModalOpen(false)}
                serialNumber={serialNumber}
                name={name}
                brand={brand}
                location={manuLocation}
                date={manuDate}
                qrData={qrData}
                contractAddress={CONTRACT_ADDRESS}
            />
        </DashboardShell>
    );
}

export default AddProduct;
