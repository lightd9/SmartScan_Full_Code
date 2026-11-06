import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Avatar,
  Typography,
  Button,
  Alert,
  TextField,
  CircularProgress,
  Tooltip,
} from '@mui/material';
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
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ethers } from 'ethers';

// Contract & API integrations (preserved)
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  CHAIN_RPC_URL,
  CHAIN_ID,
  CHAIN_NAME,
  assertConfiguredChain,
} from '../../config/contract';
import { getApiUrl } from '../../api/axios';
import { formatScanWarning } from '../../api/scanEvents';
import {
  getRegisteredProduct,
  parseHistoryTimestamp,
  parseProductQr,
} from '../../api/productQr';

// Material Icons
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import PrecisionManufacturingRoundedIcon from '@mui/icons-material/PrecisionManufacturingRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import SellRoundedIcon from '@mui/icons-material/SellRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

const ROLE_NAMES = ['Unregistered', 'Admin', 'Manufacturer', 'Supplier', 'Retailer'];
const STAGE_NAMES = ['Unknown', 'Manufactured', 'Dispatched', 'Delivered', 'Sold', 'Recalled'];

const Product = () => {
  const [serialNumber, setSerialNumber] = useState('');
  const [name, setName] = useState('Product');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
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
  const [copiedSerial, setCopiedSerial] = useState(false);
  const [image, setImage] = useState({
    file: [],
    filepreview: null,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const urlSerial = params?.serialNumber;
  const querySerial = new URLSearchParams(location.search).get('serialNumber');
  const qrData = location.state?.qrData || urlSerial || querySerial;
  const scanWarnings = location.state?.warnings || [];

  useEffect(() => {
    if (qrData) {
      handleScan(qrData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrData]);

  const getImage = async (imageName) => {
    setImage((prevState) => ({
      ...prevState,
      filepreview: getApiUrl(`/file/product/${encodeURIComponent(imageName)}`),
    }));
  };

  const handleScan = async (rawQrData) => {
    setLoadError('');
    setProductLoaded(false);
    let serial;
    try {
      ({ serialNumber: serial } = parseProductQr(rawQrData, CONTRACT_ADDRESS));
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

      const roleNum =
        product[7] === ethers.ZeroAddress
          ? 0
          : Number(await productContract.roles(product[7]));
      const registeredName =
        product[7] === ethers.ZeroAddress
          ? ''
          : await productContract.businessNames(product[7]);
      setData(product, roleNum, registeredName);
      setProductLoaded(true);
    } catch (error) {
      setLoadError(
        error.message?.includes('not registered')
          ? error.message
          : 'Unable to load the product from the blockchain. Please try again.'
      );
    }
  };

  const setData = (product, currentRole, registeredName) => {
    setSerialNumber(product[0]);
    setName(product[1]);
    setBrand(product[2]);
    setDescription(product[3].replace(/;/g, ','));
    getImage(product[4]);
    setIsSold(Boolean(product[9]));
    setStage(Number(product[6]));
    setCustodian(product[7]);
    setPendingRecipient(product[8]);
    setCustodianRole(currentRole);
    setCustodianName(registeredName);
    setRecordedRetailer(currentRole === 4 ? registeredName : '');
    setHistory(
      product[5].map((event) => ({
        id: event.id.toString(),
        actor: event.actor,
        actorWallet: event.actorWallet,
        actorRole: Number(event.actorRole),
        location: event.location.replace(/;/g, ','),
        timestamp: parseHistoryTimestamp(event.timestamp),
        action: Number(event.action),
        recipientWallet: event.recipientWallet,
      }))
    );
  };

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/scanner');
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedSerial(true);
    setTimeout(() => setCopiedSerial(false), 2000);
  };

  const renderStageIcon = (actionNum) => {
    switch (actionNum) {
      case 0:
        return <PrecisionManufacturingRoundedIcon sx={{ fontSize: 16, color: '#2563EB' }} />;
      case 1:
        return <LocalShippingRoundedIcon sx={{ fontSize: 16, color: '#D97706' }} />;
      case 2:
        return <StorefrontRoundedIcon sx={{ fontSize: 16, color: '#16A34A' }} />;
      case 3:
        return <SellRoundedIcon sx={{ fontSize: 16, color: '#7C3AED' }} />;
      default:
        return <SecurityRoundedIcon sx={{ fontSize: 16, color: '#64748B' }} />;
    }
  };

  const getHistory = () => {
    return history.map((item, index) => {
      const date =
        item.timestamp === null ? 'Unknown date' : dayjs(item.timestamp * 1000).format('MM/DD/YYYY');
      const time =
        item.timestamp === null ? '' : dayjs(item.timestamp * 1000).format('HH:mm a');

      const actionLabels = ['Manufactured', 'Dispatched', 'Delivered', 'Sold', 'Recalled'];
      const actionName = actionLabels[item.action] || 'Unknown';

      return (
        <TimelineItem key={index}>
          <TimelineOppositeContent color="textSecondary" sx={{ fontSize: '0.78rem', py: 1 }}>
            <div>{time}</div>
            <div style={{ color: '#94A3B8', fontSize: '0.72rem' }}>{date}</div>
          </TimelineOppositeContent>
          <TimelineSeparator>
            <TimelineDot
              sx={{
                p: '6px',
                backgroundColor: '#EFF6FF',
                borderColor: '#BFDBFE',
                boxShadow: 'none',
              }}
            >
              {renderStageIcon(item.action)}
            </TimelineDot>
            {index < history.length - 1 && <TimelineConnector sx={{ backgroundColor: '#E2E8F0' }} />}
          </TimelineSeparator>
          <TimelineContent sx={{ py: '10px', px: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="status-pill blue" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                {actionName}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Event #{item.id}</span>
            </div>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A', mb: 0.5 }}>
              {item.actor || ROLE_NAMES[item.actorRole] || 'Verified Business'}
            </Typography>
            <Typography sx={{ fontSize: '0.76rem', color: '#64748B', mb: 0.5 }}>
              Location: <strong>{item.location || 'Not provided'}</strong>
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#94A3B8', wordBreak: 'break-all' }}>
              Wallet: {item.actorWallet}
            </Typography>
            {item.action === 1 && (
              <Typography sx={{ fontSize: '0.74rem', color: '#B45309', mt: 0.5 }}>
                {item.recipientWallet === ethers.ZeroAddress
                  ? 'Awaiting receipt confirmation by an eligible registered receiver.'
                  : `Dispatched to wallet: ${item.recipientWallet}`}
              </Typography>
            )}
          </TimelineContent>
        </TimelineItem>
      );
    });
  };

  // Loading or Error State Screen
  if (!productLoaded) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 480,
            p: { xs: 3.5, sm: 4.5 },
            textAlign: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.06)',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              backgroundColor: loadError ? '#FEE2E2' : '#EFF6FF',
              color: loadError ? '#DC2626' : '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
            }}
          >
            {loadError ? (
              <SecurityRoundedIcon sx={{ fontSize: 28 }} />
            ) : (
              <CircularProgress size={28} color="inherit" />
            )}
          </Box>

          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F172A', mb: 1 }}>
            {loadError ? 'Verification Alert' : 'Querying Blockchain Ledger'}
          </Typography>

          <Typography variant="body2" sx={{ color: '#64748B', mb: 3, lineHeight: 1.6 }}>
            {loadError
              ? 'The scanned product identity could not be verified on the configured product contract.'
              : `Authenticating digital passport on ${CHAIN_NAME} (Chain ID: ${CHAIN_ID})…`}
          </Typography>

          {scanWarnings.map((warning) => (
            <Alert
              key={warning}
              severity="warning"
              sx={{ mb: 1.5, textAlign: 'left', borderRadius: '12px' }}
            >
              {formatScanWarning(warning)}
            </Alert>
          ))}

          {loadError && (
            <Alert severity="error" sx={{ textAlign: 'left', mb: 3, borderRadius: '12px' }}>
              {loadError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            <Button
              variant="outlined"
              onClick={handleBack}
              startIcon={<ArrowBackRoundedIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                px: 2.5,
                borderColor: '#CBD5E1',
                color: '#334155',
                '&:hover': { borderColor: '#94A3B8', backgroundColor: '#F8FAFC' },
              }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/scanner')}
              startIcon={<QrCodeScannerRoundedIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                px: 2.5,
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                boxShadow: 'none',
                '&:hover': { backgroundColor: '#1D4ED8', boxShadow: 'none' },
              }}
            >
              Scan Another
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  // Loaded Product Passport View
  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        py: { xs: 3, md: 5 },
        px: { xs: 2, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 620 }}>
        {/* Top Navigation Strip */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2.5,
          }}
        >
          <Button
            variant="text"
            onClick={handleBack}
            startIcon={<ArrowBackRoundedIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
              color: '#475569',
              '&:hover': { color: '#0F172A', backgroundColor: '#F1F5F9' },
            }}
          >
            Back
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="status-pill green">
              <VerifiedRoundedIcon sx={{ fontSize: 13, mr: 0.5 }} />
              On-Chain Verified
            </span>
          </div>
        </Box>

        {/* Main Product Card */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.05)',
            mb: 3,
          }}
        >
          {/* Status alerts if any */}
          {loadError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
              {loadError}
            </Alert>
          )}
          {scanWarnings.map((warning) => (
            <Alert key={warning} severity="warning" sx={{ mb: 1.5, borderRadius: '12px' }}>
              {formatScanWarning(warning)}
            </Alert>
          ))}
          {stage === 5 && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
              This product has been recalled by the manufacturer. Do not purchase or use it.
            </Alert>
          )}
          {stage === 2 && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>
              {pendingRecipient !== ethers.ZeroAddress
                ? `In transit to registered recipient: ${pendingRecipient}`
                : 'Dispatched and awaiting custody receipt confirmation by registered partner.'}
            </Alert>
          )}

          {/* Product Header Row */}
          <Box
            sx={{
              display: 'flex',
              gap: 2.5,
              alignItems: 'center',
              pb: 3,
              borderBottom: '1px solid #F1F5F9',
              mb: 3,
            }}
          >
            <Avatar
              alt={name}
              src={image.filepreview}
              variant="rounded"
              sx={{
                width: 76,
                height: 76,
                borderRadius: '16px',
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
                fontWeight: 800,
                fontSize: '1.5rem',
                border: '1px solid #E2E8F0',
                flexShrink: 0,
              }}
            >
              {name?.charAt(0)?.toUpperCase()}
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span className="status-pill purple" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                  {brand || 'Brand'}
                </span>
                <span className={`status-pill ${isSold ? 'green' : 'blue'}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                  {isSold ? 'Sold to Consumer' : 'In Retail Inventory'}
                </span>
              </div>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  color: '#0F172A',
                  fontSize: { xs: '1.25rem', sm: '1.45rem' },
                  lineHeight: 1.3,
                  mb: 0.5,
                }}
              >
                {name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <code className="hash-badge" title={serialNumber}>
                  {serialNumber}
                </code>
                <Tooltip title={copiedSerial ? 'Copied!' : 'Copy serial number'}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(serialNumber)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: copiedSerial ? '#16A34A' : '#64748B',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                    aria-label="Copy serial number"
                  >
                    {copiedSerial ? (
                      <CheckRoundedIcon sx={{ fontSize: 16 }} />
                    ) : (
                      <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
                    )}
                  </button>
                </Tooltip>
              </Box>
            </Box>
          </Box>

          {/* Description */}
          {description && (
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                Description
              </Typography>
              <Typography sx={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6 }}>
                {description}
              </Typography>
            </Box>
          )}

          {/* Key Lifecycle Properties Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
              mb: 3,
            }}
          >
            <div style={{
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
            }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Lifecycle Stage
              </span>
              <strong style={{ fontSize: '0.9rem', color: '#0F172A', display: 'block', marginTop: '2px' }}>
                {STAGE_NAMES[stage] || 'Unknown'}
              </strong>
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
            }}>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                {stage === 2 ? 'Last Confirmed Custodian' : 'Current Custodian'}
              </span>
              <strong style={{ fontSize: '0.9rem', color: '#0F172A', display: 'block', marginTop: '2px' }}>
                {custodianName || ROLE_NAMES[custodianRole] || 'Verified Business'}
              </strong>
            </div>
          </Box>

          {/* Retailer Comparison Verification Tool */}
          <Box
            sx={{
              p: 2.5,
              borderRadius: '14px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              mb: 3,
            }}
          >
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', mb: 0.5 }}>
              Authorized Retailer Verification
            </Typography>
            {recordedRetailer ? (
              <>
                <Typography sx={{ fontSize: '0.78rem', color: '#64748B', mb: 1.5 }}>
                  Recorded on chain: <strong>{recordedRetailer}</strong>
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Enter store name to compare…"
                    value={observedSeller}
                    onChange={(e) => {
                      setObservedSeller(e.target.value);
                      setSellerMismatch(false);
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#FFFFFF',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                      },
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() =>
                      setSellerMismatch(
                        observedSeller.trim().toLowerCase() !== recordedRetailer.trim().toLowerCase()
                      )
                    }
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: '10px',
                      px: 2,
                      py: 0.9,
                      borderColor: '#CBD5E1',
                      color: '#0F172A',
                      whiteSpace: 'nowrap',
                      '&:hover': { borderColor: '#94A3B8', backgroundColor: '#FFFFFF' },
                    }}
                  >
                    Compare
                  </Button>
                </Box>
                {sellerMismatch && (
                  <Alert severity="warning" sx={{ mt: 1.5, borderRadius: '10px', fontSize: '0.8rem' }}>
                    The retailer you entered does not match the blockchain record. Exercise caution.
                  </Alert>
                )}
              </>
            ) : (
              <Alert severity="warning" sx={{ borderRadius: '10px', fontSize: '0.8rem' }}>
                No retailer custody is recorded yet. This product is not yet retail-cleared.
              </Alert>
            )}
          </Box>

          {/* Provenance History Timeline */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', mb: 2 }}>
              Cryptographic Provenance Trail
            </Typography>
            <Timeline
              sx={{
                p: 0,
                [`& .${timelineOppositeContentClasses.root}`]: {
                  flex: 0.28,
                  textAlign: 'right',
                  pr: 2,
                },
              }}
            >
              {getHistory()}
              <TimelineItem>
                <TimelineOppositeContent color="textSecondary" sx={{ fontSize: '0.78rem', py: 1 }}>
                  <div>{dayjs().format('HH:mm a')}</div>
                  <div style={{ color: '#94A3B8', fontSize: '0.72rem' }}>{dayjs().format('MM/DD/YYYY')}</div>
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot
                    sx={{
                      p: '6px',
                      backgroundColor: isSold ? '#DCFCE7' : '#EFF6FF',
                      borderColor: isSold ? '#BBF7D0' : '#BFDBFE',
                      boxShadow: 'none',
                    }}
                  >
                    <CheckRoundedIcon sx={{ fontSize: 16, color: isSold ? '#16A34A' : '#2563EB' }} />
                  </TimelineDot>
                </TimelineSeparator>
                <TimelineContent sx={{ py: '10px', px: 2 }}>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A' }}>
                    Sale Status: {isSold ? 'Sold' : 'Available for purchase'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.74rem', color: '#64748B' }}>
                    {isSold
                      ? 'Item ownership registered to consumer on ledger.'
                      : 'Item is active in verified retailer custody.'}
                  </Typography>
                </TimelineContent>
              </TimelineItem>
            </Timeline>
          </Box>

          {/* Action Row */}
          <Box sx={{ display: 'flex', gap: 1.5, mt: 3, pt: 2, borderTop: '1px solid #F1F5F9' }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleBack}
              sx={{
                py: 1.2,
                borderRadius: '12px',
                borderColor: '#CBD5E1',
                color: '#334155',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                '&:hover': { borderColor: '#94A3B8', backgroundColor: '#F8FAFC' },
              }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate('/scanner')}
              startIcon={<QrCodeScannerRoundedIcon />}
              sx={{
                py: 1.2,
                borderRadius: '12px',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                boxShadow: 'none',
                '&:hover': { backgroundColor: '#1D4ED8', boxShadow: 'none' },
              }}
            >
              Scan Another
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default Product;
