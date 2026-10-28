import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { useScanner } from '../../context/ScannerContext';
import './shell.css';

// Material Icons
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';

export default function Sidebar() {
  const { auth, logout } = useAuth();
  const { openScanner } = useScanner();
  const navigate = useNavigate();
  const role = auth?.role || 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Build role-specific navigation items
  const getNavItems = () => {
    const baseItems = [
      {
        to: `/${role}`,
        label: 'Dashboard',
        icon: <DashboardOutlinedIcon className="nav-icon" />,
      },
    ];

    if (role === 'admin') {
      baseItems.push(
        {
          to: '/manage-account',
          label: 'Accounts',
          icon: <ManageAccountsOutlinedIcon className="nav-icon" />,
        },
        {
          to: '/admin/operations',
          label: 'Operations',
          icon: <SecurityOutlinedIcon className="nav-icon" />,
        },
        {
          to: '/add-account',
          label: 'New Account',
          icon: <AddCircleOutlineOutlinedIcon className="nav-icon" />,
        },
        {
          onClick: () => openScanner(),
          label: 'Verify Scanner',
          icon: <QrCodeScannerOutlinedIcon className="nav-icon" />,
        }
      );
    } else if (role === 'manufacturer') {
      baseItems.push(
        {
          to: '/add-product',
          label: 'Mint Product',
          icon: <AddCircleOutlineOutlinedIcon className="nav-icon" />,
        },
        {
          onClick: () => openScanner(),
          label: 'Verify & Scan',
          icon: <QrCodeScannerOutlinedIcon className="nav-icon" />,
        },
        {
          to: '/update-product',
          label: 'Custody Chain',
          icon: <Inventory2OutlinedIcon className="nav-icon" />,
        }
      );
    } else if (role === 'supplier') {
      baseItems.push(
        {
          onClick: () => openScanner(),
          label: 'Inbound Scan',
          icon: <QrCodeScannerOutlinedIcon className="nav-icon" />,
        },
        {
          to: '/update-product',
          label: 'Custody Hub',
          icon: <Inventory2OutlinedIcon className="nav-icon" />,
        }
      );
    } else if (role === 'retailer') {
      baseItems.push(
        {
          onClick: () => openScanner(),
          label: 'POS Scanner',
          icon: <QrCodeScannerOutlinedIcon className="nav-icon" />,
        },
        {
          to: '/update-product',
          label: 'Shelf Inventory',
          icon: <Inventory2OutlinedIcon className="nav-icon" />,
        }
      );
    }

    baseItems.push({
      to: '/profile',
      label: 'Corporate Wallet',
      icon: <AccountBalanceWalletOutlinedIcon className="nav-icon" />,
    });

    return baseItems;
  };

  // Sub-group items based on role
  const getSubCollections = () => {
    if (role === 'admin') {
      return [
        { label: 'Scan Telemetry', color: 'pink', to: '/admin/operations' },
        { label: 'Chain Reconciler', color: 'green', to: '/admin/operations' },
        { label: 'Wallet Registry', color: 'blue', to: '/manage-account' },
      ];
    }
    if (role === 'manufacturer') {
      return [
        { label: 'Batch Staging', color: 'pink', to: '/add-product' },
        { label: 'Confirmed Chains', color: 'green', to: `/${role}` },
        { label: 'Recoverable Queue', color: 'purple', to: '/add-product' },
      ];
    }
    if (role === 'supplier') {
      return [
        { label: 'Inbound Docks', color: 'pink', onClick: () => openScanner() },
        { label: 'Warehouse Holding', color: 'green', to: `/${role}` },
        { label: 'Outbound Retail', color: 'blue', to: '/update-product' },
      ];
    }
    return [
      { label: 'Store Inventory', color: 'pink', to: `/${role}` },
      { label: 'Sold Registrations', color: 'green', to: `/${role}` },
      { label: 'Receiving Crates', color: 'purple', onClick: () => openScanner() },
    ];
  };

  const navItems = getNavItems();
  const subCollections = getSubCollections();

  return (
    <aside className="app-sidebar" aria-label="Main Navigation">
      <div>
        {/* Brand Logo in refined serif typography */}
        <div className="sidebar-header">
          <NavLink to={`/${role}`} className="sidebar-logo">
            SmartScan
          </NavLink>
        </div>

        {/* Primary Navigation Group with Active Electric Blue Pill */}
        <nav className="sidebar-nav-group">
          {navItems.map((item, index) => {
            if (item.onClick) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={item.onClick}
                  className="sidebar-nav-item"
                  style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === `/${role}`}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sub-groups (Projects / Channels with Colored Dots) */}
        <div className="sidebar-section-title">
          <span>Channels</span>
          <button
            type="button"
            className="sidebar-add-btn"
            title="Quick Action"
            onClick={() => role === 'manufacturer' ? navigate('/add-product') : role === 'admin' ? navigate('/add-account') : openScanner()}
          >
            <AddOutlinedIcon sx={{ fontSize: 16 }} />
          </button>
        </div>

        <div className="sidebar-nav-group">
          {subCollections.map((sub, index) => {
            if (sub.onClick) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={sub.onClick}
                  className="sidebar-sub-item"
                  style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
                >
                  <span className={`color-dot ${sub.color}`}></span>
                  <span>{sub.label}</span>
                </button>
              );
            }
            return (
              <NavLink key={index} to={sub.to} className="sidebar-sub-item">
                <span className={`color-dot ${sub.color}`}></span>
                <span>{sub.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Pinned Bottom Utilities */}
      <div className="sidebar-footer">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `sidebar-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <SettingsOutlinedIcon className="nav-icon" />
          <span>Settings</span>
        </NavLink>

        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="sidebar-nav-item"
        >
          <HelpOutlineOutlinedIcon className="nav-icon" />
          <span>Support & Docs</span>
          <span className="badge-counter">Live</span>
        </a>

        <button
          type="button"
          onClick={handleLogout}
          className="sidebar-nav-item"
          style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
        >
          <LogoutOutlinedIcon className="nav-icon" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
