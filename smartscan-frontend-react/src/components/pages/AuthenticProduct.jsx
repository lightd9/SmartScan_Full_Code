import { Box, Paper, Typography, Button } from '@mui/material';
import bgImg from '../../img/bg.png';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { connectMetaMask, findMetaMaskAccount } from '../../utils/metamask';

const AuthenticProduct = () => {
    const [currentAccount, setCurrentAccount] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const qrData = location.state?.qrData;

    useEffect(() => {
        findMetaMaskAccount().then((account) => {
            if (account !== null) {
                setCurrentAccount(account);
            }
        });
    }, []);

    const connectWallet = async () => {
        try {
            const account = await connectMetaMask();
            if (account) {
                setCurrentAccount(account);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleClick = () => {
        connectWallet();
        
    }

    useEffect(() => {
        if(currentAccount){
            navigate('/product', { state: { qrData }});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentAccount]);

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

            <Paper elevation={3} sx={{ width: "400px", margin: "auto", marginTop: "10%", marginBottom: "10%", padding: "3%", backgroundColor: "#e3eefc" }}>
                <Typography
                    variant="h4"
                    sx={{
                        fontFamily: "Montserrat",
                        textAlign: "center", marginBottom: "5%", marginTop: "5%", 
                    }}    
                >
                    Congrats!
                </Typography>
                <Typography
                variant="h5"
                sx={{
                    fontFamily: "Montserrat",
                    textAlign: "center", marginBottom: "5%", marginTop: "5%", 
                }}   >
                    Your Product is Authentic
                </Typography>
                <Typography
                variant="body2"
                sx={{
                    textAlign: "center", marginTop: "10%", marginBottom: "5%",
                }}   
                >
                    Connect Your Wallet to View Product Details
                </Typography>

                <Button variant="contained" sx={{ width: "100%", marginTop: "5%" }} onClick={handleClick}>
                    Connect Wallet
                </Button>
            </Paper>
        </Box>


    )


}

export default AuthenticProduct;