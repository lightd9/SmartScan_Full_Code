import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { ethers } from 'ethers';
import useAuth from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import '../shell/shell.css';

// Material Icons
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

export default function Profile() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletStatus, setWalletStatus] = useState('unlinked');
  const [walletPendingAddress, setWalletPendingAddress] = useState('');
  const [walletOperationStatus, setWalletOperationStatus] = useState('');
  const [walletMessage, setWalletMessage] = useState('');
  const [linkingWallet, setLinkingWallet] = useState(false);

  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await axios.get(`/profile/${auth.username}`);
        if (res?.data?.[0]) {
          const p = res.data[0];
          setName(p.name || '');
          setDescription(p.description || '');
          setRole(p.account_role || p.role || '');
          setWebsite(p.website || '');
          setLocation(p.location || '');
          setWalletAddress(p.wallet_address || '');
          setWalletStatus(p.wallet_status || 'unlinked');
        }
        const pending = await axios.get('/wallet-link/status');
        if (pending.data?.operation) {
          const operation = pending.data.operation;
          setWalletOperationStatus(operation.status);
          setWalletPendingAddress(operation.new_wallet_address || '');
          if (operation.action === 'link' && operation.status === 'ready_onchain') {
            setWalletAddress(operation.new_wallet_address || '');
            setWalletStatus('pending_onchain');
          } else if (operation.action === 'link' && operation.status === 'pending_wallet_proof') {
            setWalletAddress(operation.new_wallet_address || '');
            setWalletStatus('proof_pending');
          }
        } else { setWalletPendingAddress(''); setWalletOperationStatus(''); }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    }

    loadProfile();
  }, [auth.username]);

  const linkWallet = async () => {
    setLinkingWallet(true);
    setWalletMessage('');
    try {
      if (!window.ethereum) throw new Error('Install or enable MetaMask to link a business wallet.');
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const challenge = await axios.post('/wallet-link/challenge', { walletAddress: address });
      const signature = await signer.signMessage(challenge.data.message);
      const verified = await axios.post('/wallet-link/verify', {
        challengeId: challenge.data.challengeId,
        signature,
      });
      setWalletAddress(verified.data.walletAddress);
      setWalletStatus(verified.data.walletStatus);
      setWalletPendingAddress(verified.data.pendingWalletAddress || '');
      setWalletOperationStatus(verified.data.operationStatus || '');
      setWalletMessage(verified.data.operationStatus === 'ready_onchain'
        ? 'Wallet ownership verified. The administrator can now see this request and must approve the on-chain role before it takes effect.'
        : verified.data.walletStatus === 'active'
        ? 'Wallet linked and verified. Blockchain writes are enabled for this account.'
        : 'Wallet ownership verified. Your wallet is visible to the administrator and will be enabled for blockchain writes after its on-chain role is approved.');
    } catch (error) {
      setWalletMessage(error.response?.data?.error || error.message || 'Unable to link wallet.');
    } finally {
      setLinkingWallet(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    if (newPassword.length < 12) {
      setPasswordError('Choose a password with at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      await axios.post('/changepsw', { currentPassword, newPassword });
      logout();
      navigate('/login', { replace: true, state: { message: 'Password changed. Sign in again with your new password.' } });
    } catch (error) {
      setPasswordError(error.response?.data?.error || 'Unable to change password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const rolePillColor =
    role === 'manufacturer'
      ? 'green'
      : role === 'supplier'
      ? 'purple'
      : role === 'retailer'
      ? 'blue'
      : 'amber';

  return (
    <DashboardShell>
      {/* Header Greeting */}
      <GreetingBanner
        title={`Profile & Security, ${name || auth?.username || 'Partner'}`}
        subtitle="Account Configuration & Cryptographic Keys"
        metrics={[
          {
            icon: <BusinessRoundedIcon sx={{ fontSize: 17, color: 'var(--color-primary)' }} />,
            value: role.toUpperCase(),
            label: 'Assigned Role',
          },
          {
            icon: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 17, color: walletAddress ? '#10B981' : '#F59E0B' }} />,
            value: walletStatus === 'linked' || walletStatus === 'active' ? 'Verified' : 'Action Required',
            label: 'Wallet Key Status',
          },
          {
            icon: <SecurityRoundedIcon sx={{ fontSize: 17, color: '#2563EB' }} />,
            value: 'Scrypt + JWT',
            label: 'Active Protection',
          },
        ]}
      />

      {/* Two Column Layout Matching Template Grid */}
      <div className="dashboard-grid-dual">
        {/* Card 1: Organization Profile Details */}
        <div className="dashboard-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '16px',
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 700,
                border: '1px solid var(--color-border)',
              }}
            >
              {(name || auth?.username || 'U').charAt(0).toUpperCase()}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  {name || auth?.username}
                </h2>
                <span className={`status-pill ${rolePillColor}`}>
                  {role.toUpperCase()}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                @{auth?.username}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Business Description
              </span>
              <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'var(--color-text-main)', lineHeight: 1.5 }}>
                {description || 'No corporate description provided yet.'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '13.5px', color: 'var(--color-text-secondary)' }}>
              <LanguageRoundedIcon sx={{ fontSize: 18, color: 'var(--color-text-muted)' }} />
              <span>{website ? <a href={website} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)' }}>{website}</a> : 'No website listed'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '13.5px', color: 'var(--color-text-secondary)' }}>
              <PlaceOutlinedIcon sx={{ fontSize: 18, color: 'var(--color-text-muted)' }} />
              <span>{location || 'Headquarters location not specified'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Cryptographic Wallet & Security Center */}
        <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Business Wallet Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AccountBalanceWalletOutlinedIcon sx={{ color: 'var(--color-primary)', fontSize: 20 }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                Authorized Blockchain Wallet
              </h3>
            </div>

            <div
              style={{
                background: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  {walletStatus === 'active' ? 'Active Signing Address' : 'Wallet address'}
                </span>
                <span className={`status-pill ${walletStatus === 'active' ? 'green' : 'amber'}`}>
                  {walletStatus === 'active' ? 'Active' : walletStatus === 'pending_onchain' ? 'Awaiting admin approval' : walletStatus === 'proof_pending' ? 'Awaiting your signature' : walletAddress ? walletStatus : 'Unlinked'}
                </span>
              </div>
              <code style={{ fontSize: '13px', color: 'var(--color-text-main)', wordBreak: 'break-all', display: 'block' }}>
                {walletAddress || '— No wallet linked to this account'}
              </code>
            </div>

            {walletMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: walletStatus === 'active' ? 'var(--status-green-bg)' : 'var(--color-surface-subtle)',
                  color: walletStatus === 'active' ? 'var(--status-green-text)' : 'var(--color-text-secondary)',
                  fontSize: '12.5px',
                  marginBottom: 12,
                }}
              >
                {walletMessage}
              </div>
            )}

            {!walletAddress || (walletStatus === 'active' && !walletPendingAddress) || walletOperationStatus === 'pending_wallet_proof' ? (
              <button
                type="button"
                className="btn-primary-action"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={linkWallet}
                disabled={linkingWallet}
              >
                {linkingWallet ? 'Signing Verification Challenge…' : walletOperationStatus === 'pending_wallet_proof' ? 'Resume Wallet Verification' : walletAddress ? 'Replace Business Wallet' : 'Connect Your Wallet'}
              </button>
            ) : (
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                Your wallet ownership is verified. It becomes usable for supply-chain actions after the administrator approves its on-chain role. You do not need to share your wallet or recovery phrase.
              </p>
            )}

            {walletPendingAddress && walletStatus === 'active' && (
              <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>
                {walletOperationStatus === 'pending_wallet_proof' ? 'Replacement awaiting your wallet signature:' : 'Replacement proof verified; awaiting administrator approval:'} <code>{walletPendingAddress}</code>. Your current wallet remains active until the on-chain change is confirmed.
              </p>
            )}

            {walletAddress && walletStatus === 'active' && (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Supply-chain writes on IdenteefiV2 are authorized only when this connected address matches transactions.
              </p>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--color-divider)' }}></div>

          {/* Password Change Form */}
          <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyOutlinedIcon sx={{ color: 'var(--color-primary)', fontSize: 20 }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                Change Password & Session Control
              </h3>
            </div>

            {passwordError && (
              <div style={{ background: 'var(--status-red-bg)', color: 'var(--status-red-text)', padding: '8px 12px', borderRadius: '8px', fontSize: '12.5px' }}>
                {passwordError}
              </div>
            )}

            <input
              type="password"
              placeholder="Current password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-input)',
                border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-main)',
                fontSize: '13.5px',
              }}
            />

            <input
              type="password"
              placeholder="New password (minimum 12 characters)"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-input)',
                border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-main)',
                fontSize: '13.5px',
              }}
            />

            <input
              type="password"
              placeholder="Confirm new password"
              required
              minLength={12}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-input)',
                border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-main)',
                fontSize: '13.5px',
              }}
            />

            <button
              type="submit"
              className="btn-secondary-action"
              style={{ justifyContent: 'center', marginTop: 4 }}
              disabled={changingPassword}
            >
              {changingPassword ? 'Revoking Sessions…' : 'Update Password & Invalidate Other Sessions'}
            </button>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
