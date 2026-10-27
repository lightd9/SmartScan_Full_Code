import { Box, Paper, Typography, TextField, Button } from '@mui/material';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import '../shell/shell.css';
import { useEffect, useState } from 'react';
import { ethers } from "ethers";
import axios from '../../api/axios';
import QRCode from 'qrcode.react';
import dayjs from 'dayjs';
import useAuth from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import Geocode from "react-geocode";
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_ID_HEX, CHAIN_NAME, CHAIN_RPC_URL, BLOCK_EXPLORER_URL, NATIVE_CURRENCY_NAME, NATIVE_CURRENCY_SYMBOL, NATIVE_CURRENCY_DECIMALS } from '../../config/contract';

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
    const [isUnique, setIsUnique] = useState(true);
    const [productCreated, setProductCreated] = useState(false);
    const [retryAvailable, setRetryAvailable] = useState(false);
    const [savedImageName, setSavedImageName] = useState("");
    const [unpersistedTxHash, setUnpersistedTxHash] = useState("");
    const [chainNotice, setChainNotice] = useState("");
    const [retryableProducts, setRetryableProducts] = useState([]);

    const { auth } = useAuth();
    const navigate = useNavigate();
    
    useEffect(() => {
        setManuDate(dayjs().unix());
        getUsername();
        loadRetryableProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadRetryableProducts = async () => {
        try {
            const [retryable, failed] = await Promise.all([
                axios.get('/product/chain-status?status=needs_retry'),
                axios.get('/product/chain-status?status=failed'),
            ]);
            const products = [...retryable.data, ...failed.data];
            setRetryableProducts(products);
        } catch (_error) {
            setChainNotice('Unable to load recoverable registrations. Refresh before starting another registration.');
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
        setChainNotice(`Product ${product.serialnumber} is recoverable after ${product.chain_status}.`);
        setImage({ file: [], filepreview: null });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        const apiKey = process.env.REACT_APP_GEOCODING_API_KEY;
        if (!apiKey || manuLatitude === '' || manuLongtitude === '') {
            if (manuLatitude !== '' && manuLongtitude !== '' && !apiKey) {
                setChainNotice('Coordinates were received, but address lookup is not configured. Enter the location manually; browser location is unverified.');
            }
            return;
        }
        Geocode.setApiKey(apiKey);

        Geocode.fromLatLng(manuLatitude, manuLongtitude).then(
            (response) => {
              const address = response.results[0].formatted_address;
              setManuLocation(address.replace(/,/g, ';'));
              setChainNotice('Approximate browser-reported location resolved. Review or edit it before submitting; it is unverified.');
            },
            () => setChainNotice('Unable to resolve your location. Check location permission and enter the business location manually.')
          );

    }, [manuLatitude, manuLongtitude]);

    const generateQRCode = async (serialNumber) => {
        // const qrCode = await productContract.getProduct(serialNumber);
        const data = CONTRACT_ADDRESS + ',' + serialNumber
        setQrData(data);

    }

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
        if (!image?.file) {
            return "";
        }
        const data = new FormData();
        data.append("image", image.file);

        const res = await axios.post("/upload/product", data, {
            headers: { "Content-Type": "multipart/form-data" }
        });

        if (res.data?.success !== 1) {
            throw new Error("Image upload failed");
        }
        return res.data.fileName;
    }

const registerProduct = async (retry = false) => {

    try {
        const { ethereum } = window;

        if (ethereum) {
            // 🔥 Request account access FIRST
            const accounts = await ethereum.request({ method: "eth_requestAccounts" });
            const account = accounts[0];

            const provider = new ethers.BrowserProvider(ethereum);
            const signer = await provider.getSigner();
            const productContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

            await axios.post('/wallet/authorize-write', {
                walletAddress: account,
                action: 'register_product',
            });
            let imageName = savedImageName;
            if (retry) {
                await axios.post(`/product/${encodeURIComponent(serialNumber)}/retry`);
            } else {
                imageName = await uploadImage(image);
                setSavedImageName(imageName);
                await addProductDB(imageName);
                setProductCreated(true);
            }
            // write transactions
            const registerTxn = await productContract.registerProduct(
                name,
                brand,
                serialNumber,
                description.replace(/,/g, ';'),
                imageName,
                manuName,
                manuLocation,
                manuDate.toString()
            );

            setLoading(`Mining (Register Product) ... ${registerTxn.hash}`);

            try {
                await axios.post(`/product/${encodeURIComponent(serialNumber)}/chain-transaction`, { txHash: registerTxn.hash });
                setUnpersistedTxHash("");
            } catch (_persistenceError) {
                setUnpersistedTxHash(registerTxn.hash);
                setChainNotice(`Transaction was submitted (${registerTxn.hash}), but its hash has not yet been saved by the server. Retry saving it while this page remains open.`);
            }

            await registerTxn.wait();
            setLoading(`Mined (Register Product) -- ${registerTxn.hash}`);

            generateQRCode(serialNumber);
            setProductCreated(true);
            setRetryAvailable(false);
            setChainNotice("The transaction has a successful receipt. SmartScan will verify the chain, sender and ProductRegistered event before marking it confirmed.");

            setLoading("");
            return registerTxn.hash;

        } else {
            throw new Error("MetaMask not detected");
        }
    } catch (error) {
            throw error;
    }
};

    const getCurrentTimeLocation = () => {
        setManuDate(dayjs().unix());
        setChainNotice('Requesting optional browser location…');
        if (!navigator.geolocation) {
            setChainNotice('Location is unavailable in this browser. Enter the business location manually if needed.');
            return;
        }
        navigator.geolocation.getCurrentPosition((position) => {
            setManuLatitude(position.coords.latitude);
            setManuLongtitude(position.coords.longitude);
          }, () => {
            setChainNotice('Location permission was not granted or could not be read. Enter the business location manually if needed.');
          }, { maximumAge: 60000, timeout: 10000 });
    }   

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
            headers: {'Content-Type': 'application/json'},
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
        alert("Unable to verify the serial number. Please try again.");
        return false;
    }
};

const switchToConfiguredNetwork = async () => {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CHAIN_ID_HEX }],
        });
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: CHAIN_ID_HEX,
                        chainName: CHAIN_NAME,
                        nativeCurrency: {
                            name: NATIVE_CURRENCY_NAME,
                            symbol: NATIVE_CURRENCY_SYMBOL,
                            decimals: NATIVE_CURRENCY_DECIMALS,
                        },
                        rpcUrls: [CHAIN_RPC_URL],
                        blockExplorerUrls: [BLOCK_EXPLORER_URL],
                    }],
                });
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: CHAIN_ID_HEX }],
                });
            } catch (addError) {
                throw new Error(`Failed to switch to ${CHAIN_NAME}: ${addError.message}`);
            }
        } else {
            throw new Error(`Failed to switch to ${CHAIN_NAME}: ${switchError.message}`);
        }
    }
};



const handleSubmit = async (e) => {
    e.preventDefault();

    if (!serialNumber || !name || !brand) {
        alert("Please fill in the serial number, name and brand.");
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
                alert("Serial number already exists. Please enter a unique one.");
                return;
            }
        }
        setLoading(retryAvailable ? "Retrying product registration..." : "Please confirm the transaction in your wallet...");
        await switchToConfiguredNetwork();
        await registerProduct(retryAvailable);
    } catch (err) {
        try {
            if (productCreated) await refreshChainStatus();
        } catch (_statusError) { setChainNotice('Unable to read the latest registration status. Please refresh before retrying.'); }
        setLoading("");
        setChainNotice(err?.message || "Registration did not complete. The server will reconcile any transaction that was submitted.");
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
                title="Product Minting & Packaging Studio"
                subtitle="Register physical assets to the IdenteefiV2 smart contract"
                metrics={[
                    {
                        icon: <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>SS</span>,
                        value: serialNumber.slice(0, 15) + '...',
                        label: 'Active Identifier',
                    },
                    {
                        icon: <span style={{ color: '#10B981', fontWeight: 700 }}>EVM</span>,
                        value: 'IdenteefiV2',
                        label: 'Smart Contract',
                    },
                    {
                        icon: <span style={{ color: '#9333EA', fontWeight: 700 }}>GPS</span>,
                        value: manuLocation ? 'Resolved' : 'Manual',
                        label: 'Location Audit',
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

            <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                <div className="dashboard-grid-dual">
                    {/* Left Column: Product Metadata */}
                    <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                            Product Specifications
                        </h2>

                        <TextField
                            fullWidth
                            error={!isUnique}
                            helperText={!isUnique ? "Serial Number already exists" : ""}
                            id="outlined-basic"
                            label="Canonical Serial Number (Immutable)"
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
                            Provenance & Ledger Signer
                        </h2>

                        <TextField
                            fullWidth
                            label="Business / Factory Location"
                            value={manuLocation}
                            onChange={(event) => setManuLocation(event.target.value.replace(/,/g, ';'))}
                            helperText="Optional. Browser location is unverified; you can edit or enter it manually."
                        />

                        <Button type="button" variant="text" fullWidth onClick={getCurrentTimeLocation} sx={{ textTransform: 'none' }}>
                            📍 Detect Current Coordinates (Browser GPS)
                        </Button>

                        {/* QR Code Preview & Download */}
                        {qrData && (
                            <div style={{ background: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 18, textAlign: 'center' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                                    Generated Packaging QR Tag
                                </Typography>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                                    <QRCode value={qrData} id="QRCode" size={160} />
                                </div>
                                <Button variant="outlined" fullWidth onClick={downloadQR} sx={{ textTransform: 'none', borderRadius: '10px' }}>
                                    Download High-Res PNG Label
                                </Button>
                            </div>
                        )}

                        {loading && (
                            <div style={{ padding: '12px', borderRadius: 8, backgroundColor: 'var(--color-primary-subtle)', color: 'var(--color-primary)', fontSize: '13px', textAlign: 'center', fontWeight: 600 }}>
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
                                {productCreated && !retryAvailable ? "Refresh Registration Status" : retryAvailable ? "Retry Blockchain Registration" : "Sign & Register on Blockchain"}
                            </button>

                            <button
                                type="button"
                                className="btn-secondary-action"
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={handleBack}
                            >
                                Cancel & Return to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </DashboardShell>
    );
}

export default AddProduct;
