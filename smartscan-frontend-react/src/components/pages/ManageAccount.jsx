import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Avatar, Tooltip, IconButton } from '@mui/material';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import '../shell/shell.css';
import axios from '../../api/axios';
import { DataGrid } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { BLOCK_EXPLORER_URL, CHAIN_NAME, NATIVE_CURRENCY_SYMBOL } from '../../config/contract';

// Material Icons
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

const columns = [
    {
        field: 'name',
        headerName: 'Partner Organization',
        flex: 1.2,
        minWidth: 220,
        renderCell: (params) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                    sx={{
                        width: 34,
                        height: 34,
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        backgroundColor: '#EFF6FF',
                        color: '#2563EB',
                        border: '1px solid #BFDBFE',
                    }}
                >
                    {(params.row.name || params.row.username || 'P').charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>
                        {params.row.name || params.row.username}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.75rem' }}>
                        @{params.row.username}
                    </Typography>
                </Box>
            </Box>
        ),
    },
    {
        field: 'account_role',
        headerName: 'Role',
        width: 140,
        renderCell: (params) => {
            const role = (params.value || '').toLowerCase();
            const colorMap = {
                admin: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
                manufacturer: { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' },
                supplier: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
                retailer: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
            };
            const style = colorMap[role] || { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
            return (
                <Chip
                    label={role.toUpperCase()}
                    size="small"
                    sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        backgroundColor: style.bg,
                        color: style.text,
                        border: `1px solid ${style.border}`,
                        borderRadius: '6px',
                    }}
                />
            );
        },
    },
    {
        field: 'wallet_status',
        headerName: 'Wallet Status',
        width: 170,
        renderCell: (params) => {
            const status = (params.value || 'unlinked').toLowerCase();
            const isActive = status === 'active' || status === 'linked';
            const isProblem = ['suspended', 'revoked'].includes(status);
            const statusLabels = {
                active: 'Active',
                linked: 'Linked',
                pending_onchain: 'Approval pending',
                suspended: 'Suspended',
                revoked: 'Revoked',
                unlinked: 'Not linked',
            };
            return (
                <Chip
                    label={statusLabels[status] || 'Unavailable'}
                    size="small"
                    sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        backgroundColor: isActive ? '#ECFDF5' : isProblem ? '#FEF2F2' : status === 'pending_onchain' ? '#FFFBEB' : '#F3F4F6',
                        color: isActive ? '#059669' : isProblem ? '#B91C1C' : status === 'pending_onchain' ? '#B45309' : '#4B5563',
                        border: isActive ? '1px solid #A7F3D0' : isProblem ? '1px solid #FECACA' : status === 'pending_onchain' ? '1px solid #FDE68A' : '1px solid #E5E7EB',
                        borderRadius: '6px',
                    }}
                />
            );
        },
    },
    {
        field: 'wallet_address',
        headerName: 'Linked Wallet Address',
        flex: 1.5,
        minWidth: 260,
        renderCell: (params) => {
            const addr = params.value;
            if (!addr || addr === ethers.ZeroAddress) {
                return <Typography variant="caption" sx={{ color: '#9CA3AF', fontStyle: 'italic' }}>Pending wallet generation</Typography>;
            }
            const short = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 600, color: '#1E293B' }}>
                        {short}
                    </Typography>
                    <Tooltip title="Copy address">
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(addr);
                            }}
                            sx={{ p: 0.5 }}
                        >
                            <ContentCopyRoundedIcon sx={{ fontSize: 14, color: '#64748B' }} />
                        </IconButton>
                    </Tooltip>
                        <Tooltip title={`View on ${CHAIN_NAME} explorer`}>
                        <IconButton
                            size="small"
                            component="a"
                            href={`${BLOCK_EXPLORER_URL}/address/${addr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            sx={{ p: 0.5 }}
                        >
                            <OpenInNewRoundedIcon sx={{ fontSize: 14, color: '#64748B' }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            );
        },
    },
    { field: 'location', headerName: 'Headquarters', width: 160 },
    { field: 'website', headerName: 'Website', width: 160 },
];

const ManageAccount = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [treasuryStatus, setTreasuryStatus] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const [profilesRes, treasuryRes] = await Promise.all([
                axios.get('/profileAll'),
                axios.get('/api/subaccounts/treasury-status').catch(() => ({ data: null })),
            ]);
            setRows(profilesRes.data || []);
            setTreasuryStatus(treasuryRes?.data || null);
        } catch (err) {
            console.error('Failed to load accounts directory:', err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    const activeWalletsCount = rows.filter(r => r.wallet_address && (r.wallet_status === 'active' || r.wallet_status === 'linked')).length;
    const treasuryBalance = Number(treasuryStatus?.balanceEth);
    const treasuryValue = loading
        ? 'Loading…'
        : !treasuryStatus
            ? 'Unavailable'
            : !treasuryStatus.configured
                ? 'Not configured'
                : treasuryStatus.error || !Number.isFinite(treasuryBalance)
                    ? 'Unavailable'
                    : `${treasuryBalance.toFixed(3)} ${NATIVE_CURRENCY_SYMBOL}`;

    return (
        <DashboardShell>
            <GreetingBanner
                title="Partner Organizations"
                subtitle="Manage business accounts, wallet authorizations, and facility keystores"
                metrics={[
                    {
                        icon: <BusinessRoundedIcon sx={{ fontSize: 18, color: 'var(--color-primary)' }} />,
                        value: loading ? 'Loading…' : `${rows.length}`,
                        label: 'Partner Accounts',
                    },
                    {
                        icon: <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#10B981' }} />,
                        value: loading ? 'Loading…' : `${activeWalletsCount}`,
                        label: 'Active Wallets',
                    },
                    {
                        icon: <LocalGasStationRoundedIcon sx={{ fontSize: 18, color: '#9333EA' }} />,
                        value: treasuryValue,
                        label: 'Gas Treasury Pool',
                    },
                ]}
            />

            {loadError && (
                <p className="dashboard-error" role="alert">
                    Account data could not be refreshed. <button type="button" className="inline-retry-button" onClick={loadData}>Try again</button>
                </p>
            )}

            {/* Master Account Directory Table Card */}
            <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                            Registered Businesses
                        </h2>
                        <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                            Review account roles, wallet links, and on-chain approval status.
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            type="button"
                            className="btn-secondary-action"
                            onClick={() => navigate('/subaccounts')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <AccountBalanceWalletRoundedIcon sx={{ fontSize: 17 }} />
                            <span>Facility Wallets & Treasury</span>
                        </button>

                        <button
                            type="button"
                            className="btn-primary-action"
                            onClick={() => navigate('/add-account')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <AddRoundedIcon sx={{ fontSize: 18 }} />
                            <span>Provision Account</span>
                        </button>
                    </div>
                </div>

                <div style={{ height: 440, width: '100%', borderRadius: 12, overflow: 'auto', border: '1px solid var(--color-border)' }}>
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        rowHeight={56}
                        disableRowSelectionOnClick
                        pageSize={5}
                        rowsPerPageOptions={[5, 10, 25]}
                        loading={loading}
                        sx={{
                            border: 'none',
                            '& .MuiDataGrid-columnHeaders': {
                                backgroundColor: 'var(--color-surface-subtle)',
                                fontWeight: 700,
                            },
                            '& .MuiDataGrid-row:hover': {
                                backgroundColor: 'var(--color-surface-hover)',
                            },
                        }}
                    />
                </div>
            </div>

            {/* Modern Enterprise Subaccount Vault Banner */}
            <div
                className="dashboard-card"
                style={{
                    padding: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 20,
                    background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.04) 0%, rgba(16, 185, 129, 0.04) 100%)',
                    border: '1px solid rgba(37, 99, 235, 0.15)',
                }}
            >
                <div style={{ maxWidth: 680 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <SecurityRoundedIcon sx={{ color: 'var(--color-primary)', fontSize: 22 }} />
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--color-text-main)' }}>
                            Automated Key Management & Treasury
                        </h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                        Partners operate through encrypted facility wallets with automated {CHAIN_NAME} gas funding and seamless custody verification.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        type="button"
                        className="btn-primary-action"
                        onClick={() => navigate('/subaccounts')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px' }}
                    >
                        <span>Manage Facility Wallets</span>
                        <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
                    </button>
                </div>
            </div>
        </DashboardShell>
    );
};

export default ManageAccount;
