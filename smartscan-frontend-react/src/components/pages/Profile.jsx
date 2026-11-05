import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
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
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { BLOCK_EXPLORER_URL, CHAIN_NAME } from '../../config/contract';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

export default function Profile() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletStatus, setWalletStatus] = useState('active');
  const [copied, setCopied] = useState(false);

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
          setWalletAddress(p.wallet_address || auth?.walletAddress || '');
          setWalletStatus(p.wallet_status || 'active');
        } else if (auth?.walletAddress) {
          setWalletAddress(auth.walletAddress);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        if (auth?.walletAddress) setWalletAddress(auth.walletAddress);
      }
    }

    loadProfile();
  }, [auth.username, auth?.walletAddress]);

  const copyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
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
        subtitle="Account Configuration & Enterprise Cryptographic Vault"
        metrics={[
          {
            icon: <BusinessRoundedIcon sx={{ fontSize: 17, color: 'var(--color-primary)' }} />,
            value: (role || auth?.role || 'PARTNER').toUpperCase(),
            label: 'Assigned Role',
          },
          {
            icon: <CheckCircleRoundedIcon sx={{ fontSize: 17, color: '#10B981' }} />,
            value: 'Vault Active',
            label: 'Automated Signing',
          },
          {
            icon: <SecurityRoundedIcon sx={{ fontSize: 17, color: '#2563EB' }} />,
            value: 'AES-256-GCM',
            label: 'Keystore Protection',
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
                  {(role || auth?.role || '').toUpperCase()}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AccountBalanceWalletOutlinedIcon sx={{ color: 'var(--color-primary)', fontSize: 20 }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Enterprise Vault Wallet
                </h3>
              </div>
              <span className="vault-pill">Vault Active</span>
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
                  Active Operational Address
                </span>
                <span className="status-pill green">
                  {walletStatus === 'active' || walletStatus === 'linked' ? 'Ready & Funded' : 'Active'}
                </span>
              </div>
              <code style={{ fontSize: '13px', color: 'var(--color-text-main)', wordBreak: 'break-all', display: 'block', marginBottom: 10 }}>
                {walletAddress || '— Auto-provisioning vault key...'}
              </code>

              {walletAddress && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="btn-secondary-action"
                    style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <ContentCopyRoundedIcon sx={{ fontSize: 13 }} />
                    <span>{copied ? 'Copied!' : 'Copy Address'}</span>
                  </button>

                  <a
                    href={`${BLOCK_EXPLORER_URL}/address/${walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary-action"
                    style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                  >
                    <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                    <span>View on {CHAIN_NAME} explorer</span>
                  </a>
                </div>
              )}
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              This account utilizes an encapsulated subaccount vault. Transactions are signed headlessly and gas is replenished automatically by the system treasury. No browser extensions or manual private key handling is required.
            </p>

            <button
              type="button"
              className="btn-primary-action"
              style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => navigate('/subaccounts')}
            >
              <span>Manage Facility Subaccounts & Gas Treasury</span>
              <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
            </button>
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
              className="btn-primary-action"
              disabled={changingPassword}
              style={{ justifyContent: 'center', marginTop: 4 }}
            >
              {changingPassword ? 'Updating credentials…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
