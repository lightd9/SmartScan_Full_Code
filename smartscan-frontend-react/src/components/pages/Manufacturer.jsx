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
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

export default function Manufacturer() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadManufacturerData() {
      try {
        const res = await axios.get('/product/chain-status');
        if (Array.isArray(res.data)) {
          setProducts(res.data);
        }
      } catch (err) {
        console.error('Failed to load manufacturer products:', err);
      } finally {
        setLoading(false);
      }
    }

    loadManufacturerData();
  }, []);

  // Format table rows matching reference "My Projects" table
  const tableRows = products.slice(0, 6).map((item) => {
    const isConfirmed = item.chain_status === 'confirmed';
    const isNeedsRetry = item.chain_status === 'needs_retry' || item.chain_status === 'failed';
    const statusColor = isConfirmed ? 'green' : isNeedsRetry ? 'amber' : 'purple';
    const statusLabel = isConfirmed
      ? 'Confirmed'
      : isNeedsRetry
      ? 'Needs Retry'
      : 'Submitted';

    return {
      id: item.serialnumber,
      icon: <QrCode2OutlinedIcon sx={{ fontSize: 18, color: 'var(--color-primary)' }} />,
      title: `${item.name || 'Product'} (${item.serialnumber.slice(0, 14)}...)`,
      commentCount: item.chain_attempt || 1,
      linkCount: 1,
      assigneeName: item.chain_actor || auth?.name || 'Factory Line A',
      assigneeAvatar: null,
      statusLabel,
      statusColor,
      onClick: () => navigate('/update-product', { state: { qrData: item.serialnumber } }),
    };
  });

  const confirmedCount = products.filter((p) => p.chain_status === 'confirmed').length;
  const retryCount = products.filter((p) => p.chain_status === 'needs_retry' || p.chain_status === 'failed').length;

  const manufacturerMetrics = [
    {
      icon: <Inventory2OutlinedIcon sx={{ fontSize: 17, color: 'var(--color-primary)' }} />,
      value: `${products.length || 0}`,
      label: 'Units Registered',
      onClick: () => navigate('/add-product'),
    },
    {
      icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 17, color: '#10B981' }} />,
      value: `${confirmedCount || 0}`,
      label: 'Chains Confirmed',
      onClick: () => navigate('/update-product'),
    },
    {
      icon: <HourglassEmptyRoundedIcon sx={{ fontSize: 17, color: retryCount > 0 ? '#DC2626' : '#8A92A6' }} />,
      value: `${retryCount || 0}`,
      label: 'Needs Review',
      onClick: () => navigate('/update-product'),
    },
  ];

  return (
    <DashboardShell>
      {/* Personalized Greeting & Metric Strip */}
      <GreetingBanner
        title={`Production Hub, ${auth?.name || auth?.username || 'Manufacturer'}`}
        metrics={manufacturerMetrics}
        actions={
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => navigate('/add-product')}
          >
            <AddRoundedIcon sx={{ fontSize: 18 }} />
            <span>+ Mint Product</span>
          </button>
        }
      />

      {/* Primary Data Card (Matching "My Projects" Layout) */}
      <PrimaryDataCard
        title="Manufactured Inventory & Blockchain Ledger"
        titleIcon={<Inventory2OutlinedIcon className="card-title-icon" />}
        filterLabel="Recent Batches"
        onSeeAllClick={() => navigate('/add-product')}
        columns={[
          { label: 'Product & Canonical ID', icon: <QrCode2OutlinedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Authorized Signer / Line', icon: <LocalShippingOutlinedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Ledger State', icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16 }} /> },
        ]}
        rows={tableRows}
        emptyMessage={loading ? 'Loading registered products...' : 'No products minted yet. Click "+ Mint Product" above to create your first authentic item.'}
      />

      {/* Bottom Dual Grid (Schedule / Timeline & Notes / Tasks) */}
      <div className="dashboard-grid-dual">
        <ScheduleTimelineCard
          title="Dispatch & Logistics Milestones"
          events={[
            {
              title: 'Batch Dispatched to Primary Distributor',
              time: '09:30 AM · Verified Signer',
              color: 'green',
              avatars: ['https://i.pravatar.cc/100?img=3', 'https://i.pravatar.cc/100?img=4'],
            },
            {
              title: 'Packaging Label High-Res QR Generation',
              time: '02:00 PM · Factory Gate 2',
              color: 'blue',
              avatars: ['https://i.pravatar.cc/100?img=11'],
            },
            {
              title: 'Scheduled Reconciler Sync Window',
              time: 'Continuous EVM Watchdog',
              color: 'orange',
              avatars: ['https://i.pravatar.cc/100?img=52'],
            },
          ]}
        />

        <NotesActionCard
          title="Manufacturing Quality Gates"
          items={[
            {
              id: 1,
              title: 'Cryptographic Seed & Canonical ID Check',
              description: 'Ensure each unit is assigned an immutable SS-UUID identifier prior to applying physical tamper seals.',
              completed: true,
            },
            {
              id: 2,
              title: 'Physical Packaging QR Print Test',
              description: 'Scan sample test prints on handheld cameras to ensure 100% optical readability and contract alignment.',
              completed: true,
            },
            {
              id: 3,
              title: 'Verify Inbound Carrier Wallet Address',
              description: 'Before releasing outbound crates, confirm recipient supplier address on IdenteefiV2 smart contract.',
              completed: false,
            },
          ]}
        />
      </div>
    </DashboardShell>
  );
}
