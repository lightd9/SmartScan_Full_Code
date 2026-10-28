import { Box, Paper, Avatar, Typography, Button, Alert } from '@mui/material';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import '../shell/shell.css';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineOppositeContent, {
    timelineOppositeContentClasses,
} from '@mui/lab/TimelineOppositeContent';
import dayjs from 'dayjs';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_ID, CHAIN_RPC_URL } from '../../config/contract';
import { getApiUrl } from '../../api/axios';
import { formatScanWarning } from '../../api/scanEvents';
import { getRegisteredProduct, parseHistoryTimestamp, parseProductQr } from '../../api/productQr';
import { formatContractError } from '../../utils/contractErrors';
import { useScanner } from '../../context/ScannerContext';



const UpdateProduct = () => {
    const { openScanner } = useScanner();
    const ROLE_NAMES = ['Unregistered', 'Admin', 'Manufacturer', 'Supplier', 'Retailer'];
    const [serialNumber, setSerialNumber] = useState("");

    const [name, setName] = useState("P");
    const [brand, setBrand] = useState("");
    const [description, setDescription] = useState("");
    const [history, setHistory] = useState([]);
    const [isSold, setIsSold] = useState(false);
    const [loadError, setLoadError] = useState('');

    const [image, setImage] = useState({
        file: [],
        filepreview: null
    });
    const [manualSerial, setManualSerial] = useState('');

    const navigate = useNavigate();
    const location = useLocation();
    const qrData = location.state?.qrData;
    const scanWarnings = location.state?.warnings || [];

    useEffect(() => {

        if (qrData) {
            handleScan(qrData)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qrData]);

    const getImage = async (imageName) => {
        setImage(prevState => ({
            ...prevState,
            filepreview: getApiUrl(`/file/product/${encodeURIComponent(imageName)}`)
            })
        )
    }

    const handleScan = async (qrData) => {
        setLoadError('');
        let serial;
        try {
            ({ serialNumber: serial } = parseProductQr(qrData, CONTRACT_ADDRESS));
        } catch (error) {
            setLoadError(formatContractError(error, 'This is not a valid SmartScan product code.'));
            return;
        }
        setSerialNumber(serial);

        try {
            const provider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
            const productContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
            const product = await getRegisteredProduct(productContract, serial);
            setData(product);
        } catch (_error) {
            setLoadError(formatContractError(_error, 'Unable to load the product from the blockchain. Please retry.'));
        }
    };

    const setData = (product) => {
        setSerialNumber(product[0]);
        setName(product[1]);
        setBrand(product[2]);
        setDescription(product[3].replace(/;/g, ","));
        getImage(product[4]);
        setIsSold(Boolean(product[9]));
        setHistory(product[5].map((event) => ({
            id: event.id.toString(),
            actor: event.actor,
            actorWallet: event.actorWallet,
            actorRole: Number(event.actorRole),
            location: event.location.replace(/;/g, ","),
            timestamp: parseHistoryTimestamp(event.timestamp),
            action: Number(event.action),
            recipientWallet: event.recipientWallet,
        })));
    }

    

    const handleBack = () => {
        navigate(-1)
    }


    const getHistory = () => {
        return history.map((item, index) => {
            const date = item.timestamp === null ? 'Unknown date' : dayjs(item.timestamp * 1000).format('MM/DD/YYYY');
            const time = item.timestamp === null ? '' : dayjs(item.timestamp * 1000).format('HH:mm a');

            // if (item.isSold) {
            //     setIsSold(true);
            // }

            return (
                <TimelineItem key={index}>
                    <TimelineOppositeContent color="textSecondary">
                        {time} {date}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                        <TimelineDot />
                        <TimelineConnector />
                    </TimelineSeparator>
                    <TimelineContent sx={{ py: '12px', px: 2 }}>
                        <Typography>Event #{item.id}</Typography>
                        <Typography>Location: {item.location}</Typography>
                        <Typography>Organization identity: {ROLE_NAMES[item.actorRole] || 'Unknown'} · {item.actorWallet}</Typography>
                        {item.actor && <Typography>Registered display name: {item.actor}</Typography>}
                        {item.action === 1 && (item.recipientWallet === ethers.ZeroAddress
                            ? <Typography>Dispatch status: awaiting confirmation by an eligible registered receiver.</Typography>
                            : <Typography>Dispatched to wallet: {item.recipientWallet}</Typography>)}
                        <Typography>Event: {['Manufactured', 'Dispatched', 'Delivered', 'Sold', 'Recalled'][item.action] || 'Unknown'}</Typography>
                    </TimelineContent>
                </TimelineItem>
            );
        });
    }

    const handleSubmit = async (e) => {
        e.preventDefault();;

        navigate('/update-product-details', { state: { qrData, warnings: location.state?.warnings || [] }});
    }
    

    if (loadError) {
        return (
            <DashboardShell>
                <div className="dashboard-card" style={{ maxWidth: 500, margin: '40px auto', padding: 24, textAlign: 'center' }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px 0' }}>Product Verification Unavailable</h2>
                    {scanWarnings.map((warning) => <Alert key={warning} severity="warning" sx={{ mb: 1, textAlign: 'left' }}>{formatScanWarning(warning)}</Alert>)}
                    <Alert severity="error" sx={{ textAlign: 'left', mb: 2 }}>{loadError}</Alert>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button type="button" className="btn-primary-action" onClick={() => { setLoadError(''); setSerialNumber(''); setManualSerial(''); }}>Try Another Product</button>
                        <button type="button" className="btn-secondary-action" onClick={handleBack}>Back</button>
                    </div>
                </div>
            </DashboardShell>
        );
    }

    if (!qrData && !serialNumber) {
        return (
            <DashboardShell>
                <GreetingBanner
                    title="Custody Chain & Provenance Record"
                    subtitle="Inspect decentralized custody and transfer status"
                />
                <div className="dashboard-card" style={{ maxWidth: 520, margin: '30px auto', padding: 32, textAlign: 'center' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--color-text-main)' }}>
                        Inspect Product Custody
                    </h2>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, margin: '0 0 24px 0', lineHeight: 1.5 }}>
                        Scan an item QR code or enter a product serial identifier to load its on-chain custody history.
                    </p>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (manualSerial.trim()) handleScan(manualSerial.trim());
                        }}
                        style={{ display: 'flex', gap: 10, marginBottom: 16 }}
                    >
                        <input
                            type="text"
                            placeholder="Enter serial (e.g. SS-...)"
                            value={manualSerial}
                            onChange={(e) => setManualSerial(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '10px 14px',
                                borderRadius: 10,
                                border: '1px solid var(--color-border)',
                                fontSize: '13.5px',
                                outline: 'none',
                            }}
                        />
                        <button type="submit" className="btn-primary-action">
                            Load
                        </button>
                    </form>
                    <button
                        type="button"
                        className="btn-secondary-action"
                        onClick={() => openScanner()}
                        style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                    >
                        Open Optical QR Scanner
                    </button>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <GreetingBanner
                title="Custody Chain & Provenance Record"
                subtitle="Review physical custody milestones and dispatch history"
                metrics={[
                    {
                        icon: <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>ID</span>,
                        value: serialNumber ? serialNumber.slice(0, 14) + '...' : 'Unknown',
                        label: 'Canonical Serial',
                    },
                    {
                        icon: <span style={{ color: '#10B981', fontWeight: 700 }}>STATE</span>,
                        value: isSold ? 'Finalized (Sold)' : 'In Circulation',
                        label: 'Product Lifecycle',
                    },
                    {
                        icon: <span style={{ color: '#9333EA', fontWeight: 700 }}>HOPS</span>,
                        value: `${history.length}`,
                        label: 'Chain Events',
                    },
                ]}
            />

            {scanWarnings.map((warning) => <Alert key={warning} severity="warning" sx={{ mb: 1, textAlign: 'left' }}>{formatScanWarning(warning)}</Alert>)}

            <div className="dashboard-grid-dual">
                {/* Left Card: Product Profile */}
                <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <Avatar
                            alt={name}
                            src={image.filepreview}
                            sx={{ width: 84, height: 84, backgroundColor: 'var(--color-primary-subtle)', color: 'var(--color-primary)', borderRadius: '14px', fontSize: 24, fontWeight: 700 }}
                        >
                            {name?.[0]}
                        </Avatar>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--color-text-main)' }}>{name}</h2>
                            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'block', marginTop: 4 }}>Brand: <strong>{brand}</strong></span>
                            <span className={`status-pill ${isSold ? 'blue' : 'green'}`} style={{ marginTop: 8 }}>
                                {isSold ? 'Sold' : 'Active In Supply Chain'}
                            </span>
                        </div>
                    </div>

                    <div style={{ background: 'var(--color-surface-subtle)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--color-border)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Canonical Product Identifier</span>
                        <code style={{ display: 'block', fontSize: '12.5px', marginTop: 4, color: 'var(--color-text-main)', wordBreak: 'break-all' }}>{serialNumber}</code>
                    </div>

                    <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Description</span>
                        <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', color: 'var(--color-text-main)', lineHeight: 1.5 }}>{description || 'No description available.'}</p>
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button type="button" className="btn-primary-action" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={handleSubmit}>
                            Proceed to Update Custody / Dispatch
                        </button>
                        <button type="button" className="btn-secondary-action" style={{ width: '100%', justifyContent: 'center' }} onClick={handleBack}>
                            Back to Scanner
                        </button>
                    </div>
                </div>

                {/* Right Card: Custody Timeline */}
                <div className="dashboard-card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16.5px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        Cryptographic Custody Timeline
                    </h3>
                    <Timeline sx={{ [`& .${timelineOppositeContentClasses.root}`]: { flex: 0.25 }, padding: 0 }}>
                        {getHistory()}
                        <TimelineItem>
                            <TimelineOppositeContent color="textSecondary" sx={{ fontSize: '11.5px' }}>
                                {dayjs().format('HH:mm a')} {dayjs().format('MM/DD/YYYY')}
                            </TimelineOppositeContent>
                            <TimelineSeparator>
                                <TimelineDot color={isSold ? "primary" : "grey"} />
                            </TimelineSeparator>
                            <TimelineContent sx={{ py: '12px', px: 2 }}>
                                <Typography sx={{ fontSize: '13.5px', fontWeight: 600 }}>Current Terminal Status</Typography>
                                <Typography variant="caption" color="text.secondary">Finalized / Sold: {isSold ? 'Yes (Locked)' : 'No (In Circulation)'}</Typography>
                            </TimelineContent>
                        </TimelineItem>
                    </Timeline>
                </div>
            </div>
        </DashboardShell>
    );
}

export default UpdateProduct;
