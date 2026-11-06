import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Tooltip,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  InputAdornment,
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import FlashOnRoundedIcon from '@mui/icons-material/FlashOnRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import useAuth from '../../hooks/useAuth';
import api from '../../api/axios';
import { BLOCK_EXPLORER_URL, CHAIN_ID, CHAIN_NAME, CONTRACT_ADDRESS } from '../../config/contract';

const ROLE_COLORS = {
  manufacturer: { bg: 'rgba(59, 130, 246, 0.12)', border: '#3b82f6', text: '#2563eb' },
  supplier: { bg: 'rgba(168, 85, 247, 0.12)', border: '#a855f7', text: '#9333ea' },
  retailer: { bg: 'rgba(16, 185, 129, 0.12)', border: '#10b981', text: '#059669' },
};

export default function SubaccountsPage() {
  const { auth } = useAuth();
  const isAdmin = auth?.role === 'admin';

  if (!isAdmin) {
    return <Navigate to={`/${auth?.role || ''}`} replace />;
  }

  // State
  const [subaccounts, setSubaccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [treasury, setTreasury] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dialog State
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    subaccountName: '',
    facilityCode: '',
    role: isAdmin ? 'retailer' : (auth?.role || 'retailer'),
    parentUsername: auth?.user || '',
  });
  const [creating, setCreating] = useState(false);

  // Action State (Approve, Fund, Revoke)
  const [actionInProgress, setActionInProgress] = useState({});

  // Fetch subaccounts and treasury status
  const loadData = useCallback(async () => {
    setError('');
    try {
      const [subsRes, treasRes] = await Promise.all([
        api.get('/api/subaccounts').catch(() => ({ data: [] })),
        isAdmin ? api.get('/api/subaccounts/treasury-status').catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);
      setSubaccounts(subsRes.data || []);
      setTreasury(treasRes?.data || null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load subaccounts data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredSubaccounts = subaccounts.filter((sub) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    const nameMatch = (sub.subaccount_name || '').toLowerCase().includes(term);
    const codeMatch = (sub.facility_code || '').toLowerCase().includes(term);
    const parentMatch = (sub.parent_username || '').toLowerCase().includes(term);
    const addressMatch = (sub.wallet_address || '').toLowerCase().includes(term);
    const roleMatch = (sub.role || '').toLowerCase().includes(term);
    return nameMatch || codeMatch || parentMatch || addressMatch || roleMatch;
  });

  // Copy to clipboard helper
  const copyToClipboard = (text, label) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setSuccessMsg(`Copied ${label} to clipboard!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  // Create Subaccount
  const handleCreateSubaccount = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setCreating(true);

    try {
      const res = await api.post('/api/subaccounts/create', {
        subaccountName: createForm.subaccountName.trim(),
        facilityCode: createForm.facilityCode.trim().toUpperCase(),
        role: createForm.role,
        parentUsername: isAdmin && createForm.parentUsername ? createForm.parentUsername.trim() : undefined,
      });

      setSuccessMsg(res.data.message || 'Subaccount provisioned successfully with encrypted keystore!');
      setOpenCreateDialog(false);
      setCreateForm({
        subaccountName: '',
        facilityCode: '',
        role: isAdmin ? 'retailer' : (auth?.role || 'retailer'),
        parentUsername: auth?.user || '',
      });
      loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to create subaccount.');
    } finally {
      setCreating(false);
    }
  };

  // Approve & Auto-Fund Subaccount (Admin Only)
  const handleApproveSubaccount = async (id) => {
    setError('');
    setSuccessMsg('');
    setActionInProgress((prev) => ({ ...prev, [id]: 'approving' }));

    try {
      const res = await api.post(`/api/subaccounts/${id}/approve`);
      setSuccessMsg(res.data.message || 'Subaccount approved on-chain and funded with operational gas!');
      loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Approval and funding failed.');
    } finally {
      setActionInProgress((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Top-Up Gas
  const handleFundSubaccount = async (id) => {
    setError('');
    setSuccessMsg('');
    setActionInProgress((prev) => ({ ...prev, [id]: 'funding' }));

    try {
      const res = await api.post(`/api/subaccounts/${id}/fund`, { amountEth: '0.005' });
      setSuccessMsg(`Disbursed ${res.data.amountEth} ETH gas to facility wallet! Tx: ${res.data.txHash.slice(0, 14)}...`);
      loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Gas top-up failed.');
    } finally {
      setActionInProgress((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Revoke Subaccount
  const handleRevokeSubaccount = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this operational facility subaccount?')) return;
    setError('');
    setSuccessMsg('');
    setActionInProgress((prev) => ({ ...prev, [id]: 'revoking' }));

    try {
      const res = await api.post(`/api/subaccounts/${id}/revoke`);
      setSuccessMsg(res.data.message || 'Subaccount revoked.');
      loadData();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Revocation failed.');
    } finally {
      setActionInProgress((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <DashboardShell>
      <GreetingBanner
        title="Facility Subaccounts & Gas Treasury"
        subtitle="Manage operational facility wallets, automated gas funding, and access permissions"
      />

      {/* Global Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      {/* Gas Treasury Status Card (Admin Only) */}
      {isAdmin && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <LocalGasStationRoundedIcon sx={{ color: '#10b981', fontSize: 28 }} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                    Gas Treasury Engine
                  </Typography>
                  <Chip
                    size="small"
                    label={treasury?.configured ? 'Active & Funded' : 'Awaiting Config'}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      background: treasury?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: treasury?.configured ? '#34d399' : '#f87171',
                      border: treasury?.configured ? '1px solid #059669' : '1px solid #dc2626',
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  Automated on-chain gas funding for approved subaccounts on {CHAIN_NAME} (Chain ID: {CHAIN_ID})
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                <Typography variant="caption" sx={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Treasury Balance
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#38bdf8' }}>
                  {treasury?.balanceEth ? parseFloat(treasury.balanceEth).toFixed(4) : '0.0000'}{' '}
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>ETH</span>
                </Typography>
              </Box>

              <Tooltip title="Refresh Treasury Balance">
                <IconButton
                  onClick={handleRefresh}
                  disabled={refreshing}
                  sx={{
                    color: '#94a3b8',
                    background: 'rgba(255, 255, 255, 0.05)',
                    '&:hover': { background: 'rgba(255, 255, 255, 0.1)', color: '#fff' },
                  }}
                >
                  <RefreshRoundedIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                </IconButton>
              </Tooltip>

              <Button
                variant="contained"
                startIcon={<AddCircleOutlineRoundedIcon />}
                onClick={() => setOpenCreateDialog(true)}
                sx={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  textTransform: 'none',
                  px: 2.5,
                  py: 1,
                  borderRadius: 2,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                }}
              >
                Provision Subaccount
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Subaccounts Cards Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Operational Subaccounts ({filteredSubaccounts.length}{filteredSubaccounts.length !== subaccounts.length ? ` of ${subaccounts.length}` : ''})
            </Typography>
            {searchTerm && (
              <Chip
                size="small"
                label={`Filtering: "${searchTerm}"`}
                onDelete={() => setSearchTerm('')}
                sx={{ fontWeight: 600, fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1' }}
              />
            )}
          </Box>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Smart contract: <span style={{ fontFamily: 'monospace' }}>{CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-6)}</span>
          </Typography>
        </Box>

        {/* Admin Search Bar */}
        {isAdmin && subaccounts.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by facility name, code (e.g. DOCK-01), parent account (@username), or wallet address (0x...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: '#64748b', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')} title="Clear search">
                      <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
                sx: {
                  borderRadius: 2.5,
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  '& fieldset': { border: 'none' },
                  fontSize: '0.88rem',
                },
              }}
            />
          </Box>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : subaccounts.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1' }}>
            <AccountTreeOutlinedIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#475569', mb: 1 }}>
              No Operational Subaccounts Found
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 460, mx: 'auto', mb: 3 }}>
              Operational subaccounts give warehouse docks and checkout registers autonomous, zero-friction on-chain signing capabilities without requiring staff to install MetaMask.
            </Typography>
            {isAdmin && (
              <Button
                variant="contained"
                startIcon={<AddCircleOutlineRoundedIcon />}
                onClick={() => setOpenCreateDialog(true)}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Provision Your First Subaccount
              </Button>
            )}
          </Paper>
        ) : filteredSubaccounts.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1', background: '#fff' }}>
            <SearchRoundedIcon sx={{ fontSize: 44, color: '#94a3b8', mb: 1.5 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#475569', mb: 0.5 }}>
              No Subaccounts Match &quot;{searchTerm}&quot;
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 460, mx: 'auto', mb: 2.5 }}>
              No facility name, code, parent account username, or wallet address matched your search.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setSearchTerm('')}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
            >
              Clear Search
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {filteredSubaccounts.map((sub) => {
              const roleTheme = ROLE_COLORS[sub.role] || ROLE_COLORS.retailer;
              const isPending = sub.status === 'pending_approval';
              const isActive = sub.status === 'active';
              const isRevoked = sub.status === 'revoked';
              const isWorking = actionInProgress[sub.id];

              return (
                <Grid item xs={12} md={6} lg={4} key={sub.id}>
                  <Card
                    elevation={0}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 3,
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 12px 24px -10px rgba(0, 0, 0, 0.1)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3, flexGrow: 1 }}>
                      {/* Subaccount Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                            {sub.subaccount_name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                            CODE: <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{sub.facility_code}</span>
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={sub.role.toUpperCase()}
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.68rem',
                            background: roleTheme.bg,
                            color: roleTheme.text,
                            border: `1px solid ${roleTheme.border}`,
                          }}
                        />
                      </Box>

                      {/* Parent Organization */}
                      <Typography variant="caption" sx={{ display: 'block', color: '#94a3b8', mb: 2 }}>
                        Parent Account: <strong style={{ color: '#334155' }}>{sub.parent_username}</strong>
                      </Typography>

                      <Divider sx={{ my: 1.5 }} />

                      {/* Wallet Address Box */}
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, display: 'block', mb: 0.5 }}>
                          EVM OPERATIONAL ADDRESS
                        </Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.2,
                            borderRadius: 2,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                              color: '#1e293b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '190px',
                            }}
                          >
                            {sub.wallet_address}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Copy Address">
                              <IconButton size="small" onClick={() => copyToClipboard(sub.wallet_address, 'wallet address')}>
                                <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View on Etherscan">
                              <IconButton
                                size="small"
                                component="a"
                                href={`${BLOCK_EXPLORER_URL}/address/${sub.wallet_address}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      </Box>

                      {/* Keystore Status & Balance */}
                      <Grid container spacing={1.5}>
                        <Grid item xs={6}>
                          <Box sx={{ p: 1.2, borderRadius: 2, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                              Keystore Custody
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <VpnKeyRoundedIcon sx={{ fontSize: 16, color: '#10b981' }} />
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#10b981' }}>
                                AES-256-GCM
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ p: 1.2, borderRadius: 2, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                              {CHAIN_NAME} gas
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <LocalGasStationRoundedIcon
                                sx={{
                                  fontSize: 16,
                                  color: sub.hasGas ? '#10b981' : '#f59e0b',
                                }}
                              />
                              <Typography
                                variant="caption"
                                sx={{
                                  fontWeight: 700,
                                  color: sub.hasGas ? '#10b981' : '#f59e0b',
                                }}
                              >
                                {sub.balanceEth ? parseFloat(sub.balanceEth).toFixed(4) : '0.0000'} ETH
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Status Indicator */}
                      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isActive && (
                          <Chip
                            icon={<CheckCircleRoundedIcon />}
                            size="small"
                            label="Active"
                            color="success"
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                          />
                        )}
                        {isPending && (
                          <Chip
                            icon={<WarningAmberRoundedIcon />}
                            size="small"
                            label="Pending Approval"
                            color="warning"
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                          />
                        )}
                        {isRevoked && (
                          <Chip
                            icon={<BlockRoundedIcon />}
                            size="small"
                            label="Revoked"
                            color="default"
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                          />
                        )}
                      </Box>
                    </CardContent>

                    <Divider />

                    {/* Card Actions */}
                    <CardActions sx={{ p: 2, justifyContent: 'space-between', background: '#f8fafc' }}>
                      {isAdmin && isPending && (
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          fullWidth
                          disabled={Boolean(isWorking)}
                          onClick={() => handleApproveSubaccount(sub.id)}
                          startIcon={isWorking === 'approving' ? <CircularProgress size={16} color="inherit" /> : <FlashOnRoundedIcon />}
                          sx={{ textTransform: 'none', fontWeight: 700, py: 1 }}
                        >
                          {isWorking === 'approving' ? 'Granting Role & Gas...' : 'Approve & Fund (0.005 ETH)'}
                        </Button>
                      )}

                      {isAdmin && isActive && (
                        <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                          <Button
                            variant="outlined"
                            color="primary"
                            size="small"
                            fullWidth
                            disabled={Boolean(isWorking)}
                            onClick={() => handleFundSubaccount(sub.id)}
                            startIcon={isWorking === 'funding' ? <CircularProgress size={16} /> : <LocalGasStationRoundedIcon />}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
                          >
                            {isWorking === 'funding' ? 'Top-Up...' : 'Top-Up Gas'}
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            disabled={Boolean(isWorking)}
                            onClick={() => handleRevokeSubaccount(sub.id)}
                            sx={{ textTransform: 'none', minWidth: '40px' }}
                          >
                            Revoke
                          </Button>
                        </Box>
                      )}

                      {!isAdmin && (
                        <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic', width: '100%', textAlign: 'center' }}>
                          {isActive ? 'Autonomous Headless Signing Ready' : 'Pending Administrator Onboarding'}
                        </Typography>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>

      {/* Provision Subaccount Dialog (Admin Only) */}
      {isAdmin && (
        <Dialog open={openCreateDialog} onClose={() => !creating && setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>
            Provision Encapsulated Operational Subaccount
          </DialogTitle>
          <form onSubmit={handleCreateSubaccount}>
            <DialogContent dividers>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                A unique Ethereum EVM wallet will be created automatically. The private key is encrypted with AES-256-GCM authenticated encryption and stored securely. Staff members never need to manually handle private keys.
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Facility / Subaccount Name"
                    placeholder="e.g. Austin Fulfillment Dock #4 or Regent St Register #1"
                    value={createForm.subaccountName}
                    onChange={(e) => setCreateForm({ ...createForm, subaccountName: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Facility Code"
                    placeholder="e.g. AUS-DOCK-04"
                    value={createForm.facilityCode}
                    onChange={(e) => setCreateForm({ ...createForm, facilityCode: e.target.value.toUpperCase() })}
                    helperText="Unique uppercase identifier"
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    fullWidth
                    label="Operational Role"
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    disabled={!isAdmin}
                  >
                    <MenuItem value="manufacturer">Manufacturer (Minting & Outbound)</MenuItem>
                    <MenuItem value="supplier">Supplier (Transit & Warehouse)</MenuItem>
                    <MenuItem value="retailer">Retailer (POS Register & Shelf)</MenuItem>
                  </TextField>
                </Grid>
                {isAdmin && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Parent Account Username"
                      placeholder="Username of the organization (optional)"
                      value={createForm.parentUsername}
                      onChange={(e) => setCreateForm({ ...createForm, parentUsername: e.target.value })}
                      helperText="Associate this facility subaccount with an existing organization"
                    />
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2.5 }}>
              <Button onClick={() => setOpenCreateDialog(false)} disabled={creating} sx={{ textTransform: 'none' }}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={creating || !createForm.subaccountName || !createForm.facilityCode}
                startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <SecurityRoundedIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 3,
                }}
              >
                {creating ? 'Generating Keystore...' : 'Provision Keystore & Wallet'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}
    </DashboardShell>
  );
}

