import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import axios from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import '../shell/shell.css';

const STATUS_ORDER = ['pending_wallet', 'submitted', 'failed', 'needs_retry', 'confirmed'];
const STATUS_LABELS = {
    pending_wallet: 'Awaiting wallet',
    submitted: 'Submitted',
    failed: 'Failed',
    needs_retry: 'Needs review / retry',
    confirmed: 'Confirmed',
};

const alertColumns = [
    { field: 'serial_number', headerName: 'Product ID', minWidth: 240, flex: 1 },
    { field: 'outcome', headerName: 'Scan result', width: 130 },
    {
        field: 'flags', headerName: 'Flags', minWidth: 240, flex: 1,
        valueGetter: (params) => Array.isArray(params.row.flags) ? params.row.flags.join(', ') : '',
    },
    { field: 'latitude', headerName: 'Reported latitude', width: 145 },
    { field: 'longitude', headerName: 'Reported longitude', width: 150 },
    {
        field: 'location_source', headerName: 'Location source', minWidth: 210,
        valueFormatter: (params) => params.value === 'browser_reported' ? 'Browser-reported (unverified)' : params.value === 'not_provided' ? 'Not provided' : 'Legacy / unverified',
    },
    { field: 'contract_address', headerName: 'Contract', minWidth: 210, flex: 1 },
    {
        field: 'scanned_at', headerName: 'Scanned at', minWidth: 190, flex: 1,
        valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : '',
    },
];

const productColumns = [
    { field: 'serialnumber', headerName: 'Product ID', minWidth: 240, flex: 1 },
    { field: 'name', headerName: 'Product', minWidth: 150, flex: 1 },
    {
        field: 'chain_status', headerName: 'Chain status', minWidth: 170,
        renderCell: (params) => <Chip size="small" label={STATUS_LABELS[params.value] || params.value || 'Unknown'} color={params.value === 'confirmed' ? 'success' : params.value === 'failed' || params.value === 'needs_retry' ? 'warning' : 'default'} />,
    },
    { field: 'chain_attempt', headerName: 'Attempt', width: 95 },
    { field: 'chain_tx_hash', headerName: 'Transaction', minWidth: 230, flex: 1 },
    { field: 'failure_reason', headerName: 'Failure / retry reason', minWidth: 240, flex: 1 },
];

const passwordEventColumns = [
    { field: 'event_type', headerName: 'Event', width: 170 },
    { field: 'actor_username', headerName: 'Performed by', minWidth: 180, flex: 1 },
    { field: 'target_username', headerName: 'Account', minWidth: 180, flex: 1 },
    {
        field: 'created_at', headerName: 'Time', minWidth: 190, flex: 1,
        valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : '',
    },
];

const unassignedColumns = [
    { field: 'serialnumber', headerName: 'Product ID', minWidth: 220, flex: 1 },
    { field: 'name', headerName: 'Product', minWidth: 150, flex: 1 },
    { field: 'brand', headerName: 'Brand', minWidth: 130, flex: 1 },
    { field: 'chain_status', headerName: 'Registration state', width: 160 },
    { field: 'failure_reason', headerName: 'Last issue', minWidth: 220, flex: 1 },
];
const isCanonicalProductId = (serialNumber) => /^SS-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serialNumber || '');
const generateProductId = () => globalThis.crypto?.randomUUID ? `SS-${globalThis.crypto.randomUUID()}` : '';

export default function AdminOperations() {
    const { auth } = useAuth();
    const [alerts, setAlerts] = useState([]);
    const [products, setProducts] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [passwordEvents, setPasswordEvents] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [attemptsLoading, setAttemptsLoading] = useState(false);
    const [error, setError] = useState('');
    const [attemptsError, setAttemptsError] = useState('');
    const [resetUsername, setResetUsername] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [resetPassword, setResetPassword] = useState('');
    const [confirmResetPassword, setConfirmResetPassword] = useState('');
    const [resetMessage, setResetMessage] = useState('');
    const [resetError, setResetError] = useState('');
    const [resetting, setResetting] = useState(false);
    const [unassignedProducts, setUnassignedProducts] = useState([]);
    const [manufacturerAccounts, setManufacturerAccounts] = useState([]);
    const [assignmentEvents, setAssignmentEvents] = useState([]);
    const [identityRekeyEvents, setIdentityRekeyEvents] = useState([]);
    const [assignmentProduct, setAssignmentProduct] = useState(null);
    const [assignmentUsername, setAssignmentUsername] = useState('');
    const [newSerialNumber, setNewSerialNumber] = useState('');
    const [evidenceReference, setEvidenceReference] = useState('');
    const [sourceRecordVerified, setSourceRecordVerified] = useState(false);
    const [assignmentError, setAssignmentError] = useState('');
    const [assignmentMessage, setAssignmentMessage] = useState('');
    const [assigning, setAssigning] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [alertResponse, productResponse, passwordResponse, unassignedResponse, accountsResponse, assignmentAuditResponse, identityAuditResponse] = await Promise.all([
                axios.get('/admin/scan-alerts'),
                axios.get('/product/chain-status'),
                axios.get('/admin/password-audit'),
                axios.get('/admin/unassigned-products'),
                axios.get('/authAll'),
                axios.get('/admin/manufacturer-assignment-audit'),
                axios.get('/admin/product-identity-rekey-audit'),
            ]);
            setAlerts((alertResponse.data || []).map((row, index) => ({ ...row, id: `${row.serial_number}-${row.scanned_at}-${index}` })));
            setProducts(productResponse.data || []);
            setPasswordEvents(passwordResponse.data || []);
            const unassigned = (unassignedResponse.data || []).map((row) => ({ ...row, id: row.serialnumber }));
            setUnassignedProducts(unassigned);
            setManufacturerAccounts((accountsResponse.data || []).filter((account) => account.role === 'manufacturer'));
            setAssignmentEvents(assignmentAuditResponse.data || []);
            setIdentityRekeyEvents(identityAuditResponse.data || []);
        } catch (requestError) {
            setError(requestError.response?.data?.error || requestError.message || 'Unable to load operational data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const counts = useMemo(() => {
        const tally = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
        products.forEach((product) => {
            if (Object.prototype.hasOwnProperty.call(tally, product.chain_status)) tally[product.chain_status] += 1;
        });
        return tally;
    }, [products]);

    const showAttempts = async (product) => {
        setSelectedProduct(product);
        setAttempts([]);
        setAttemptsError('');
        setAttemptsLoading(true);
        try {
            const response = await axios.get(`/product/${encodeURIComponent(product.serialnumber)}/chain-attempts`);
            setAttempts(response.data || []);
        } catch (requestError) {
            setAttemptsError(requestError.response?.data?.error || requestError.message || 'Unable to load transaction attempts.');
        } finally {
            setAttemptsLoading(false);
        }
    };

    const resetAccountPassword = async (event) => {
        event.preventDefault();
        setResetError('');
        setResetMessage('');
        const target = resetUsername.trim();
        if (!target || target === auth.username) {
            setResetError('Enter another account. To change your own password, use Profile.');
            return;
        }
        if (resetPassword.length < 12) {
            setResetError('The new password must be at least 12 characters.');
            return;
        }
        if (resetPassword !== confirmResetPassword) {
            setResetError('The new passwords do not match.');
            return;
        }
        setResetting(true);
        try {
            await axios.post('/changepsw', {
                username: target,
                currentPassword: adminPassword,
                newPassword: resetPassword,
            });
            setResetUsername('');
            setAdminPassword('');
            setResetPassword('');
            setConfirmResetPassword('');
            setResetMessage('Password reset. All sessions for that account have been revoked.');
            try {
                const audit = await axios.get('/admin/password-audit');
                setPasswordEvents(audit.data || []);
            } catch {
                setResetError('Password reset succeeded, but the audit list could not refresh. Use Refresh to retry.');
            }
        } catch (requestError) {
            setResetError(requestError.response?.data?.error || 'Unable to reset that account password.');
        } finally {
            setResetting(false);
        }
    };

    const assignLegacyManufacturer = async (event) => {
        event.preventDefault();
        setAssignmentError('');
        setAssignmentMessage('');
        if (!assignmentProduct || !assignmentUsername || evidenceReference.trim().length < 8 || !sourceRecordVerified) {
            setAssignmentError('Select a product and manufacturer, verify the source records, and enter a traceable reference of at least 8 characters.');
            return;
        }
        setAssigning(true);
        try {
            await axios.post(`/admin/products/${encodeURIComponent(assignmentProduct.serialnumber)}/assign-manufacturer`, {
                manufacturerUsername: assignmentUsername,
                evidenceReference: evidenceReference.trim(),
                sourceRecordVerified: true,
            });
            setAssignmentMessage(`Manufacturer account assigned to ${assignmentProduct.serialnumber}. This does not confirm blockchain registration or product authenticity.`);
            setAssignmentProduct(null);
            setAssignmentUsername('');
            setEvidenceReference('');
            setSourceRecordVerified(false);
            await load();
        } catch (requestError) {
            setAssignmentError(requestError.response?.data?.error || 'Unable to assign the manufacturer. Verify the source record and refresh the queue.');
        } finally {
            setAssigning(false);
        }
    };

    const rekeyLegacyProduct = async (event) => {
        event.preventDefault();
        setAssignmentError('');
        setAssignmentMessage('');
        if (!assignmentProduct || isCanonicalProductId(assignmentProduct.serialnumber)
            || !isCanonicalProductId(newSerialNumber) || evidenceReference.trim().length < 8 || !sourceRecordVerified) {
            setAssignmentError('Generate a canonical SS-UUID, verify the source records, and enter a traceable reference of at least 8 characters.');
            return;
        }
        const confirmed = window.confirm(`Replace database identity ${assignmentProduct.serialnumber} with ${newSerialNumber}? This cannot be undone here. The old QR will remain invalid. Only continue if you verified the source records.`);
        if (!confirmed) return;
        setAssigning(true);
        try {
            const oldSerialNumber = assignmentProduct.serialnumber;
            await axios.post(`/admin/products/${encodeURIComponent(oldSerialNumber)}/rekey-legacy`, {
                newSerialNumber,
                evidenceReference: evidenceReference.trim(),
                sourceRecordVerified: true,
            });
            setAssignmentMessage(`${oldSerialNumber} was rekeyed as ${newSerialNumber}. The old QR identifier remains invalid; assign a manufacturer only after reviewing its source records.`);
            setAssignmentProduct(null);
            setNewSerialNumber('');
            setEvidenceReference('');
            setSourceRecordVerified(false);
            await load();
        } catch (requestError) {
            setAssignmentError(requestError.response?.data?.error || 'Unable to rekey the legacy identifier. Check its chain status and source records, then refresh.');
        } finally {
            setAssigning(false);
        }
    };

    const attemptColumns = [
        { field: 'attempt_number', headerName: 'Attempt', width: 95 },
        { field: 'status', headerName: 'Status', width: 150 },
        { field: 'transaction_hash', headerName: 'Transaction hash', minWidth: 250, flex: 1 },
        { field: 'sender_address', headerName: 'Sender wallet', minWidth: 230, flex: 1 },
        { field: 'recovered_from_chain', headerName: 'Recovered', width: 110, valueFormatter: (params) => params.value ? 'Yes' : 'No' },
        { field: 'failure_reason', headerName: 'Failure reason', minWidth: 240, flex: 1 },
    ];

    return (
        <DashboardShell>
            <GreetingBanner
                title="Platform Operations & Threat Monitoring"
                subtitle="Live telemetry on scan anomalies, chain reconciliation, and access control"
                actions={
                    <button type="button" className="btn-primary-action" onClick={load} disabled={loading}>
                        <span>{loading ? 'Refreshing…' : 'Refresh Telemetry'}</span>
                    </button>
                }
                metrics={[
                    {
                        icon: <span style={{ color: '#F59E0B', fontWeight: 700 }}>ALERTS</span>,
                        value: `${alerts.length}`,
                        label: 'Threat Scans',
                    },
                    {
                        icon: <span style={{ color: '#10B981', fontWeight: 700 }}>CHAIN</span>,
                        value: `${counts['confirmed'] || 0}`,
                        label: 'Confirmed Products',
                    },
                    {
                        icon: <span style={{ color: counts['needs_retry'] || counts['failed'] ? '#DC2626' : '#8A92A6', fontWeight: 700 }}>RETRY</span>,
                        value: `${(counts['needs_retry'] || 0) + (counts['failed'] || 0)}`,
                        label: 'Recoverable Items',
                    },
                ]}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {loading ? <CircularProgress /> : <>
                <div className="metrics-pill-strip" style={{ marginBottom: 20 }}>
                    {STATUS_ORDER.map((status) => (
                        <span key={status} className={`status-pill ${status === 'confirmed' ? 'green' : status === 'failed' || status === 'needs_retry' ? 'amber' : 'purple'}`}>
                            {STATUS_LABELS[status]}: {counts[status] || 0}
                        </span>
                    ))}
                </div>

                <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Legacy products awaiting ownership review</Typography>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Assign only after checking a reliable source record. This links the database product to a manufacturer account; it does not register the product on-chain or prove authenticity. The product remains unconfirmed until normal wallet and chain verification succeeds.
                    </Alert>
                    {assignmentError && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{assignmentError}</Alert>}
                    {assignmentMessage && <Alert severity="success" role="status" sx={{ mb: 2 }}>{assignmentMessage}</Alert>}
                    <DataGrid autoHeight rows={unassignedProducts} columns={unassignedColumns} getRowId={(row) => row.serialnumber} pageSize={5} rowsPerPageOptions={[5, 10]} onRowClick={(params) => { setAssignmentProduct(params.row); setAssignmentUsername(''); setNewSerialNumber(isCanonicalProductId(params.row.serialnumber) ? '' : generateProductId()); setEvidenceReference(''); setSourceRecordVerified(false); setAssignmentError(''); }} />
                    {!unassignedProducts.length && <Typography color="text.secondary" sx={{ mt: 1 }}>No hashless legacy products are awaiting identity or manufacturer review.</Typography>}
                    {assignmentProduct && !isCanonicalProductId(assignmentProduct.serialnumber) && <Box component="form" onSubmit={rekeyLegacyProduct} sx={{ mt: 2 }}>
                        <Stack spacing={2}>
                            <Typography variant="subtitle1">Repair legacy identifier {assignmentProduct.serialnumber}</Typography>
                            <Alert severity="warning">This legacy ID is not valid for the V2 contract. Rekeying creates a new database identity only after source review and chain checks. The old QR remains invalid; no blockchain product is created, and manufacturer assignment is a separate step.</Alert>
                            <TextField required fullWidth label="New canonical product ID" value={newSerialNumber} onChange={(event) => setNewSerialNumber(event.target.value)} helperText="A new SS-UUID is generated for review. Do not reuse the old QR code." />
                            <TextField required fullWidth label="Source-record evidence reference" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} inputProps={{ minLength: 8, maxLength: 500 }} helperText="Use a traceable source reference; avoid secrets or sensitive personal data." />
                            <FormControlLabel control={<Checkbox checked={sourceRecordVerified} onChange={(event) => setSourceRecordVerified(event.target.checked)} />} label="I verified this old-to-new identity mapping against authoritative source records." />
                            <Button type="submit" variant="contained" disabled={assigning || !sourceRecordVerified || !newSerialNumber || evidenceReference.trim().length < 8}>
                                {assigning ? 'Checking chain and recording rekey…' : 'Record evidence-backed rekey'}
                            </Button>
                        </Stack>
                    </Box>}
                    {assignmentProduct && isCanonicalProductId(assignmentProduct.serialnumber) && <Box component="form" onSubmit={assignLegacyManufacturer} sx={{ mt: 2 }}>
                        <Stack spacing={2}>
                            <Typography variant="subtitle1">Review manufacturer for {assignmentProduct.serialnumber}</Typography>
                            <TextField select required fullWidth label="Manufacturer account" value={assignmentUsername} onChange={(event) => setAssignmentUsername(event.target.value)} helperText="Choose the application account matching your source records.">
                                {manufacturerAccounts.map((account) => <MenuItem key={account.username} value={account.username}>{account.username}</MenuItem>)}
                            </TextField>
                            <TextField required fullWidth label="Source-record evidence reference" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} inputProps={{ minLength: 8, maxLength: 500 }} helperText="Enter a traceable document or archive reference; do not put secrets or sensitive personal data here." />
                            <FormControlLabel control={<Checkbox checked={sourceRecordVerified} onChange={(event) => setSourceRecordVerified(event.target.checked)} />} label="I verified the manufacturer ownership against authoritative source records." />
                            <Button type="submit" variant="contained" disabled={assigning || !manufacturerAccounts.length || evidenceReference.trim().length < 8 || !sourceRecordVerified}>
                                {assigning ? 'Recording reviewed assignment…' : 'Assign after source review'}
                            </Button>
                        </Stack>
                    </Box>}
                </Paper>

                <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Legacy identifier rekey audit</Typography>
                    <DataGrid autoHeight rows={identityRekeyEvents.map((row) => ({ ...row, id: row.id }))} columns={[
                        { field: 'previous_serial_number', headerName: 'Old identifier', minWidth: 180, flex: 1 },
                        { field: 'new_serial_number', headerName: 'New identifier', minWidth: 250, flex: 1 },
                        { field: 'actor_username', headerName: 'Reviewed by', minWidth: 140, flex: 1 },
                        { field: 'evidence_reference', headerName: 'Evidence reference', minWidth: 220, flex: 1 },
                        { field: 'created_at', headerName: 'Recorded at', minWidth: 180, valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : '' },
                    ]} pageSize={5} rowsPerPageOptions={[5, 10]} />
                    {!identityRekeyEvents.length && <Typography color="text.secondary" sx={{ mt: 1 }}>No legacy identifiers have been rekeyed.</Typography>}
                </Paper>

                <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Manufacturer assignment audit</Typography>
                    <DataGrid autoHeight rows={assignmentEvents.map((row) => ({ ...row, id: row.id }))} columns={[
                        { field: 'serial_number', headerName: 'Product ID', minWidth: 200, flex: 1 },
                        { field: 'previous_manufacturer_username', headerName: 'Previous account', minWidth: 160, flex: 1, valueGetter: (params) => params.value || 'Unassigned' },
                        { field: 'new_manufacturer_username', headerName: 'Assigned account', minWidth: 160, flex: 1 },
                        { field: 'actor_username', headerName: 'Reviewed by', minWidth: 140, flex: 1 },
                        { field: 'evidence_reference', headerName: 'Evidence reference', minWidth: 220, flex: 1 },
                        { field: 'created_at', headerName: 'Recorded at', minWidth: 180, valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : '' },
                    ]} pageSize={5} rowsPerPageOptions={[5, 10]} />
                    {!assignmentEvents.length && <Typography color="text.secondary" sx={{ mt: 1 }}>No manufacturer assignments have been recorded.</Typography>}
                </Paper>

                <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Flagged scan events</Typography>
                    <DataGrid autoHeight rows={alerts} columns={alertColumns} pageSize={10} rowsPerPageOptions={[10, 25]} disableSelectionOnClick />
                    {!alerts.length && <Typography color="text.secondary" sx={{ mt: 1 }}>No flagged scans in the most recent 100 alert records.</Typography>}
                </Paper>

                <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Product transaction status</Typography>
                    <Typography color="text.secondary" sx={{ mb: 1 }}>Select a row to inspect its recorded transaction attempts. This page does not submit or confirm transactions.</Typography>
                    <DataGrid autoHeight rows={products} columns={productColumns} getRowId={(row) => row.serialnumber} pageSize={10} rowsPerPageOptions={[10, 25]} onRowClick={(params) => showAttempts(params.row)} />
                    {!products.length && <Typography color="text.secondary" sx={{ mt: 1 }}>No product registrations are recorded.</Typography>}
                </Paper>

                <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Reset a business account password</Typography>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                        Your current admin password is required. The reset revokes all sessions for the selected account.
                    </Typography>
                    {resetError && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{resetError}</Alert>}
                    {resetMessage && <Alert severity="success" role="status" sx={{ mb: 2 }}>{resetMessage}</Alert>}
                    <Box component="form" onSubmit={resetAccountPassword}>
                        <Stack spacing={2}>
                            <TextField required fullWidth label="Account username" autoComplete="off" value={resetUsername}
                                onChange={(event) => setResetUsername(event.target.value)} />
                            <TextField required fullWidth type="password" label="Your current admin password" autoComplete="current-password" value={adminPassword}
                                onChange={(event) => setAdminPassword(event.target.value)} />
                            <TextField required fullWidth type="password" label="New account password" autoComplete="new-password"
                                inputProps={{ minLength: 12, maxLength: 200 }} helperText="Use at least 12 characters."
                                value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
                            <TextField required fullWidth type="password" label="Confirm new password" autoComplete="new-password"
                                inputProps={{ minLength: 12, maxLength: 200 }}
                                value={confirmResetPassword} onChange={(event) => setConfirmResetPassword(event.target.value)} />
                            <Button type="submit" variant="outlined" disabled={resetting}>
                                {resetting ? 'Resetting password…' : 'Reset password and revoke sessions'}
                            </Button>
                        </Stack>
                    </Box>
                </Paper>

                <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Password security events</Typography>
                    <DataGrid autoHeight rows={passwordEvents} columns={passwordEventColumns} getRowId={(row) => row.id} pageSize={10} rowsPerPageOptions={[10, 25]} />
                    {!passwordEvents.length && <Typography color="text.secondary" sx={{ mt: 1 }}>No password changes or resets are recorded.</Typography>}
                </Paper>

                {selectedProduct && <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Attempts for {selectedProduct.serialnumber}</Typography>
                    {attemptsError && <Alert severity="error" sx={{ mb: 1 }}>{attemptsError}</Alert>}
                    {attemptsLoading ? <CircularProgress size={24} /> : <DataGrid autoHeight rows={attempts} columns={attemptColumns} getRowId={(row) => row.attempt_number} pageSize={5} rowsPerPageOptions={[5]} />}
                </Paper>}
            </>}
        </DashboardShell>
    );
}
