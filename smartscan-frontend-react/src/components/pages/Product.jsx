import { Box, Paper, Avatar, Typography, Button, Alert, TextField } from '@mui/material';
import bgImg from '../../img/bg.png';
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
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_RPC_URL, assertConfiguredChain } from '../../config/contract';
import { getApiUrl } from '../../api/axios';
import { formatScanWarning } from '../../api/scanEvents';
import { getRegisteredProduct, parseHistoryTimestamp, parseProductQr } from '../../api/productQr';



const Product = () => {
    const ROLE_NAMES = ['Unregistered', 'Admin', 'Manufacturer', 'Supplier', 'Retailer'];
    const [serialNumber, setSerialNumber] = useState("");

    const [name, setName] = useState("P");
    const [brand, setBrand] = useState("");
    const [description, setDescription] = useState("");
    const [history, setHistory] = useState([]);
    const [isSold, setIsSold] = useState(false);
    const [stage, setStage] = useState(0);
    const [custodian, setCustodian] = useState('');
    const [custodianName, setCustodianName] = useState('');
    const [custodianRole, setCustodianRole] = useState(0);
    const [pendingRecipient, setPendingRecipient] = useState(ethers.ZeroAddress);
    const [recordedRetailer, setRecordedRetailer] = useState('');
    const [observedSeller, setObservedSeller] = useState('');
    const [sellerMismatch, setSellerMismatch] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [productLoaded, setProductLoaded] = useState(false);
    const [image, setImage] = useState({
        file: [],
        filepreview: null
    });



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
        setProductLoaded(false);
        let serial;
        try {
            ({ serialNumber: serial } = parseProductQr(qrData, CONTRACT_ADDRESS));
        } catch (error) {
            setLoadError(error.message);
            return;
        }
        setSerialNumber(serial);

            try {
                const provider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
                await assertConfiguredChain(provider);
                const productContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
                    const product = await getRegisteredProduct(productContract, serial);
                    // setProductData(product.toString())
                    // setToUpdate(true);

                    const custodianRole = product[7] === ethers.ZeroAddress
                        ? 0 : Number(await productContract.roles(product[7]));
                    const registeredName = product[7] === ethers.ZeroAddress
                        ? '' : await productContract.businessNames(product[7]);
                    setData(product, custodianRole, registeredName)
                    setProductLoaded(true);

            } catch (error) {
                setLoadError(error.message?.includes('not registered')
                    ? error.message
                    : 'Unable to load the product from the blockchain. Please try again.');
            }
    };

    

    const setData = (product, currentRole, registeredName) => {
        setSerialNumber(product[0]);
        setName(product[1]);
        setBrand(product[2]);
        setDescription(product[3].replace(/;/g, ","));
        getImage(product[4]);
        setIsSold(Boolean(product[9]));
        setStage(Number(product[6]));
        setCustodian(product[7]);
        setPendingRecipient(product[8]);
        setCustodianRole(currentRole);
        setCustodianName(registeredName);
        setRecordedRetailer(currentRole === 4 ? registeredName : '');
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
        navigate(-2)
    }


    const getHistory = () => {
        return history.map((item, index) => {
            const date = item.timestamp === null ? 'Unknown date' : dayjs(item.timestamp * 1000).format('MM/DD/YYYY');
            const time = item.timestamp === null ? '' : dayjs(item.timestamp * 1000).format('HH:mm a');

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

    if (!productLoaded) {
        return <Box sx={{ minHeight: '80vh', display: 'grid', placeItems: 'center', p: 2 }}>
            <Paper elevation={3} sx={{ width: 'min(400px, 100%)', p: 3, backgroundColor: '#e3eefc' }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Product verification</Typography>
                {scanWarnings.map((warning) => <Alert key={warning} severity="warning" sx={{ mb: 1 }}>{formatScanWarning(warning)}</Alert>)}
                {loadError ? <Alert severity="error">{loadError}</Alert> : <Typography role="status">Verifying product on the configured blockchain…</Typography>}
                <Button onClick={handleBack} sx={{ mt: 2 }}>Back</Button>
            </Paper>
        </Box>;
    }


    return (
        <Box sx={{
            backgroundImage: `url(${bgImg})`,
            minHeight: "80vh",
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            zIndex: -2,
            overflowY: "scroll"
        }}>
            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    maxWidth: 540,
                    margin: 'auto',
                    marginTop: '6%',
                    marginBottom: '6%',
                    padding: '36px 32px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '24px',
                    border: '1px solid #ECEEF2',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
                }}
            >
                <Typography
                    variant="body2"
                    sx={{
                        textAlign: 'center',
                        mb: 1.5,
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontWeight: 600,
                        color: loadError ? '#DC2626' : productLoaded ? '#16A34A' : '#6B7280',
                    }}
                >
                    {loadError ? 'Product verification unavailable' : productLoaded ? 'Product record found on the blockchain' : 'Verifying product…'}
                </Typography>
                {loadError && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{loadError}</Alert>}
                <Typography variant="body2" sx={{ textAlign: 'center', mb: 2, color: '#6B7280', fontSize: '0.875rem' }}>
                    Compare the latest recorded retailer and custody history with the seller and purchase location.
                </Typography>
                {scanWarnings.map((warning) => <Alert key={warning} severity="warning" sx={{ mb: 1, borderRadius: '12px' }}>{formatScanWarning(warning)}</Alert>)}
                {stage === 5 && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>This product is recalled. Do not purchase or use it.</Alert>}
                {stage === 2 && (pendingRecipient !== ethers.ZeroAddress
                    ? <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>In transit to the designated registered wallet: {pendingRecipient}</Alert>
                    : <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>Dispatched and awaiting receipt. The next eligible registered supplier or retailer must confirm custody from their linked wallet.</Alert>)}
                {stage === 2 && custodian && <Typography variant="body2" sx={{ mb: 2, color: '#4B5563' }}>Last confirmed custodian: {custodianName || `${ROLE_NAMES[custodianRole] || 'Registered business'} · ${custodian}`}</Typography>}
                {recordedRetailer ? (
                    <>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>Recorded retailer: {recordedRetailer}</Typography>
                        <TextField
                            fullWidth
                            size="small"
                            label="Retailer where purchased"
                            value={observedSeller}
                            sx={{ mb: 1.5 }}
                            onChange={(event) => { setObservedSeller(event.target.value); setSellerMismatch(false); }}
                        />
                        <Button
                            variant="outlined"
                            sx={{
                                mb: 2,
                                borderRadius: '10px',
                                textTransform: 'none',
                                fontWeight: 700,
                                borderColor: '#D1D5DB',
                                color: '#374151',
                            }}
                            onClick={() => setSellerMismatch(observedSeller.trim().toLowerCase() !== recordedRetailer.trim().toLowerCase())}
                        >
                            Compare retailer
                        </Button>
                        {sellerMismatch && <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>The retailer you entered does not match the retailer recorded on the blockchain. Treat this product as suspicious.</Alert>}
                    </>
                ) : <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }}>No retailer custody is recorded yet. Do not treat this product as retail-ready.</Alert>}
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Typography
                        variant="h2"
                        sx={{
                            textAlign: 'center',
                            marginBottom: '16px',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            fontWeight: 800,
                            fontSize: '1.75rem',
                            color: '#111827',
                        }}
                    >
                        Product Details
                    </Typography>

                    <Box
                        sx={{
                            display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', flex: 1, width: '100%',
                            marginTop: '20px', marginBottom: '20px'
                        }}
                    >
                        <Box
                            sx={{
                                marginRight: '1.5%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', flex: '0 0 35%', width: '35%'
                            }}
                        >
                            <Avatar
                                alt={name}
                                src={image.filepreview}
                                sx={{
                                    width: 100,
                                    height: 100,
                                    margin: "auto",
                                    marginBottom: "3%",
                                    backgroundColor: "#3f51b5"
                                }}
                            >
                                {name}


                            </Avatar>

                        </Box>
                        <Box
                            sx={{
                                marginLeft: '1.5%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'left', flex: '0 0 65%', width: '65%'
                            }}
                        >
                            <Typography
                                variant="body1"
                                sx={{
                                    textAlign: "left", marginBottom: "5%",
                                }}
                            >
                                {name}

                            </Typography>

                            <Typography
                                variant="body2"
                                sx={{
                                    textAlign: "left", marginBottom: "3%",
                                }}
                            >
                                Serial Number: {serialNumber}
                            </Typography>


                            <Typography
                                variant="body2"
                                sx={{
                                    textAlign: "left", marginBottom: "3%",
                                }}
                            >
                                Description: {description}
                            </Typography>

                            <Typography
                                variant="body2"
                                sx={{
                                    textAlign: "left", marginBottom: "3%",
                                }}
                            >
                                Brand: {brand}
                            </Typography>
                            <Typography variant="body2" sx={{ textAlign: 'left', mb: '3%' }}>
                                Current stage: {['Unknown', 'Manufactured', 'Dispatched', 'Delivered', 'Sold', 'Recalled'][stage] || 'Unknown'}
                            </Typography>
                            <Typography variant="body2" sx={{ textAlign: 'left', mb: '3%' }}>
                                {stage === 2 ? 'Last confirmed custodian' : 'Current custodian'}: {ROLE_NAMES[custodianRole] || 'Unknown'} · {custodian}
                            </Typography>
                            {custodianName && <Typography variant="body2" sx={{ textAlign: 'left', mb: '3%' }}>Registered business name: {custodianName}</Typography>}

                        </Box>

                    </Box>

                    <Timeline
                        sx={{
                            [`& .${timelineOppositeContentClasses.root}`]: {
                                flex: 0.2,
                            },
                        }}
                    >
                        {getHistory()}
                        <TimelineItem>
                            <TimelineOppositeContent color="textSecondary">
                                {dayjs().format('HH:mm a')} {dayjs().format('MM/DD/YYYY')}
                            </TimelineOppositeContent>
                            <TimelineSeparator>
                                <TimelineDot />
                            </TimelineSeparator>
                            <TimelineContent sx={{ py: '12px', px: 2 }}>
                                <Typography>IsSold: {isSold.toString()}</Typography>
                            </TimelineContent>
                        </TimelineItem>
                    </Timeline>





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
    )
}

export default Product;
