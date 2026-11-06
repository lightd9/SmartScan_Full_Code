import React from 'react';
import { Box, Paper, Typography, Button, Alert } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatScanWarning } from '../../api/scanEvents';

// Material Icons
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';

const FakeProduct = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const warning = location.state?.warning;
  const recalled = location.state?.recalled === true;

  const handleBack = () => {
    navigate(-2);
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
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            border: '1px solid #FECACA',
          }}
        >
          <WarningAmberRoundedIcon sx={{ fontSize: 36 }} />
        </div>

        <span className="status-pill red" style={{ marginBottom: '14px', display: 'inline-flex' }}>
          {recalled ? 'Product Recalled' : 'Authenticity Unverified'}
        </span>

        <Typography
          variant="h4"
          sx={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            color: '#B91C1C',
            textAlign: 'center',
            mb: 1.5,
            fontSize: { xs: '1.45rem', sm: '1.65rem' },
            letterSpacing: '-0.02em',
          }}
        >
          {recalled ? 'Product Recall Warning' : 'Product Authentication Failed'}
        </Typography>

        <Typography
          variant="h6"
          sx={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 600,
            color: '#334155',
            textAlign: 'center',
            mb: 2,
            fontSize: '0.98rem',
            lineHeight: 1.5,
          }}
        >
          {warning || 'The scanned identifier was not found on the configured SmartScan contract.'}
        </Typography>

        {(location.state?.warnings || []).map((item) => (
          <Alert
            key={item}
            severity="warning"
            sx={{ mb: 1.5, borderRadius: '12px', textAlign: 'left', fontSize: '0.82rem' }}
          >
            {formatScanWarning(item)}
          </Alert>
        ))}

        {!warning && (
          <Typography
            variant="body1"
            sx={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              color: '#64748B',
              textAlign: 'center',
              my: 2,
              fontSize: '0.88rem',
              lineHeight: 1.6,
            }}
          >
            Do not purchase or accept this product until its cryptographic origin can be confirmed by the manufacturer.
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
          <Button
            onClick={handleBack}
            variant="outlined"
            fullWidth
            startIcon={<ArrowBackRoundedIcon />}
            sx={{
              py: 1.3,
              borderRadius: '12px',
              borderColor: '#CBD5E1',
              color: '#334155',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              '&:hover': {
                borderColor: '#94A3B8',
                backgroundColor: '#F8FAFC',
              },
            }}
          >
            Back
          </Button>
          <Button
            onClick={() => navigate('/scanner')}
            variant="contained"
            fullWidth
            startIcon={<QrCodeScannerRoundedIcon />}
            sx={{
              py: 1.3,
              borderRadius: '12px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: '#1D4ED8',
                boxShadow: 'none',
              },
            }}
          >
            Scan Again
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default FakeProduct;
