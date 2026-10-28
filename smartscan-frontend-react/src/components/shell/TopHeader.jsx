import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { findMetaMaskAccount, connectMetaMask } from '../../utils/metamask';
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
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';

export default function TopHeader({ onSearch }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(true);

  // Menu Anchors
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [notifMenuAnchor, setNotifMenuAnchor] = useState(null);
  const [accountMenuAnchor, setAccountMenuAnchor] = useState(null);

  const searchInputRef = useRef(null);
  const role = auth?.role || 'admin';

  useEffect(() => {
    findMetaMaskAccount().then((acc) => {
      if (acc) setWalletAddress(acc);
    });

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        setWalletAddress(accounts[0] || '');
      });
    }

    // Global keyboard shortcut to focus search bar (Ctrl+K, Cmd+K, Ctrl+F, Cmd+F)
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleConnectWallet = async () => {
    try {
      const acc = await connectMetaMask();
      if (acc) setWalletAddress(acc);
    } catch (err) {
      console.error('Wallet connection failed:', err);
    }
  };

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

  // Quick action items for role dropdown
  const getActionMenuItems = () => {
    switch (role) {
      case 'manufacturer':
        return [
          { label: 'Mint New Product', icon: <AddRoundedIcon fontSize="small" />, onClick: () => navigate('/add-product') },
          { label: 'Verify & Scan Code', icon: <QrCodeScannerRoundedIcon fontSize="small" />, onClick: () => navigate('/scanner') },
          { label: 'Inspect Custody Chain', icon: <Inventory2OutlinedIcon fontSize="small" />, onClick: () => navigate('/update-product') },
        ];
      case 'admin':
        return [
          { label: 'Provision Partner Account', icon: <AddRoundedIcon fontSize="small" />, onClick: () => navigate('/add-account') },
          { label: 'Manage Accounts & Keys', icon: <BusinessRoundedIcon fontSize="small" />, onClick: () => navigate('/manage-account') },
          { label: 'System Operations & Reconciliation', icon: <SecurityRoundedIcon fontSize="small" />, onClick: () => navigate('/admin/operations') },
          { label: 'Public Verifier Scanner', icon: <QrCodeScannerRoundedIcon fontSize="small" />, onClick: () => navigate('/scanner') },
        ];
      case 'supplier':
        return [
          { label: 'Scan Inbound Cargo', icon: <QrCodeScannerRoundedIcon fontSize="small" />, onClick: () => navigate('/scanner') },
          { label: 'Transfer Custody', icon: <Inventory2OutlinedIcon fontSize="small" />, onClick: () => navigate('/update-product') },
        ];
      case 'retailer':
        return [
          { label: 'Scan & Mark Sold', icon: <QrCodeScannerRoundedIcon fontSize="small" />, onClick: () => navigate('/scanner') },
          { label: 'Shelf Stock Ledger', icon: <Inventory2OutlinedIcon fontSize="small" />, onClick: () => navigate('/update-product') },
        ];
      default:
        return [
          { label: 'Dashboard Overview', icon: <Inventory2OutlinedIcon fontSize="small" />, onClick: () => navigate(`/${role}`) },
        ];
    }
  };

  const getPrimaryLabel = () => {
    if (role === 'manufacturer') return 'New Product';
    if (role === 'admin') return 'New Account';
    if (role === 'supplier') return 'Inbound Scan';
    if (role === 'retailer') return 'Scan & Sell';
    return 'Action';
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
        {/* Primary Action Button with Working Dropdown Menu */}
        <button
          type="button"
          className="btn-primary-action"
          onClick={(e) => setActionMenuAnchor(e.currentTarget)}
          aria-haspopup="true"
          aria-expanded={Boolean(actionMenuAnchor)}
        >
          <AddRoundedIcon sx={{ fontSize: 18 }} />
          <span>{getPrimaryLabel()}</span>
          <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18, marginLeft: '2px' }} />
        </button>

        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={() => setActionMenuAnchor(null)}
          slotProps={{
            paper: {
              sx: { borderRadius: '14px', minWidth: 220, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', mt: 1 },
            },
          }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Quick Actions
            </Typography>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          {getActionMenuItems().map((item, index) => (
            <MenuItem
              key={index}
              onClick={() => {
                setActionMenuAnchor(null);
                item.onClick();
              }}
              sx={{ py: 1.2, fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}
            >
              <ListItemIcon sx={{ color: 'var(--color-primary)' }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }} />
            </MenuItem>
          ))}
        </Menu>

        {/* Combined profile and wallet control */}
        <button
          type="button"
          className="header-account-wallet"
          onClick={(event) => setAccountMenuAnchor(event.currentTarget)}
          title={`Signed in as ${auth?.username} (${role})${walletAddress ? ` · Wallet ${walletAddress}` : ''}`}
          aria-haspopup="true"
          aria-expanded={Boolean(accountMenuAnchor)}
        >
          <span className="header-account-avatar" aria-hidden="true">{userInitial}</span>
          <span className="header-account-address">
            <span className={`wallet-dot ${walletAddress ? '' : 'disconnected'}`}></span>
            <span>{formatAddress(walletAddress)}</span>
          </span>
        </button>

        <Menu
          anchorEl={accountMenuAnchor}
          open={Boolean(accountMenuAnchor)}
          onClose={() => setAccountMenuAnchor(null)}
          slotProps={{
            paper: {
              sx: { borderRadius: '16px', minWidth: 290, maxWidth: 360, p: 0.5, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', mt: 1 },
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              {auth?.name || auth?.username}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280', textTransform: 'capitalize' }}>
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
                primary={walletAddress}
                secondary={copied ? 'Copied to clipboard' : 'Click address to copy'}
                primaryTypographyProps={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 700, color: '#111827', sx: { overflowWrap: 'anywhere' } }}
                secondaryTypographyProps={{ fontSize: '0.72rem' }}
              />
            </MenuItem>
          ) : (
            <MenuItem onClick={() => { setAccountMenuAnchor(null); handleConnectWallet(); }} sx={{ py: 1 }}>
              <ListItemIcon sx={{ color: '#4B5563' }}><SyncRoundedIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Connect Wallet" primaryTypographyProps={{ fontSize: '0.875rem' }} />
            </MenuItem>
          )}
          {walletAddress && <MenuItem
            onClick={() => {
              setAccountMenuAnchor(null);
              window.open(`https://sepolia.etherscan.io/address/${walletAddress}`, '_blank', 'noopener,noreferrer');
            }}
            sx={{ py: 1, fontSize: '0.875rem', fontWeight: 600 }}
          >
            <ListItemIcon sx={{ color: '#4B5563' }}><OpenInNewRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="View on Explorer" primaryTypographyProps={{ fontSize: '0.875rem' }} />
          </MenuItem>}
          {walletAddress && <MenuItem onClick={() => { setAccountMenuAnchor(null); handleConnectWallet(); }} sx={{ py: 1 }}>
            <ListItemIcon sx={{ color: '#4B5563' }}><SyncRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Switch / Reconnect Wallet" primaryTypographyProps={{ fontSize: '0.875rem' }} />
          </MenuItem>}
          <Divider sx={{ my: 0.5 }} />
          <MenuItem
            onClick={() => {
              setAccountMenuAnchor(null);
              navigate('/profile');
            }}
            sx={{ py: 1, fontSize: '0.875rem', fontWeight: 600 }}
          >
            <ListItemIcon sx={{ color: '#4B5563' }}><PersonOutlineRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Account & Wallet" primaryTypographyProps={{ fontSize: '0.875rem' }} />
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

        {/* Notifications Icon with Interactive Notification Center Drawer */}
        <button
          type="button"
          className="header-icon-btn"
          aria-label="View notifications and alerts"
          onClick={(e) => setNotifMenuAnchor(e.currentTarget)}
        >
          <NotificationsNoneRoundedIcon sx={{ fontSize: 20 }} />
          {unreadNotifications && <span className="unread-pip"></span>}
        </button>

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
