import { Box, Paper, Typography, Alert, TextField, Button } from '@mui/material';
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
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../config/contract';
import { formatScanWarning } from '../../api/scanEvents';

const UpdateProductDetails = () => {

    const [currDate, setCurrDate] = useState('');
    const [currLatitude, setCurrLatitude] = useState("");
    const [currLongtitude, setCurrLongtitude] = useState("");
    const [currName, setCurrName] = useState("");
    const [currLocation, setCurrLocation] = useState("");
    const [serialNumber, setSerialNumber] = useState("");
    const [loading, setLoading] = useState("");
    const [recipientAddress, setRecipientAddress] = useState("");
    const [recallReason, setRecallReason] = useState("");


    const { auth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const qrData = location.state?.qrData;
    const scanWarnings = location.state?.warnings || [];


    useEffect(() => {
        if (!qrData) {
            navigate('/scanner', { replace: true });
            return;
        }

        const data = qrData.split(",");
        setSerialNumber(data[1]);
    }, [qrData, navigate]);

    useEffect(() => {

        setCurrDate(dayjs().unix());
        getUsername();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    useEffect(() => {
        const apiKey = process.env.REACT_APP_GEOCODING_API_KEY;
        if (!apiKey || currLatitude === '' || currLongtitude === '') {
            if (currLatitude !== '' && currLongtitude !== '' && !apiKey) {
                setLoading('Coordinates were received, but address lookup is not configured. Enter the location manually; browser location is unverified.');
            }
            return;
        }
        Geocode.setApiKey(apiKey);

        Geocode.fromLatLng(currLatitude, currLongtitude).then(
            (response) => {
                const address = response.results[0].formatted_address;
                setCurrLocation(address.replace(/,/g, ';'));
                setLoading('Approximate browser-reported location resolved. Review or edit it before submitting; it is unverified.');
            },
            () => setLoading('Unable to resolve your location. Check permission and enter it manually.')
        ).catch(() => setLoading('Unable to resolve your location. Check permission and enter it manually.'));

    }, [currLatitude, currLongtitude]);

    const getCurrentTimeLocation = () => {
        setCurrDate(dayjs().unix());
        setLoading('Requesting optional browser location…');
        if (!navigator.geolocation) {
            setLoading('Location is unavailable in this browser. Enter the business location manually if needed.');
            return;
        }
        navigator.geolocation.getCurrentPosition((position) => {
            setCurrLatitude(position.coords.latitude);
            setCurrLongtitude(position.coords.longitude);
        }, () => setLoading('Location permission was not granted or could not be read. Enter the business location manually if needed.'),
        { maximumAge: 60000, timeout: 10000 });
    }

       

    const getUsername = async (e) => {
        await axios.get(`/profile/${auth.username}`)
            .then(res => {
                setCurrName(res?.data[0].name);

            })
    }

    const updateProduct = async (e) => {
        e.preventDefault();

        try {
            const { ethereum } = window;

            if (ethereum) {
                const provider = new ethers.BrowserProvider(ethereum);
                const signer = await provider.getSigner();
                const productContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                const wallet = (await signer.getAddress()).toLowerCase();
                const [stage, custodian, pendingRecipient] = await productContract.getProductState(serialNumber);
                const currentStage = Number(stage);
                let transaction;

                if (currentStage === 2 && pendingRecipient.toLowerCase() === wallet) {
                    await axios.post('/wallet/authorize-write', { walletAddress: wallet, action: 'confirm_delivery' });
                    transaction = await productContract.confirmDelivery(serialNumber, currName, currLocation, currDate.toString());
                } else if (currentStage === 1 || currentStage === 3) {
                    if (custodian.toLowerCase() !== wallet) throw new Error("Connect the wallet currently recorded as custodian.");
                    if (auth.role === "retailer") {
                        await axios.post('/wallet/authorize-write', { walletAddress: wallet, action: 'mark_sold' });
                        transaction = await productContract.markSold(serialNumber, currName, currLocation, currDate.toString());
                    } else {
                        if (!ethers.isAddress(recipientAddress)) throw new Error("Enter a valid recipient wallet address.");
                        await axios.post('/wallet/authorize-write', { walletAddress: wallet, action: 'dispatch' });
                        transaction = await productContract.dispatchProduct(serialNumber, recipientAddress, currName, currLocation, currDate.toString());
                    }
                } else {
                    throw new Error("This product is not ready for an action by this account.");
                }
                setLoading(`Transaction submitted: ${transaction.hash}`);
                await transaction.wait();
                setLoading("Custody event confirmed on the blockchain.");

            } else {
                setLoading('Install or enable a wallet to submit a custody action.');
            }
        } catch (error) {
            setLoading(error.message || 'Unable to submit the custody action.');
        }
    }

    const handleRecall = async () => {
        try {
            if (!recallReason.trim()) throw new Error("Enter a recall reason.");
            const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            await axios.post('/wallet/authorize-write', {
                walletAddress: await signer.getAddress(),
                action: 'recall',
            });
            const transaction = await contract.recallProduct(serialNumber, recallReason, currName, currLocation, currDate.toString());
            setLoading(`Recall submitted: ${transaction.hash}`);
            await transaction.wait();
            setLoading("Recall recorded. Verification scans will show a recall warning.");
        } catch (error) {
            setLoading(error.message || "Unable to record recall.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading("Please pay the transaction fee to update the product details...")
        await updateProduct(e);


    }

    const handleBack = () => {
        navigate(-1)
    }


    return (
        <DashboardShell>
            <GreetingBanner
                title="Update Physical Custody & Transition"
                subtitle="Execute smart contract state changes: Confirm Delivery, Dispatch, or Mark Sold"
                metrics={[
                    {
                        icon: <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>ID</span>,
                        value: serialNumber ? serialNumber.slice(0, 14) + '...' : 'Unknown',
                        label: 'Active Identifier',
                    },
                    {
                        icon: <span style={{ color: '#10B981', fontWeight: 700 }}>ROLE</span>,
                        value: (auth.role || 'Partner').toUpperCase(),
                        label: 'Signing Role',
                    },
                    {
                        icon: <span style={{ color: '#9333EA', fontWeight: 700 }}>TIME</span>,
                        value: dayjs(currDate * 1000).format("h:mm A"),
                        label: 'Timestamp',
                    },
                ]}
            />

            {scanWarnings.map((warning) => <Alert key={warning} severity="warning" sx={{ mb: 1 }}>{formatScanWarning(warning)}</Alert>)}

            <div className="dashboard-grid-dual">
                {/* Left Card: Custody Action Form */}
                <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h2 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        Custody Handover Execution
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
                        helperText="Recorded with this on-chain event."
                    />

                    <Button type="button" fullWidth variant="text" onClick={getCurrentTimeLocation} sx={{ textTransform: 'none' }}>
                        📍 Detect Browser Location
                    </Button>

                    <TextField
                        fullWidth
                        label="Effective Blockchain Timestamp"
                        disabled
                        value={dayjs(currDate * 1000).format("MMMM D, YYYY h:mm A")}
                    />

                    {(auth.role === "manufacturer" || auth.role === "supplier") && (
                        <TextField
                            fullWidth
                            label="Recipient Wallet Address (0x...)"
                            value={recipientAddress}
                            onChange={(event) => setRecipientAddress(event.target.value)}
                            helperText="Verified wallet address of the receiving carrier or retailer."
                        />
                    )}

                    {loading && (
                        <div style={{ padding: '12px', borderRadius: 8, backgroundColor: 'var(--color-primary-subtle)', color: 'var(--color-primary)', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
                            {loading}
                        </div>
                    )}

                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button
                            type="button"
                            className="btn-primary-action"
                            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                            onClick={handleSubmit}
                        >
                            Sign & Submit Custody Action
                        </button>

                        <button
                            type="button"
                            className="btn-secondary-action"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={handleBack}
                        >
                            Cancel & Return
                        </button>
                    </div>
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
                            >
                                Execute On-Chain Recall
                            </button>
                        </div>
                    ) : (
                        <div style={{ background: 'var(--color-surface-subtle)', borderRadius: 12, padding: 18, border: '1px solid var(--color-border)' }}>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                Custody Authorization Rules
                            </h3>
                            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                                <li><strong>Manufacturer $\rightarrow$ Supplier:</strong> Dispatch requires valid Supplier role wallet.</li>
                                <li><strong>Supplier Inbound:</strong> Delivery confirmation moves item into Supplier storage.</li>
                                <li><strong>Supplier $\rightarrow$ Retailer:</strong> Dispatch requires verified Retailer address.</li>
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
