import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import PrimaryDataCard from '../shell/PrimaryDataCard';
import ScheduleTimelineCard from '../shell/ScheduleTimelineCard';
import NotesActionCard from '../shell/NotesActionCard';

// Material Icons
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
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
        }
        if (alertsRes.status === 'fulfilled' && Array.isArray(alertsRes.value.data)) {
          setAlertsCount(alertsRes.value.data.length);
        }
        if (productsRes.status === 'fulfilled' && Array.isArray(productsRes.value.data)) {
          setProductsCount(productsRes.value.data.length);
        }
      } catch (err) {
        console.error('Failed to load admin dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, []);

  // Format table rows matching reference "My Projects" table
  const tableRows = accounts.slice(0, 6).map((acc) => {
    return {
      id: acc.id || acc.username,
      icon: <BusinessRoundedIcon sx={{ fontSize: 18, color: 'var(--color-primary)' }} />,
      title: acc.name || acc.username,
      commentCount: acc.account_role,
      assigneeName: acc.username,
      assigneeAvatar: null,
      statusLabel: acc.wallet_status === 'linked' ? 'Wallet Linked' : 'Pending Wallet',
      statusColor: acc.wallet_status === 'linked' ? 'green' : 'amber',
      onClick: () => navigate('/manage-account'),
    };
  });

  const adminMetrics = [
    {
      icon: <GroupOutlinedIcon sx={{ fontSize: 17, color: 'var(--color-primary)' }} />,
      value: `${accounts.length || 12}`,
      label: 'Verified Partners',
      onClick: () => navigate('/manage-account'),
    },
    {
      icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 17, color: '#10B981' }} />,
      value: `${productsCount || 148}`,
      label: 'Chains Reconciled',
      onClick: () => navigate('/admin/operations'),
    },
    {
      icon: <SecurityRoundedIcon sx={{ fontSize: 17, color: '#F59E0B' }} />,
      value: `${alertsCount || 0}`,
      label: 'Threat Alerts',
      onClick: () => navigate('/admin/operations'),
    },
  ];

  return (
    <DashboardShell>
      {/* Personalized Greeting & Metric Strip */}
      <GreetingBanner
        title={`Governance Hub, ${auth?.name || 'Administrator'}`}
        metrics={adminMetrics}
      />

      {/* Primary Data Card (Matching "My Projects" Layout) */}
      <PrimaryDataCard
        title="Verified Business Accounts & Wallets"
        titleIcon={<BusinessRoundedIcon className="card-title-icon" />}
        filterLabel="All Partners"
        onSeeAllClick={() => navigate('/manage-account')}
        columns={[
          { label: 'Organization / Company', icon: <BusinessRoundedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Authorized Signer', icon: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Custody State', icon: <SecurityRoundedIcon sx={{ fontSize: 16 }} /> },
        ]}
        rows={tableRows}
        emptyMessage={loading ? 'Loading business directory...' : 'No accounts provisioned yet.'}
      />

      {/* Bottom Dual Grid (Schedule / Timeline & Notes / Tasks) */}
      <div className="dashboard-grid-dual">
        <ScheduleTimelineCard
          title="Platform Security & Milestones"
          events={[
            {
              title: 'Smart Contract Reconciler Cycle',
              time: 'Running Every 60s',
              color: 'green',
              avatars: ['https://i.pravatar.cc/100?img=12', 'https://i.pravatar.cc/100?img=33'],
            },
            {
              title: 'Scan Anomaly Geofence Audit',
              time: 'Telemetry Engine Active',
              color: 'blue',
              avatars: ['https://i.pravatar.cc/100?img=60'],
            },
            {
              title: 'Scheduled Key Rotation & Token Audit',
              time: 'Automated Revocation Guard',
              color: 'orange',
              avatars: ['https://i.pravatar.cc/100?img=47'],
            },
          ]}
        />

        <NotesActionCard
          title="Governance Checklist"
          items={[
            {
              id: 1,
              title: 'EIP-191 Wallet Cryptographic Verification',
              description: 'All manufacturers must verify key ownership before registering physical inventory.',
              completed: true,
            },
            {
              id: 2,
              title: 'Review Non-Canonical Serial Records',
              description: 'Examine legacy products and trigger serial rekeys to the SS-UUID format.',
              completed: false,
            },
            {
              id: 3,
              title: 'Monitor Public Verification Telemetry',
              description: 'Audit consumer scan events for unusual scan frequency and counterfeit warnings.',
              completed: false,
            },
          ]}
        />
      </div>
    </DashboardShell>
  );
}
