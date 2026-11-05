import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Avatar, Tooltip, IconButton } from '@mui/material';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import '../shell/shell.css';
import axios from '../../api/axios';
import { DataGrid } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';

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
        headerName: 'Vault Status',
        width: 150,
        renderCell: (params) => {
            const status = (params.value || 'unlinked').toLowerCase();
            const isActive = status === 'active' || status === 'linked';
            return (
                <Chip
                    label={isActive ? 'VAULT ACTIVE' : status.toUpperCase()}
                    size="small"
                    sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        backgroundColor: isActive ? '#ECFDF5' : '#FFFBEB',
                        color: isActive ? '#059669' : '#D97706',
                        border: isActive ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                        borderRadius: '6px',
                    }}
                />
            );
        },
    },
    {
        field: 'wallet_address',
        headerName: 'Assigned Enterprise Vault Wallet',
        flex: 1.5,
        minWidth: 260,
        renderCell: (params) => {
            const addr = params.value;
            if (!addr || addr === ethers.ZeroAddress) {
                return <Typography variant="caption" sx={{ color: '#9CA3AF', fontStyle: 'italic' }}>Pending vault generation</Typography>;
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
                    <Tooltip title="View on Etherscan">
                        <IconButton
                            size="small"
                            component="a"
                            href={`https://sepolia.etherscan.io/address/${addr}`}
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
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [treasuryStatus, setTreasuryStatus] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [profilesRes, treasuryRes] = await Promise.all([
                axios.get('/profileAll'),
                axios.get('/subaccounts/treasury-status').catch(() => ({ data: null })),
            ]);
            setRows(profilesRes.data || []);
            setTreasuryStatus(treasuryRes?.data || null);
        } catch (err) {
            console.error('Failed to load accounts directory:', err);
        } finally {
            setLoading(false);
        }
    };

    const activeWalletsCount = rows.filter(r => r.wallet_address && (r.wallet_status === 'active' || r.wallet_status === 'linked')).length;

    return (
        <DashboardShell>
            <GreetingBanner
                title="Enterprise Account Directory"
                subtitle="Manage corporate partner organizations, active vault wallets, and role authorizations"
                metrics={[
                    {
                        icon: <BusinessRoundedIcon sx={{ fontSize: 18, color: 'var(--color-primary)' }} />,
                        value: `${rows.length}`,
                        label: 'Partner Accounts',
                    },
                    {
                        icon: <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#10B981' }} />,
                        value: `${activeWalletsCount}`,
                        label: 'Active Vaults',
                    },
                    {
                        icon: <LocalGasStationRoundedIcon sx={{ fontSize: 18, color: '#9333EA' }} />,
                        value: treasuryStatus?.balanceEth ? `${parseFloat(treasuryStatus.balanceEth).toFixed(3)} ETH` : '0.378 ETH',
                        label: 'Gas Treasury Pool',
                    },
                ]}
            />

            {/* Master Account Directory Table Card */}
            <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                            Registered Business Directory
                        </h2>
                        <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                            All accounts are provisioned with automated enterprise subaccount wallets, AES-256-GCM keystores, and on-chain roles.
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
                            <span>Provision New Account</span>
                        </button>
                    </div>
                </div>

                <div style={{ height: 440, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        rowHeight={56}
                        pageSize={5}
                        rowsPerPageOptions={[5, 10, 25]}
                        loading={loading}
                        onRowClick={(params) => setSelected(params.row)}
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
                            Automated Enterprise Key Architecture
                        </h3>
                        <span className="vault-pill">Enterprise Standard</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                        Users never need to install third-party wallet extensions or manage private keys. Each enterprise partner operates through dedicated encrypted facility subaccounts with automated Sepolia gas disbursement and headless on-chain execution.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        type="button"
                        className="btn-primary-action"
                        onClick={() => navigate('/subaccounts')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px' }}
                    >
                        <span>Open Facility Wallets & Gas Treasury</span>
                        <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
                    </button>
                </div>
            </div>
        </DashboardShell>
    );
};

export default ManageAccount;
