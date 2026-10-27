import { Box, Paper, Typography, Button, Alert } from '@mui/material';
import bgImg from '../../img/bg.png';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatScanWarning } from '../../api/scanEvents';

const FakeProduct = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const warning = location.state?.warning;
    const recalled = location.state?.recalled === true;

    const handleBack = () => {
        navigate(-2)
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
                    backgroundColor: '#FEE2E2',
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 18px',
                    fontSize: 26,
                    fontWeight: 'bold',
                }}>
                    ✕
                </div>
                <Typography variant="h4" sx={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, color: '#DC2626', textAlign: 'center', mb: 2, fontSize: '1.65rem' }}>
                    {recalled ? 'Product Recall Warning' : 'Product Authentication Failed'}
                </Typography>
                <Typography variant="h6" sx={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: '#374151', textAlign: 'center', mb: 2, fontSize: '1rem', lineHeight: 1.5 }}>
                    {warning || 'The scanned identifier was not found on the configured SmartScan contract.'}
                </Typography>
                {(location.state?.warnings || []).map((item) => (
                    <Alert key={item} severity="warning" sx={{ mb: 1.5, borderRadius: '12px', textAlign: 'left', fontSize: '0.875rem' }}>
                        {formatScanWarning(item)}
                    </Alert>
                ))}
                {!warning && (
                    <Typography variant="body1" sx={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#6B7280', textAlign: 'center', my: 2, fontSize: '0.9rem', lineHeight: 1.6 }}>
                        Do not purchase or use this product until its identity can be confirmed. Contact the manufacturer or retailer if you have concerns.
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
            </Paper>
        </Box>


    
    )
}

export default FakeProduct;
