import { Box, Paper, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Missing = () => {
    const navigate = useNavigate();

    return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            padding: 3,
        }}>
            <Paper
                elevation={0}
                sx={{
                    maxWidth: 480,
                    width: '100%',
                    padding: '48px 36px',
                    textAlign: 'center',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '24px',
                    border: '1px solid #ECEEF2',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
                }}
            >
                <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    fontSize: 28,
                    fontWeight: 'bold',
                }}>
                    404
                </div>
                <Typography variant="h4" sx={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, color: '#0F172A', mb: 1.5, fontSize: '1.65rem' }}>
                    Page Not Found
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#64748B', mb: 4, lineHeight: 1.6, fontSize: '0.95rem' }}>
                    The page or resource you are looking for does not exist or may have been moved to another location.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Button
                        variant="contained"
                        onClick={() => navigate('/')}
                        sx={{
                            py: 1.4,
                            borderRadius: '12px',
                            backgroundColor: '#2563EB',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            boxShadow: 'none',
                            '&:hover': {
                                backgroundColor: '#1D4ED8',
                                boxShadow: 'none',
                            },
                        }}
                    >
                        Return to Homepage
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => navigate(-1)}
                        sx={{
                            py: 1.3,
                            borderRadius: '12px',
                            borderColor: '#E2E8F0',
                            color: '#475569',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.92rem',
                            '&:hover': {
                                borderColor: '#CBD5E1',
                                backgroundColor: '#F8FAFC',
                            },
                        }}
                    >
                        Go Back Previous Page
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default Missing;

