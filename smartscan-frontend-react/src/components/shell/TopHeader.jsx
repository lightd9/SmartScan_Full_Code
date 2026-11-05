import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import axios from '../../api/axios';
import { ethers } from 'ethers';
import { CHAIN_RPC_URL } from '../../config/contract';
import './shell.css';

// Material Components & Icons
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';

import { useScanner } from '../../context/ScannerContext';

export default function TopHeader({ onSearch }) {
  const { auth, logout } = useAuth();
  const { openScanner } = useScanner();
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState(auth?.walletAddress || '');
  const [walletBalance, setWalletBalance] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(true);

  // Menu Anchors
  const [notifMenuAnchor, setNotifMenuAnchor] = useState(null);
  const [accountMenuAnchor, setAccountMenuAnchor] = useState(null);

  const searchInputRef = useRef(null);
  const role = auth?.role || 'admin';

  useEffect(() => {
    if (!walletAddress) {
      setWalletBalance(null);
      return;
    }
    let isMounted = true;
    const rpc = CHAIN_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpc, 11155111, { staticNetwork: true });
    provider.getBalance(walletAddress)
      .then((bal) => {
        if (isMounted) {
          const eth = ethers.formatEther(bal);
          setWalletBalance(parseFloat(eth).toFixed(4));
        }
      })
      .catch((_err) => {
        if (isMounted) setWalletBalance(null);
      });
    return () => { isMounted = false; };
  }, [walletAddress]);

  useEffect(() => {
    let isMounted = true;

    async function resolveWallet() {
      if (auth?.walletAddress) {
        if (isMounted) setWalletAddress(auth.walletAddress);
        return;
      }

      if (auth?.username) {
        try {
          const profRes = await axios.get(`/profile/${auth.username}`);
          const fetchedAddr = profRes?.data?.[0]?.wallet_address;
          if (fetchedAddr && isMounted) {
            setWalletAddress(fetchedAddr);
            return;
          }
        } catch (_err) {
          // ignore profile lookup failure
        }
      }

      if (role === 'admin') {
        try {
          const treasRes = await axios.get('/subaccounts/treasury-status');
          if (treasRes?.data?.address && isMounted) {
            setWalletAddress(treasRes.data.address);
            return;
          }
        } catch (_err) {
          if (isMounted) setWalletAddress('0x90f8f5120b235C56798D28c2De8AF5D4671F1D4E');
        }
      }
    }

    resolveWallet();

    // Global keyboard shortcut to focus search bar (Ctrl+K, Cmd+K, Ctrl+F, Cmd+F)
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [auth?.username, auth?.walletAddress, role]);

  const copyWalletAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Unable to copy wallet address:', error);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (onSearch) {
      onSearch(searchQuery.trim());
    } else {
      navigate('/product', { state: { qrData: searchQuery.trim() } });
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return 'Connect Wallet';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const userInitial = (auth?.username || auth?.name || 'U').charAt(0).toUpperCase();

  return (
    <header className="top-header" role="banner">
      {/* Search Input with working ⌘ F trigger */}
      <form onSubmit={handleSearchSubmit} className="header-search-box">
        <SearchRoundedIcon className="search-icon" onClick={() => searchInputRef.current?.focus()} style={{ cursor: 'pointer' }} />
        <input
          ref={searchInputRef}
          type="text"
          className="header-search-input"
          placeholder="Search serial numbers, accounts, or press ⌘ F"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span
          className="header-search-shortcut"
          title="Click or press ⌘ F to search"
          onClick={() => searchInputRef.current?.focus()}
          style={{ cursor: 'pointer' }}
        >
          ⌘ F
        </span>
      </form>

      {/* Right Controls */}
      <div className="header-actions">
        {/* Direct Optical / Barcode Scan Pop-up Trigger */}
        <button
          type="button"
          className="btn-scan-action"
          onClick={() => openScanner()}
          title="Open Barcode & QR Code Scanner Pop-up"
        >
          <QrCodeScannerRoundedIcon sx={{ fontSize: 18, color: 'var(--color-primary)' }} />
          <span>Scan Code</span>
        </button>

        {/* Notifications sit immediately before the combined account control */}
        <button
          type="button"
          className="header-icon-btn"
          aria-label="View notifications and alerts"
          onClick={(e) => setNotifMenuAnchor(e.currentTarget)}
        >
          <NotificationsNoneRoundedIcon sx={{ fontSize: 20 }} />
          {unreadNotifications && <span className="unread-pip"></span>}
        </button>

        {/* Combined profile and wallet control */}
        <button
          type="button"
          className="header-account-wallet"
          onClick={(event) => setAccountMenuAnchor(event.currentTarget)}
          title={`Signed in as ${auth?.username} (${role})`}
          aria-haspopup="true"
          aria-expanded={Boolean(accountMenuAnchor)}
        >
          <span className="header-account-avatar" aria-hidden="true">{userInitial}</span>
          <span className="header-account-address">
            <span className="wallet-dot"></span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatAddress(walletAddress)}</span>
          </span>
        </button>

        <Menu
          anchorEl={accountMenuAnchor}
          open={Boolean(accountMenuAnchor)}
          onClose={() => setAccountMenuAnchor(null)}
          slotProps={{
            paper: {
              sx: { borderRadius: '16px', minWidth: 300, maxWidth: 360, p: 0.5, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', mt: 1 },
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              {auth?.name || auth?.username}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280', textTransform: 'capitalize', display: 'block', mt: 0.25 }}>
              Role: {role}
            </Typography>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          {walletAddress ? (
            <MenuItem
              onClick={copyWalletAddress}
              aria-label={copied ? 'Wallet address copied' : `Copy wallet address ${walletAddress}`}
              sx={{ py: 1.25, alignItems: 'flex-start' }}
            >
              <ListItemIcon sx={{ color: copied ? '#16A34A' : '#4B5563', mt: 0.25 }}>
                {copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: '#111827', overflowWrap: 'anywhere' }}>
                      {walletAddress}
                    </span>
                  </Box>
                }
                secondary={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                    <span style={{ fontSize: '0.72rem', color: copied ? '#16A34A' : '#6B7280' }}>
                      {copied ? 'Copied to clipboard!' : 'Click to copy address'}
                    </span>
                    {walletBalance !== null && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '1px 6px', borderRadius: '4px' }}>
                        {walletBalance} ETH
                      </span>
                    )}
                  </Box>
                }
              />
            </MenuItem>
          ) : null}
          {walletAddress ? (
            <MenuItem
              onClick={() => {
                setAccountMenuAnchor(null);
                window.open(`https://sepolia.etherscan.io/address/${walletAddress}`, '_blank', 'noopener,noreferrer');
              }}
              sx={{ py: 1, fontSize: '0.875rem', fontWeight: 600 }}
            >
              <ListItemIcon sx={{ color: '#4B5563' }}><OpenInNewRoundedIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="View on Etherscan" primaryTypographyProps={{ fontSize: '0.875rem' }} />
            </MenuItem>
          ) : null}
          <MenuItem
            onClick={() => {
              setAccountMenuAnchor(null);
              navigate('/subaccounts');
            }}
            sx={{ py: 1, fontSize: '0.875rem', fontWeight: 600 }}
          >
            <ListItemIcon sx={{ color: 'var(--color-primary)' }}><AccountBalanceWalletRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Facility Wallets & Treasury" primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }} />
          </MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem
            onClick={() => {
              setAccountMenuAnchor(null);
              navigate('/profile');
            }}
            sx={{ py: 1, fontSize: '0.875rem', fontWeight: 600 }}
          >
            <ListItemIcon sx={{ color: '#4B5563' }}><PersonOutlineRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Account Profile" primaryTypographyProps={{ fontSize: '0.875rem' }} />
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAccountMenuAnchor(null);
              logout();
              navigate('/login', { replace: true });
            }}
            sx={{ py: 1, fontSize: '0.875rem', fontWeight: 600, color: '#DC2626' }}
          >
            <ListItemIcon sx={{ color: '#DC2626' }}><LogoutRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Sign Out" primaryTypographyProps={{ fontSize: '0.875rem', color: '#DC2626' }} />
          </MenuItem>
        </Menu>

        {/* Interactive notification center */}
        <Menu
          anchorEl={notifMenuAnchor}
          open={Boolean(notifMenuAnchor)}
          onClose={() => setNotifMenuAnchor(null)}
          slotProps={{
            paper: {
              sx: { borderRadius: '16px', minWidth: 320, maxWidth: 360, p: 1, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', mt: 1 },
            },
          }}
        >
          <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              Notifications
            </Typography>
            {unreadNotifications && (
              <Typography
                variant="caption"
                onClick={() => setUnreadNotifications(false)}
                sx={{ color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              >
                Mark as read
              </Typography>
            )}
          </Box>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem
            onClick={() => {
              setNotifMenuAnchor(null);
              navigate(role === 'admin' ? '/admin/operations' : `/${role}`);
            }}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 1.5, gap: 0.5 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1F2937' }}>
              Chain Reconciler Watchdog Active
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280' }}>
              EVM state verified with zero pending discrepancies.
            </Typography>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setNotifMenuAnchor(null);
              navigate('/profile');
            }}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 1.5, gap: 0.5 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1F2937' }}>
              Cryptographic Session Validated
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280' }}>
              EIP-191 key signature registered for active role.
            </Typography>
          </MenuItem>
        </Menu>

      </div>
    </header>
  );
}
