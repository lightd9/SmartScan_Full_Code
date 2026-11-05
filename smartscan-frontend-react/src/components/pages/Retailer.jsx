import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import { useScanner } from '../../context/ScannerContext';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import PrimaryDataCard from '../shell/PrimaryDataCard';
import ScheduleTimelineCard from '../shell/ScheduleTimelineCard';
import NotesActionCard from '../shell/NotesActionCard';

// Material Icons
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';

export default function Retailer() {
  const { auth } = useAuth();
  const { openScanner } = useScanner();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRetailerData() {
      try {
        const res = await axios.get('/product/chain-status');
        if (Array.isArray(res.data)) {
          setProducts(res.data);
        }
      } catch (err) {
        console.error('Failed to load retailer products:', err);
      } finally {
        setLoading(false);
      }
    }

    loadRetailerData();
  }, []);

  const tableRows = products.slice(0, 6).map((item) => ({
    id: item.serialnumber,
    icon: <QrCode2OutlinedIcon sx={{ fontSize: 18, color: 'var(--color-primary)' }} />,
    title: `${item.name || 'Store Item'} (${item.serialnumber.slice(0, 14)}...)`,
    commentCount: 1,
    linkCount: 2,
    assigneeName: auth?.name || 'Retail Register 1',
    assigneeAvatar: null,
    statusLabel: item.chain_status === 'confirmed' ? 'On Display' : 'In Transit',
    statusColor: item.chain_status === 'confirmed' ? 'green' : 'blue',
    onClick: () => navigate('/update-product', { state: { qrData: item.serialnumber } }),
  }));

  const retailerMetrics = [
    {
      icon: <StorefrontOutlinedIcon sx={{ fontSize: 17, color: 'var(--color-primary)' }} />,
      value: `${products.length || 0}`,
      label: 'Units on Shelf',
    },
    {
      icon: <PointOfSaleOutlinedIcon sx={{ fontSize: 17, color: '#10B981' }} />,
      value: `${products.filter(p => p.chain_status === 'confirmed').length || 0}`,
      label: 'Verified Inventory',
      onClick: () => navigate('/pos'),
    },
    {
      icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 17, color: '#2563EB' }} />,
      value: '100%',
      label: 'Genuine Authenticated',
    },
  ];

  return (
    <DashboardShell>
      {/* Personalized Greeting & Metric Strip */}
      <GreetingBanner
        title={`Storefront Operations, ${auth?.name || auth?.username || 'Retailer'}`}
        metrics={retailerMetrics}
        actions={
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => openScanner()}
            title="Auto-detects Store Receiving or Retail Point-of-Sale based on blockchain state"
          >
            <QrCodeScannerOutlinedIcon sx={{ fontSize: 18 }} />
            <span>+ Smart Scan</span>
          </button>
        }
      />

      {/* Primary Data Card (Matching "My Projects" Layout) */}
      <PrimaryDataCard
        title="Store Inventory & Authentication Terminal"
        titleIcon={<StorefrontOutlinedIcon className="card-title-icon" />}
        filterLabel="Available Stock"
        columns={[
          { label: 'Item / Product Identifier', icon: <QrCode2OutlinedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Floor Associate / Register', icon: <PointOfSaleOutlinedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Display State', icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16 }} /> },
        ]}
        rows={tableRows}
        emptyMessage={loading ? 'Loading inventory...' : 'No products in store inventory.'}
      />

      {/* Bottom Dual Grid */}
      <div className="dashboard-grid-dual">
        <ScheduleTimelineCard
          title="Daily Register & Sales Velocity"
          events={[
            {
              title: 'Customer Verification Scan · Lane 3',
              time: '10:15 AM · Genuine Verified',
              color: 'green',
              avatars: ['POS'],
            },
            {
              title: 'Terminal Sale Finalized on Ledger',
              time: '12:45 PM · Marked Sold',
              color: 'blue',
              avatars: ['RET'],
            },
          ]}
        />

        <NotesActionCard
          title="Point-of-Sale Procedures"
          items={[
            {
              id: 1,
              title: 'Scan QR at Customer Checkout',
              description: 'Always confirm the product shows verified genuine green badge on consumer screen.',
              completed: true,
            },
            {
              id: 2,
              title: 'Execute "Mark Sold" Transaction',
              description: 'Executing Mark Sold permanently closes the product life cycle, stopping counterfeit reuse.',
              completed: false,
            },
            {
              id: 3,
              title: 'Store Receiving Quarantine',
              description: 'Isolate any shipments with torn tamper seals or unrecognized contract warnings.',
              completed: true,
            },
          ]}
        />
      </div>
    </DashboardShell>
  );
}
