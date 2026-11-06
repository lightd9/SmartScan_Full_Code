import React from 'react';
import { Box, Paper, Typography, Button, Alert } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatScanWarning } from '../../api/scanEvents';

// Material Icons
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';

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
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2.5, sm: 4 },
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 480,
          p: { xs: 3.5, sm: 4.5 },
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.06)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: '#DCFCE7',
            color: '#16A34A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            border: '1px solid #BBF7D0',
          }}
        >
          <CheckCircleRoundedIcon sx={{ fontSize: 36 }} />
        </div>

        <span className="status-pill green" style={{ marginBottom: '14px', display: 'inline-flex' }}>
          <ShieldOutlinedIcon sx={{ fontSize: 14, mr: 0.5 }} />
          Cryptographically Verified
        </span>

        <Typography
          variant="h4"
          sx={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            color: '#0F172A',
            textAlign: 'center',
            mb: 1.5,
            fontSize: { xs: '1.45rem', sm: '1.65rem' },
            letterSpacing: '-0.02em',
          }}
        >
          Authentic Product Verified
        </Typography>

        <Typography
          variant="body1"
          sx={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: '#64748B',
            textAlign: 'center',
            mb: 3,
            lineHeight: 1.6,
            fontSize: '0.92rem',
          }}
        >
          Review the public custody history, current custodian, and listed retailer. No wallet is needed to read this record.
        </Typography>
        {scanWarnings.map((warning) => (
          <Alert
            key={warning}
            severity="warning"
            sx={{ mb: 1.5, borderRadius: '12px', textAlign: 'left', fontSize: '0.82rem' }}
          >
            {formatScanWarning(warning)}
          </Alert>
        ))}

        <Button
          variant="contained"
          fullWidth
          endIcon={<ArrowForwardRoundedIcon />}
          sx={{
            mt: 2,
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
          onClick={viewPublicHistory}
        >
          View Custody Chain
        </Button>
      </Paper>
    </Box>
  );
};

export default AuthenticProduct;
