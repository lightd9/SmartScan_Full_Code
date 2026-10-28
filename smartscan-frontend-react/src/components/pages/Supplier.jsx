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
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';

export default function Supplier() {
  const { auth } = useAuth();
  const { openScanner } = useScanner();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSupplierData() {
      try {
        const res = await axios.get('/product/chain-status');
        if (Array.isArray(res.data)) {
          setProducts(res.data);
        }
      } catch (err) {
        console.error('Failed to load supplier products:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSupplierData();
  }, []);

  const tableRows = products.slice(0, 6).map((item) => ({
    id: item.serialnumber,
    icon: <QrCode2OutlinedIcon sx={{ fontSize: 18, color: 'var(--color-primary)' }} />,
    title: `${item.name || 'Shipment Batch'} (${item.serialnumber.slice(0, 14)}...)`,
    commentCount: 2,
    linkCount: 1,
    assigneeName: item.chain_actor || 'Logistics Fleet 4',
    assigneeAvatar: null,
    statusLabel: item.chain_status === 'confirmed' ? 'In Custody' : 'In Transit',
    statusColor: item.chain_status === 'confirmed' ? 'green' : 'purple',
    onClick: () => navigate('/update-product', { state: { qrData: item.serialnumber } }),
  }));

  const supplierMetrics = [
    {
      icon: <WarehouseOutlinedIcon sx={{ fontSize: 17, color: 'var(--color-primary)' }} />,
      value: `${products.length || 8}`,
      label: 'Warehoused Cargo',
      onClick: () => navigate('/update-product'),
    },
    {
      icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 17, color: '#10B981' }} />,
      value: `${products.length ? products.length - 1 : 7}`,
      label: 'Deliveries Confirmed',
      onClick: () => navigate('/update-product'),
    },
    {
      icon: <LocalShippingOutlinedIcon sx={{ fontSize: 17, color: '#9333EA' }} />,
      value: '2',
      label: 'Active Dispatches',
      onClick: () => openScanner(),
    },
  ];

  return (
    <DashboardShell>
      {/* Personalized Greeting & Metric Strip */}
      <GreetingBanner
        title={`Logistics Terminal, ${auth?.name || auth?.username || 'Supplier'}`}
        metrics={supplierMetrics}
        actions={
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => openScanner()}
          >
            <QrCodeScannerOutlinedIcon sx={{ fontSize: 18 }} />
            <span>+ Inbound Scan</span>
          </button>
        }
      />

      {/* Primary Data Card (Matching "My Projects" Layout) */}
      <PrimaryDataCard
        title="Active Supply Chain Consignments"
        titleIcon={<LocalShippingOutlinedIcon className="card-title-icon" />}
        filterLabel="In Transit"
        onSeeAllClick={() => openScanner()}
        columns={[
          { label: 'Consignment / Serial', icon: <QrCode2OutlinedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Carrier / Warehouse Dock', icon: <WarehouseOutlinedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Custody Status', icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16 }} /> },
        ]}
        rows={tableRows}
        emptyMessage={loading ? 'Loading cargo records...' : 'No active shipments found.'}
      />

      {/* Bottom Dual Grid */}
      <div className="dashboard-grid-dual">
        <ScheduleTimelineCard
          title="Distribution & Transit Milestones"
          events={[
            {
              title: 'Cross-Dock Transfer · Bay 14',
              time: '11:00 AM · Courier Team A',
              color: 'green',
              avatars: ['https://i.pravatar.cc/100?img=15', 'https://i.pravatar.cc/100?img=16'],
            },
            {
              title: 'Retail Dispatch Staging',
              time: '03:30 PM · Outbound Terminal',
              color: 'blue',
              avatars: ['https://i.pravatar.cc/100?img=22'],
            },
          ]}
        />

        <NotesActionCard
          title="Warehouse Receiving Checklist"
          items={[
            {
              id: 1,
              title: 'Barcode & QR Scanner Calibration',
              description: 'Verify optical camera resolution for high-speed pallet processing.',
              completed: true,
            },
            {
              id: 2,
              title: 'Blockchain Custody Sign-Off',
              description: 'Always confirm delivery on-chain immediately upon physical offloading.',
              completed: false,
            },
            {
              id: 3,
              title: 'Retail Destination Pre-Check',
              description: 'Ensure recipient store wallet address is verified in the smart contract registry.',
              completed: false,
            },
          ]}
        />
      </div>
    </DashboardShell>
  );
}
