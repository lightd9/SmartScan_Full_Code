import { Box, Paper, Typography, Button, Alert } from '@mui/material';
import bgImg from '../../img/bg.png';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatScanWarning } from '../../api/scanEvents';

const AuthenticProduct = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const qrData = location.state?.qrData;
    const scanWarnings = location.state?.warnings || [];

    const viewPublicHistory = () => {
        if (!qrData) {
            navigate('/scanner', { replace: true });
            return;
        }
        navigate('/product', { state: { qrData, warnings: scanWarnings } });
    };

    return (
        <Box sx={{
            backgroundImage: `url(${bgImg})`,
            minHeight: '80vh',
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            zIndex: -2,
            overflowY: 'scroll',
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
                    textAlign: 'center',
                }}
            >
                <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    backgroundColor: '#E6F9F0',
                    color: '#16A34A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 18px',
                    fontSize: 28,
                    fontWeight: 'bold',
                }}>
                    ✓
                </div>
                <Typography variant="h4" sx={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, color: '#111827', textAlign: 'center', mb: 2, fontSize: '1.65rem' }}>
                    Blockchain Record Found
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#6B7280', textAlign: 'center', mb: 3, lineHeight: 1.6, fontSize: '0.95rem' }}>
                    Review the public custody history, current custodian, and listed retailer. No wallet is needed to read this record.
                </Typography>
                {scanWarnings.map((warning) => (
                    <Alert key={warning} severity="warning" sx={{ mb: 1.5, borderRadius: '12px', textAlign: 'left', fontSize: '0.875rem' }}>
                        {formatScanWarning(warning)}
                    </Alert>
                ))}
                <Button
                    variant="contained"
                    sx={{
                        width: '100%',
                        mt: 2,
                        py: 1.5,
                        borderRadius: '12px',
                        backgroundColor: '#2F66EE',
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        boxShadow: 'none',
                        '&:hover': {
                            backgroundColor: '#1E4FD9',
                            boxShadow: 'none',
                        },
                    }}
                    onClick={viewPublicHistory}
                >
                    View public product history
                </Button>
            </Paper>
        </Box>
    );
};

export default AuthenticProduct;
