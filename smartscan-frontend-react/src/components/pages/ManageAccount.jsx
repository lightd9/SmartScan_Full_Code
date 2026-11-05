import { Box, Paper, Typography, TextField, MenuItem, Alert, Chip, Avatar, Tooltip, IconButton } from '@mui/material';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import '../shell/shell.css';
import axios from '../../api/axios';
import { DataGrid } from '@mui/x-data-grid';
import { Button } from '@mui/material';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_ID_HEX } from '../../config/contract';
import { formatContractError } from '../../utils/contractErrors';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';

const columns = [
    {
        field: 'name',
        headerName: 'Partner Organization',
        width: 220,
        renderCell: (params) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                    sx={{
                        width: 32,
                        height: 32,
                        fontSize: '0.8rem',
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
        width: 140,
        renderCell: (params) => {
            const status = (params.value || 'unlinked').toLowerCase();
            const isLinked = status === 'linked' || status === 'active';
            const isSuspended = status === 'suspended';
            return (
                <Chip
                    label={status.toUpperCase()}
                    size="small"
                    sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        backgroundColor: isLinked ? '#ECFDF5' : isSuspended ? '#FFFBEB' : '#FEF2F2',
                        color: isLinked ? '#059669' : isSuspended ? '#D97706' : '#DC2626',
                        border: isLinked ? '1px solid #A7F3D0' : isSuspended ? '1px solid #FDE68A' : '1px solid #FECACA',
                        borderRadius: '6px',
                    }}
                />
            );
        },
    },
    {
        field: 'wallet_address',
        headerName: 'Authorized Wallet',
        width: 260,
        renderCell: (params) => {
            const addr = params.value;
            if (!addr || addr === ethers.ZeroAddress) {
                return <Typography variant="caption" sx={{ color: '#9CA3AF', fontStyle: 'italic' }}>Not linked</Typography>;
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
    { field: 'location', headerName: 'Location', width: 180 },
    { field: 'website', headerName: 'Website', width: 180 },
    { field: 'description', headerName: 'Description', width: 260 },
];

const ROLE_IDS = { admin: 1, manufacturer: 2, supplier: 3, retailer: 4 };

const ManageAccount = () => {
    const [rows, setRows] = useState([]);
    const [operations, setOperations] = useState([]);
    const [walletAudit, setWalletAudit] = useState([]);
    const [selected, setSelected] = useState(null);
    const [action, setAction] = useState('suspend');
    const [newWalletAddress, setNewWalletAddress] = useState('');
    const [pendingOperation, setPendingOperation] = useState(null);
    const [executionMode, setExecutionMode] = useState('direct');
    const [safeTxHash, setSafeTxHash] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate()

    useEffect(() => {
        handleData();
    }, []);

    const handleData = async (e) => {
        const [profiles, walletOperations, accountAudit] = await Promise.all([
            axios.get('/profileAll'),
            axios.get('/admin/wallet-operations'),
            axios.get('/admin/wallet-audit'),
        ]);
        setRows(profiles.data);
        setOperations(walletOperations.data);
        setWalletAudit(accountAudit.data);
    }

    const submitWalletOperation = async () => {
        if (!selected && !pendingOperation) return setMessage('Select a business account first.');
        setBusy(true);
        setMessage('');
        try {
            if (!pendingOperation && ['link', 'replace'].includes(action) && !ethers.isAddress(newWalletAddress)) {
                throw new Error('Enter a valid new wallet address.');
            }
            let operation = pendingOperation;
            if (operation && operation.status !== 'ready_onchain') {
                throw new Error('This request is waiting for the business user to prove wallet ownership. The admin must not sign with the user’s wallet.');
            }
            if (!operation) {
                const created = await axios.post('/admin/wallet-operations', {
                    username: selected.username,
                    action,
                    newWalletAddress: ['link', 'replace'].includes(action) ? newWalletAddress : undefined,
                });
                operation = {
                    ...created.data,
                    username: selected.username,
                    role: selected.account_role,
                    businessName: selected.name || selected.username,
                    oldWalletAddress: selected.wallet_address,
                    newWalletAddress: ['link', 'replace'].includes(action) ? newWalletAddress : null,
                };
                setPendingOperation(operation);
            }

            if (executionMode === 'multisig') {
                const multisigTxHash = safeTxHash.trim() || operation.txHash || '';
                if (!multisigTxHash) {
                    setMessage('Wallet proof is recorded. Review the Safe target and calldata below, execute that call through your multisig, then enter the executed transaction hash.');
                    return;
                }
                if (!/^0x[a-fA-F0-9]{64}$/.test(multisigTxHash)) throw new Error('Enter the executed Safe transaction hash.');
                setPendingOperation({ ...operation, txHash: multisigTxHash });
                await axios.post(`/admin/wallet-operations/${operation.operationId}/record-transaction`, { txHash: multisigTxHash });
                await axios.post(`/admin/wallet-operations/${operation.operationId}/complete`, { txHash: multisigTxHash });
                setMessage(`Multisig wallet ${operation.action} completed and audited: ${multisigTxHash}`);
                setPendingOperation(null);
                setSafeTxHash('');
                setNewWalletAddress('');
                await handleData();
                return;
            }

            if (operation.txHash) {
                await axios.post(`/admin/wallet-operations/${operation.operationId}/complete`, { txHash: operation.txHash });
                setMessage(`Wallet ${operation.action} completed and audited: ${operation.txHash}`);
                setPendingOperation(null);
                await handleData();
                return;
            }

            if (!window.ethereum) throw new Error('MetaMask is required for the contract-owner operation.');
            const provider = new ethers.BrowserProvider(window.ethereum);
            await provider.send('wallet_switchEthereumChain', [{ chainId: CHAIN_ID_HEX }]);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            const connectedAddress = await signer.getAddress();
            const owner = await contract.owner();
            if (connectedAddress.toLowerCase() !== owner.toLowerCase()) {
                throw new Error(`Wallet proof is recorded. Switch MetaMask to contract owner ${owner} to execute the on-chain action.`);
            }
            const oldWallet = operation.oldWalletAddress;
            const businessName = operation.businessName;

            const targetWallet = ['link', 'replace'].includes(operation.action) ? operation.newWalletAddress : oldWallet;
            const expectedRoleId = ROLE_IDS[operation.role];
            let currentOnchainRole = 0;
            try {
                currentOnchainRole = Number(await contract.roles(targetWallet));
            } catch (roleErr) {
                console.warn('Could not read on-chain role:', roleErr);
            }

            let txHashToComplete = operation.txHash || null;

            // If the role was already granted or replaced on-chain, recover the mined transaction hash
            if (!txHashToComplete && ['link', 'restore'].includes(operation.action) && currentOnchainRole === expectedRoleId) {
                try {
                    const filter = contract.filters.RoleGranted(targetWallet);
                    const events = await contract.queryFilter(filter, -10000);
                    if (events.length > 0) {
                        txHashToComplete = events[events.length - 1].transactionHash;
                        setMessage(`Found confirmed on-chain role grant transaction: ${txHashToComplete}`);
                    }
                } catch (filterErr) {
                    console.warn('Could not query RoleGranted event filter:', filterErr);
                }
            }

            if (!txHashToComplete) {
                let transaction;
                if (operation.action === 'link') {
                    transaction = await contract.grantRole(operation.newWalletAddress, ROLE_IDS[operation.role], businessName);
                } else if (operation.action === 'replace') {
                    transaction = await contract.replaceRole(oldWallet, operation.newWalletAddress, businessName);
                } else if (operation.action === 'restore') {
                    transaction = await contract.grantRole(oldWallet, ROLE_IDS[operation.role], businessName);
                } else {
                    transaction = await contract.revokeRole(oldWallet);
                }
                setMessage(`Waiting for owner-authorized transaction ${transaction.hash}…`);
                operation = { ...operation, txHash: transaction.hash };
                setPendingOperation(operation);

                // Best-effort mempool notification (ignore if backend RPC has not seen the tx in its mempool yet)
                try {
                    await axios.post(`/admin/wallet-operations/${operation.operationId}/record-transaction`, { txHash: transaction.hash });
                } catch (recordError) {
                    console.warn('Backend mempool pre-record deferred to mined receipt:', recordError.response?.data || recordError.message);
                }

                await transaction.wait();
                txHashToComplete = transaction.hash;
            }

            await axios.post(`/admin/wallet-operations/${operation.operationId}/complete`, { txHash: txHashToComplete });
            setMessage(`Wallet ${operation.action} completed and audited: ${txHashToComplete}`);
            setPendingOperation(null);
            setNewWalletAddress('');
            await handleData();
        } catch (error) {
            setMessage(formatContractError(error, 'Wallet operation failed.'));
            await handleData().catch(() => {});
        } finally {
            setBusy(false);
        }
    };

    const cancelPendingProof = async (operationId = pendingOperation?.operationId) => {
        if (!operationId) return;
        setBusy(true);
        try {
            await axios.post(`/admin/wallet-operations/${operationId}/cancel`);
            if (pendingOperation?.operationId === operationId) setPendingOperation(null);
            setMessage('Pending wallet-proof operation cancelled and audited.');
            await handleData();
        } catch (error) {
            setMessage(formatContractError(error, 'Unable to cancel operation.'));
        } finally { setBusy(false); }
    };

    const reviewOperation = (op) => {
        setSelected(rows.find((row) => row.username === op.username) || null);
        setPendingOperation({
            operationId: op.id, action: op.action, username: op.username, role: op.role,
            businessName: op.business_name, oldWalletAddress: op.old_wallet_address,
            newWalletAddress: op.new_wallet_address, status: op.status, txHash: op.tx_hash,
        });
        setMessage(op.status === 'pending_wallet_proof'
            ? 'Waiting for this business user to sign the wallet ownership challenge.'
            : 'Review the user-proved wallet request, then execute its role change using the contract owner or Safe.');
    };

    const safeCall = (() => {
        if (!pendingOperation || executionMode !== 'multisig' || pendingOperation.status !== 'ready_onchain') return null;
        const iface = new ethers.Interface(CONTRACT_ABI);
        const oldWallet = pendingOperation.oldWalletAddress;
        const businessName = pendingOperation.businessName;
        if (pendingOperation.action === 'link') return { target: CONTRACT_ADDRESS, data: iface.encodeFunctionData('grantRole', [pendingOperation.newWalletAddress, ROLE_IDS[pendingOperation.role], businessName]) };
        if (pendingOperation.action === 'replace') return { target: CONTRACT_ADDRESS, data: iface.encodeFunctionData('replaceRole', [oldWallet, pendingOperation.newWalletAddress, businessName]) };
        if (pendingOperation.action === 'restore') return { target: CONTRACT_ADDRESS, data: iface.encodeFunctionData('grantRole', [oldWallet, ROLE_IDS[pendingOperation.role], businessName]) };
        return { target: CONTRACT_ADDRESS, data: iface.encodeFunctionData('revokeRole', [oldWallet]) };
    })();

    const handleBack = () => {
        navigate(-1)
    }

    return (
        <DashboardShell>
            <GreetingBanner
                title="Account Directory & Corporate Wallets"
                subtitle="Review business-user wallet requests and manage authorized on-chain roles"
                metrics={[
                    {
                        icon: <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>ACC</span>,
                        value: `${rows.length}`,
                        label: 'Provisioned Accounts',
                    },
                    {
                        icon: <span style={{ color: '#10B981', fontWeight: 700 }}>OPS</span>,
                        value: `${operations.length}`,
                        label: 'Audited Wallet Ops',
                    },
                    {
                        icon: <span style={{ color: '#9333EA', fontWeight: 700 }}>EIP</span>,
                        value: 'EIP-191',
                        label: 'Proof Standard',
                    },
                ]}
            />

            {/* Master Account Directory Table Card */}
            <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                            Registered Business Directory
                        </h2>
                        <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                            Select an account below for administrative suspension, restoration, or revocation. Users initiate linking and replacement from their own Profile.
                        </span>
                    </div>
                    {selected && (
                        <span className="status-pill blue">
                            Selected: {selected.name} (@{selected.username})
                        </span>
                    )}
                </div>

                <div style={{ height: 420, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        rowHeight={56}
                        pageSize={5}
                        rowsPerPageOptions={[5]}
                        onRowClick={(params) => setSelected(params.row)}
                    />
                </div>
            </div>

            {/* Wallet Operations Panel */}
            <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    Audited Wallet Key Management
                </h2>
                <Alert severity="info">
                    A business user connects and signs with their own wallet from Profile. Select their proved request in Recent Wallet Operations Audit to grant or replace the on-chain role. The admin never needs the user’s wallet or recovery phrase.
                </Alert>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    Selected Account: <strong>{selected ? `${selected.name} (${selected.username})` : 'None selected (click a row in the table above)'}</strong>
                </span>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                    {!pendingOperation && <TextField select label="Operation Type" value={action} onChange={(event) => setAction(event.target.value)} sx={{ minWidth: 180 }}>
                        {['suspend', 'restore', 'revoke'].map((item) => <MenuItem key={item} value={item}>{item.toUpperCase()}</MenuItem>)}
                    </TextField>}
                    <TextField select label="Owner Execution Mode" value={executionMode} onChange={(event) => setExecutionMode(event.target.value)} sx={{ minWidth: 200 }}>
                        <MenuItem value="direct">Direct Owner Wallet (MetaMask)</MenuItem>
                        <MenuItem value="multisig">Safe / Multisig Contract</MenuItem>
                    </TextField>
                    <button
                        type="button"
                        className="btn-primary-action"
                        onClick={submitWalletOperation}
                        disabled={busy || (!selected && !pendingOperation)}
                    >
                        {pendingOperation ? 'Execute User Wallet Request' : 'Execute Admin Wallet Action'}
                    </button>
                    {pendingOperation?.status === 'pending_wallet_proof' && (
                        <button type="button" className="btn-secondary-action" onClick={() => cancelPendingProof()} disabled={busy}>
                            Cancel Pending Proof
                        </button>
                    )}
                </Box>

                {safeCall && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                        Create and execute a Safe transaction calling the contract below. Then paste the executed transaction hash here and continue; the API verifies the chain receipt, exact role-change event, and resulting role state before updating the account.
                        <TextField fullWidth label="Safe Target Contract" value={safeCall.target} InputProps={{ readOnly: true }} sx={{ mt: 1 }} />
                        <TextField fullWidth multiline minRows={2} label="Safe Transaction Calldata" value={safeCall.data} InputProps={{ readOnly: true }} sx={{ mt: 1 }} />
                        <TextField fullWidth label="Executed Safe Transaction Hash" value={safeTxHash} onChange={(event) => setSafeTxHash(event.target.value)} sx={{ mt: 1 }} />
                    </Alert>
                )}

                {message && (
                    <div style={{ padding: '12px 18px', borderRadius: 10, backgroundColor: message.includes('completed and audited') ? 'var(--status-green-bg)' : 'var(--status-purple-bg)', color: message.includes('completed and audited') ? 'var(--status-green-text)' : 'var(--status-purple-text)', fontSize: '13px', fontWeight: 600 }}>
                        {message}
                    </div>
                )}
            </div>

            {/* Audit Logs Dual Column */}
            <div className="dashboard-grid-dual">
                <div className="dashboard-card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        Recent Wallet Operations Audit
                    </h3>
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {operations.length === 0 ? (
                            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No operations logged yet.</span>
                        ) : (
                            operations.map((op) => (
                                <button type="button" key={op.id} onClick={() => reviewOperation(op)} style={{ textAlign: 'left', cursor: 'pointer', padding: '10px 14px', borderRadius: 8, background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', fontSize: '12.5px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <strong style={{ color: 'var(--color-text-main)' }}>{op.action?.toUpperCase()} · @{op.username}</strong>
                                        <span className="status-pill blue">{op.status}</span>
                                    </div>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '11.5px', display: 'block' }}>
                                        {op.created_at} · Tx: {op.tx_hash ? `${op.tx_hash.slice(0, 16)}...` : 'None'}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="dashboard-card" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        Wallet Key Historical Events
                    </h3>
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {walletAudit.length === 0 ? (
                            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No historical audit events.</span>
                        ) : (
                            walletAudit.map((event, idx) => (
                                <div key={idx} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', fontSize: '12px' }}>
                                    <strong style={{ color: 'var(--color-primary)' }}>@{event.username}</strong> · {event.event_type}
                                    <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '11px', marginTop: 3 }}>
                                        {event.created_at} · {event.wallet_address ? `${event.wallet_address.slice(0, 14)}...` : ''}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}



export default ManageAccount;
