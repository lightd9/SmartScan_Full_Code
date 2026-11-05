import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  Container,
  Alert,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import logoImg from '../../img/logo.png';
import axios from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { formatContractError } from '../../utils/contractErrors';

const LOGIN_URL = '/auth';

const DEMO_PRESETS = [
  { role: 'Admin', username: 'admin' },
  { role: 'Manufacturer', username: 'manu' },
  { role: 'Supplier', username: 'supp' },
  { role: 'Retailer', username: 'retailer' },
];

export default function Login() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const errRef = useRef();
  const pwdInputRef = useRef();

  const [user, setUser] = useState('');
  const [pwd, setPwd] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);

  useEffect(() => {
    setErrMsg('');
  }, [user, pwd]);

  const handleBack = () => {
    navigate('/');
  };

  const handlePresetSelect = (presetUser) => {
    setUser(presetUser);
    pwdInputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user.trim() || !pwd) {
      setErrMsg('Please enter both your username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrMsg('');

    try {
      const res = await axios.post(LOGIN_URL, { username: user.trim(), password: pwd });
      const account = res?.data?.user;
      if (!account || !res?.data?.token) {
        setErrMsg('Login Failed. Please verify your credentials or server connection.');
        return;
      }

      setAuth({ ...account, token: res.data.token });
      setUser('');
      setPwd('');
      navigate(`/${account.role}`, { replace: true });
    } catch (err) {
      if (!err?.response) {
        setErrMsg('Network error: Authentication server is unreachable. Please try again later.');
      } else if (err.response?.status === 400 || err.response?.status === 401) {
        setErrMsg('Invalid username or password. Please verify and retry.');
      } else {
        setErrMsg(err.response?.data?.error || 'Login Failed. Please try again later.');
      }
      errRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWalletLogin = async () => {
    setErrMsg('');
    setWalletBusy(true);
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask or a Web3 compatible browser extension is required to sign in with your corporate wallet.');
      }
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      const challenge = await axios.post('/auth/wallet/challenge', { walletAddress });
      const signature = await signer.signMessage(challenge.data.message);
      const response = await axios.post('/auth/wallet/verify', {
        challengeId: challenge.data.challengeId,
        signature,
      });
      const account = response?.data?.user;
      if (!account || !response?.data?.token) {
        throw new Error('Wallet cryptographic sign-in could not be completed.');
      }
      setAuth({ ...account, token: response.data.token });
      navigate(`/${account.role}`, { replace: true });
    } catch (error) {
      setErrMsg(formatContractError(error, 'Unable to sign in with this corporate wallet.'));
      errRef.current?.focus();
    } finally {
      setWalletBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 4, sm: 6 },
        px: 2,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 5 },
            borderRadius: '24px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #ECEEF2',
            boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.08)',
          }}
        >
          {/* Header & Logo */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Link to="/" style={{ display: 'inline-block', marginBottom: '12px' }}>
              <img src={logoImg} alt="SmartScan" style={{ height: 36, objectFit: 'contain' }} />
            </Link>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A', mb: 0.5 }}>
              Enterprise Portal Login
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Access your supply chain nodes, custody hubs & blockchain records
            </Typography>
          </Box>

          {/* Quick Demo Credentials Bar */}
          <Box
            sx={{
              p: 1.5,
              mb: 3,
              borderRadius: '12px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #E2E8F0',
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}
            >
              Quick Test Accounts
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {DEMO_PRESETS.map((p) => (
                <Chip
                  key={p.username}
                  label={`${p.role} (@${p.username})`}
                  size="small"
                  onClick={() => handlePresetSelect(p.username)}
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    backgroundColor: user === p.username ? '#DBEAFE' : '#FFFFFF',
                    color: user === p.username ? '#1E40AF' : '#334155',
                    border: user === p.username ? '1px solid #3B82F6' : '1px solid #CBD5E1',
                    '&:hover': { backgroundColor: '#E2E8F0' },
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Feedback Notices */}
          {location.state?.message && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>
              {location.state.message}
            </Alert>
          )}

          {errMsg && (
            <Alert severity="error" ref={errRef} tabIndex={-1} sx={{ mb: 2, borderRadius: '12px' }}>
              {errMsg}
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '12px' },
              }}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              inputRef={pwdInputRef}
              autoComplete="current-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '12px' },
              }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <FormControlLabel
                control={<Checkbox value="remember" color="primary" size="small" defaultChecked />}
                label={<span style={{ fontSize: '13px', color: '#64748B' }}>Remember session</span>}
              />
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <VpnKeyRoundedIcon />}
              sx={{
                mt: 2.5,
                mb: 1.5,
                py: 1.3,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.95rem',
                textTransform: 'none',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #1E40AF 0%, #1D4ED8 100%)',
                },
              }}
            >
              {isSubmitting ? 'Authenticating Credentials...' : 'Sign In to SmartScan'}
            </Button>

            <Divider sx={{ my: 2 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Or Secure Authentication
              </Typography>
            </Divider>

            <Button
              type="button"
              fullWidth
              variant="outlined"
              onClick={handleWalletLogin}
              disabled={walletBusy}
              startIcon={walletBusy ? <CircularProgress size={18} /> : <AccountBalanceWalletOutlinedIcon />}
              sx={{
                py: 1.2,
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
              {walletBusy ? 'Verifying EIP-191 Signature...' : 'Sign in with Linked Corporate Wallet'}
            </Button>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Button
                onClick={handleBack}
                startIcon={<ArrowBackRoundedIcon />}
                size="small"
                sx={{
                  color: '#64748B',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { color: '#0F172A', backgroundColor: 'transparent' },
                }}
              >
                Back to Public Portal
              </Button>
            </Box>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}
