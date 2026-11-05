import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import useAuth from '../../hooks/useAuth';
import axios from '../../api/axios';
import { useScanner } from '../../context/ScannerContext';
import { BLOCK_EXPLORER_URL, CHAIN_ID, CHAIN_NAME, CHAIN_RPC_URL, NATIVE_CURRENCY_DECIMALS, NATIVE_CURRENCY_SYMBOL } from '../../config/contract';
import './shell.css';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';

export default function TopHeader({ onSearch, mobileNavOpen = false, menuButtonRef, onMenuClick }) {
  const { auth, logout } = useAuth();
  const { openScanner } = useScanner();
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState(auth?.walletAddress || '');
  const [walletBalance, setWalletBalance] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [accountMenuAnchor, setAccountMenuAnchor] = useState(null);
  const searchInputRef = useRef(null);
  const role = auth?.role || '';
  const userInitial = (auth?.username || auth?.name || 'U').charAt(0).toUpperCase();

  useEffect(() => {
    let active = true;
    if (!auth?.walletAddress && role === 'admin') {
      axios.get('/api/subaccounts/treasury-status')
        .then(({ data }) => {
          if (active) setWalletAddress(data?.address || '');
        })
        .catch(() => {
          if (active) setWalletAddress('');
        });
    } else {
      setWalletAddress(auth?.walletAddress || '');
    }
    return () => { active = false; };
  }, [auth?.walletAddress, role]);

  useEffect(() => {
    let active = true;
    if (!walletAddress) {
      setWalletBalance(null);
      return undefined;
    }
    const provider = new ethers.JsonRpcProvider(CHAIN_RPC_URL, CHAIN_ID, { staticNetwork: true });
    provider.getBalance(walletAddress)
      .then((balance) => {
        if (active) setWalletBalance(Number(ethers.formatUnits(balance, NATIVE_CURRENCY_DECIMALS)).toFixed(4));
      })
      .catch(() => {
        if (active) setWalletBalance(null);
      });
    return () => {
      active = false;
      provider.destroy();
    };
  }, [walletAddress]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    if (onSearch) onSearch(query);
    else navigate('/product', { state: { qrData: query } });
  };

  const copyWalletAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error('Unable to copy wallet address:', error);
    }
  };

  const formatAddress = (address) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Wallet unavailable';
  const signOut = () => {
    setAccountMenuAnchor(null);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="top-header">
      <button
        ref={menuButtonRef}
        type="button"
        className="header-icon-btn mobile-menu-btn"
        aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileNavOpen}
        aria-controls="primary-navigation"
        onClick={onMenuClick}
      >
        <MenuRoundedIcon />
      </button>

      <form onSubmit={handleSearchSubmit} className="header-search-box" role="search">
        <SearchRoundedIcon className="search-icon" aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="search"
          className="header-search-input"
          aria-label="Search product serial number or QR data"
          placeholder="Search product serial number"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <button type="button" className="header-search-shortcut" onClick={() => searchInputRef.current?.focus()}>
          Ctrl K
        </button>
      </form>

      <div className="header-actions">
        <button type="button" className="btn-scan-action" onClick={() => openScanner()}>
          <QrCodeScannerRoundedIcon sx={{ fontSize: 18, color: 'var(--color-primary)' }} />
          <span>Scan Code</span>
        </button>
        <button
          type="button"
          className="header-account-wallet"
          onClick={(event) => setAccountMenuAnchor(event.currentTarget)}
          title={`Signed in as ${auth?.username || 'user'} (${role || 'unknown role'})`}
          aria-haspopup="true"
          aria-expanded={Boolean(accountMenuAnchor)}
        >
          <span className="header-account-avatar" aria-hidden="true">{userInitial}</span>
          <span className="header-account-address">
            <span className="wallet-dot" />
            <span>{formatAddress(walletAddress)}</span>
          </span>
        </button>

        <Menu
          anchorEl={accountMenuAnchor}
          open={Boolean(accountMenuAnchor)}
          onClose={() => setAccountMenuAnchor(null)}
          slotProps={{ paper: { sx: { borderRadius: '16px', minWidth: 280, maxWidth: 360, p: 0.5, mt: 1 } } }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              {auth?.name || auth?.username}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280', textTransform: 'capitalize', display: 'block', mt: 0.25 }}>
              {role || 'Account'}
            </Typography>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          {walletAddress && (
            <MenuItem onClick={copyWalletAddress} sx={{ py: 1.25, alignItems: 'flex-start' }}>
              <ListItemIcon sx={{ color: copied ? '#16A34A' : '#4B5563', mt: 0.25 }}>
                {copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText
                primary={<span className="wallet-address-full">{walletAddress}</span>}
                secondary={copied ? 'Copied' : walletBalance === null ? CHAIN_NAME : `${walletBalance} ${NATIVE_CURRENCY_SYMBOL}`}
              />
            </MenuItem>
          )}
          {walletAddress && (
            <MenuItem
              component="a"
              href={`${BLOCK_EXPLORER_URL}/address/${walletAddress}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setAccountMenuAnchor(null)}
            >
              <ListItemIcon><OpenInNewRoundedIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary={`View on ${CHAIN_NAME} explorer`} />
            </MenuItem>
          )}
          {role === 'admin' && (
            <MenuItem onClick={() => { setAccountMenuAnchor(null); navigate('/subaccounts'); }}>
              <ListItemIcon><AccountBalanceWalletRoundedIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Facility wallets and treasury" />
            </MenuItem>
          )}
          <MenuItem onClick={() => { setAccountMenuAnchor(null); navigate('/profile'); }}>
            <ListItemIcon><PersonOutlineRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Profile and security" />
          </MenuItem>
          <MenuItem onClick={signOut} sx={{ color: '#DC2626' }}>
            <ListItemIcon sx={{ color: '#DC2626' }}><LogoutRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Sign out" />
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
}
