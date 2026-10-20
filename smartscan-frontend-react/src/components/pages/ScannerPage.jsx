import { Box, Paper, Typography, Button } from '@mui/material';
import bgImg from '../../img/bg.png';
import QrScanner from '../QrScanner';
import { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, SEPOLIA_RPC_URL } from '../../config/contract';

const ScannerPage = () => {
    const [qrData, setQrData] = useState('');
    const [status, setStatus] = useState('');

    const { auth } = useAuth();
    const navigate = useNavigate();

    const passData = (data) => {
        setQrData(data);
    };

    useEffect(() => {
        if (!qrData) {
            return;
        }

        const arr = qrData.split(',');
        const contractAddress = (arr[0] || '').trim();
        const serialNumber = (arr[1] || '').trim();

        if (!contractAddress || !serialNumber) {
            setStatus('This QR code is not a valid SmartScan code.');
            return;
        }

        if (contractAddress.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase() || !ethers.utils.isAddress(contractAddress)) {
            navigate('/fake-product');
            return;
        }

        const verifyOnChain = async () => {
            setStatus('Verifying product on the blockchain...');
            try {
                const provider = new ethers.providers.JsonRpcProvider(SEPOLIA_RPC_URL);
                const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
                const product = await contract.getProduct(serialNumber);
                const onChainSerial = product[0];

                if (!onChainSerial) {
                    navigate('/fake-product');
                    return;
                }

                if (auth.role === 'supplier' || auth.role === 'retailer') {
                    navigate('/update-product', { state: { qrData } });
                } else {
                    navigate('/authentic-product', { state: { qrData } });
                }
            } catch (err) {
                console.error(err);
                setStatus('Unable to reach the blockchain. Please check your connection and try again.');
            }
        };

        verifyOnChain();
    }, [qrData, auth.role, navigate]);

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
            <Paper elevation={3} sx={{ width: "400px", margin: "auto", marginTop: "10%", marginBottom: "10%", padding: "3%", backgroundColor: "#e3eefc" }}>

                <Box
                    sx={{
                        textAlign: "center", marginBottom: "5%",
                    }}
                >

                    <Typography
                        variant="h2"
                        sx={{
                            textAlign: "center", marginBottom: "3%",
                            fontFamily: 'Gambetta', fontWeight: "bold", fontSize: "2.5rem"
                        }}
                    >
                        Scan QR Code</Typography>

                    <QrScanner passData={passData} />

                    {status && (
                        <Typography variant="body2" sx={{ marginTop: "3%" }}>
                            {status}
                        </Typography>
                    )}

                    <Box
                        sx={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "center",
                        }}
                    >
                        <Button
                            onClick={handleBack}
                            sx={{
                                marginTop: "5%",
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
