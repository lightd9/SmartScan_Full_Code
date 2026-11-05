import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import './shell.css';

import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';

export default function Sidebar({ isOpen = false, onClose = () => {}, navigationRef }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const role = auth?.role || '';
  const dashboardPath = role ? '/' + role : '/login';
  const items = [
    { to: dashboardPath, label: 'Dashboard', icon: <DashboardOutlinedIcon className="nav-icon" />, end: true },
  ];

  if (role === 'admin') {
    items.push(
      { to: '/manage-account', label: 'Accounts', icon: <ManageAccountsOutlinedIcon className="nav-icon" /> },
      { to: '/admin/operations', label: 'Operations', icon: <SecurityOutlinedIcon className="nav-icon" /> },
      { to: '/subaccounts', label: 'Facility wallets', icon: <AccountTreeOutlinedIcon className="nav-icon" /> },
      { to: '/add-account', label: 'New account', icon: <AddCircleOutlineOutlinedIcon className="nav-icon" /> },
      { to: '/pos', label: 'POS register', icon: <PointOfSaleOutlinedIcon className="nav-icon" /> },
    );
  } else if (role === 'manufacturer') {
    items.push({ to: '/add-product', label: 'Register product', icon: <AddCircleOutlineOutlinedIcon className="nav-icon" /> });
  } else if (role === 'retailer') {
    items.push({ to: '/pos', label: 'POS register', icon: <PointOfSaleOutlinedIcon className="nav-icon" /> });
  }

  const signOut = () => {
    onClose();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside ref={navigationRef} id="primary-navigation" className={'app-sidebar' + (isOpen ? ' is-open' : '')} aria-label="Main navigation">
      <div>
        <div className="sidebar-header">
          <NavLink to={dashboardPath} className="sidebar-logo" onClick={onClose}>SmartScan</NavLink>
        </div>
        <nav className="sidebar-nav-group">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) => 'sidebar-nav-item' + (isActive ? ' active' : '')}
            >
              {item.icon}<span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <nav className="sidebar-footer-links" aria-label="Settings and help">
          <NavLink
            to="/profile"
            onClick={onClose}
            className={({ isActive }) => 'sidebar-nav-item' + (isActive ? ' active' : '')}
          >
            <SettingsOutlinedIcon className="nav-icon" />
            <span>Settings</span>
          </NavLink>
          <a
            href="https://github.com/lightd9/SmartScan_Full_Code/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="sidebar-nav-item"
          >
            <HelpOutlineOutlinedIcon className="nav-icon" />
            <span>Support</span>
          </a>
          <a
            href="/user_manual.pdf"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="sidebar-nav-item"
          >
            <MenuBookOutlinedIcon className="nav-icon" />
            <span>Docs</span>
          </a>
        </nav>
        <button type="button" onClick={signOut} className="sidebar-nav-item sidebar-logout">
          <LogoutOutlinedIcon className="nav-icon" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
