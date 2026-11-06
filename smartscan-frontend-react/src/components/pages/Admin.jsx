import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import PrimaryDataCard from '../shell/PrimaryDataCard';

// Material Icons
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';

export default function Admin() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [alertsCount, setAlertsCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [profilesRes, alertsRes, productsRes] = await Promise.allSettled([
          axios.get('/profileAll'),
          axios.get('/admin/scan-alerts'),
          axios.get('/product/chain-status'),
        ]);

        if (profilesRes.status === 'fulfilled' && Array.isArray(profilesRes.value.data)) {
          setAccounts(profilesRes.value.data);
        } else {
          setLoadError(true);
        }
        if (alertsRes.status === 'fulfilled' && Array.isArray(alertsRes.value.data)) {
          setAlertsCount(alertsRes.value.data.length);
        } else {
          setLoadError(true);
        }
        if (productsRes.status === 'fulfilled' && Array.isArray(productsRes.value.data)) {
          setProductsCount(productsRes.value.data.filter((product) => product.chain_status === 'confirmed').length);
        } else {
          setLoadError(true);
        }
      } catch (err) {
        console.error('Failed to load admin dashboard metrics:', err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, []);

  // Display the real account and wallet state returned by the admin directory.
  const tableRows = accounts.slice(0, 6).map((acc) => {
    const walletStatuses = {
      active: ['Wallet active', 'green'],
      pending_onchain: ['On-chain approval pending', 'amber'],
      suspended: ['Wallet suspended', 'red'],
      revoked: ['Wallet revoked', 'gray'],
      unlinked: ['No wallet linked', 'gray'],
    };
    const [statusLabel, statusColor] = walletStatuses[acc.wallet_status] || ['Wallet status unavailable', 'gray'];
    return {
      id: acc.id || acc.username,
      icon: <BusinessRoundedIcon sx={{ fontSize: 18, color: 'var(--color-primary)' }} />,
      title: acc.name || acc.username,
      assigneeName: acc.username,
      assigneeAvatar: null,
      statusLabel,
      statusColor,
      onClick: () => navigate('/manage-account'),
    };
  });

  const adminMetrics = [
    {
      icon: <GroupOutlinedIcon sx={{ fontSize: 17, color: 'var(--color-primary)' }} />,
      value: loading ? '—' : `${accounts.length}`,
      label: 'Business Accounts',
      onClick: () => navigate('/manage-account'),
    },
    {
      icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 17, color: '#10B981' }} />,
      value: loading ? '—' : `${productsCount}`,
      label: 'Confirmed Products',
      onClick: () => navigate('/admin/operations'),
    },
    {
      icon: <SecurityRoundedIcon sx={{ fontSize: 17, color: '#F59E0B' }} />,
      value: loading ? '—' : `${alertsCount}`,
      label: 'Recent Scan Alerts',
      onClick: () => navigate('/admin/operations'),
    },
  ];

  return (
    <DashboardShell>
      {/* Personalized Greeting & Metric Strip */}
      <GreetingBanner
        title="Governance & Oversight"
        subtitle={`Welcome back, ${auth?.name || 'Administrator'} · System Overview`}
        metrics={adminMetrics}
      />

      {loadError && (
        <p className="dashboard-error" role="alert">
          Some dashboard data could not be loaded. Open Operations or Accounts to retry the affected view.
        </p>
      )}

      {/* Latest business accounts and their wallet states */}
      <PrimaryDataCard
        title="Registered Organizations"
        titleIcon={<BusinessRoundedIcon className="card-title-icon" />}
        onSeeAllClick={() => navigate('/manage-account')}
        columns={[
          { label: 'Organization', icon: <BusinessRoundedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Username', icon: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Wallet Status', icon: <SecurityRoundedIcon sx={{ fontSize: 16 }} /> },
        ]}
        rows={tableRows}
        emptyMessage={loading ? 'Loading business directory...' : loadError ? 'Account data is temporarily unavailable.' : 'No business accounts yet.'}
      />
    </DashboardShell>
  );
}
