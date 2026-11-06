import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import { useScanner } from '../../context/ScannerContext';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import DashboardWorkflowCard from '../shell/DashboardWorkflowCard';
import PrimaryDataCard from '../shell/PrimaryDataCard';

// Material Icons
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';

export default function Supplier() {
  const { auth } = useAuth();
  const { openScanner } = useScanner();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    axios.get('/product/chain-status')
      .then((res) => {
        if (active && Array.isArray(res.data)) {
          setProducts(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load supplier custody records:', err);
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const confirmedCount = products.filter((p) => p.chain_status === 'confirmed').length;
  const transitCount = products.filter((p) => p.chain_status !== 'confirmed').length;

  const supplierMetrics = [
    {
      icon: <Inventory2OutlinedIcon sx={{ fontSize: 17, color: 'var(--color-primary)' }} />,
      value: loading ? '—' : String(products.length),
      label: 'Cargo Manifest',
    },
    {
      icon: <CheckCircleRoundedIcon sx={{ fontSize: 17, color: '#16A34A' }} />,
      value: loading ? '—' : String(confirmedCount),
      label: 'Chain Verified',
    },
    {
      icon: <SecurityRoundedIcon sx={{ fontSize: 17, color: '#9333EA' }} />,
      value: 'Active',
      label: 'Gasless Custody Relay',
    },
  ];

  const tableRows = products.map((item) => {
    const isConfirmed = item.chain_status === 'confirmed';
    const isNeedsRetry = item.chain_status === 'needs_retry';
    const isFailed = item.chain_status === 'failed';
    const isDraft = item.chain_status === 'pending_wallet';
    const statusColor = isConfirmed ? 'green' : isFailed ? 'red' : isNeedsRetry || isDraft ? 'amber' : 'purple';
    const statusLabel = isConfirmed
      ? 'Confirmed'
      : isFailed
        ? 'Flagged'
        : isNeedsRetry
          ? 'Needs Review'
          : isDraft
            ? 'Draft'
            : 'In Transit';

    return {
      id: item.serialnumber,
      icon: <QrCode2OutlinedIcon sx={{ fontSize: 18, color: 'var(--color-primary)' }} />,
      title: `${item.name || 'Cargo Item'} (${String(item.serialnumber || '').slice(0, 14)}…)`,
      assigneeName: item.chain_actor || item.chain_location || 'Logistics Depot',
      statusLabel,
      statusColor,
      onClick: () => navigate(`/product-details/${encodeURIComponent(item.serialnumber)}`),
    };
  });

  const handleScrollToManifest = () => {
    const element = document.getElementById('custody-manifest');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <DashboardShell>
      {/* Personalized Greeting & Operational Metrics */}
      <GreetingBanner
        title="Supplier Operations"
        subtitle={`Welcome back, ${auth?.name || auth?.username || 'Partner'} · Logistics & Distribution Hub`}
        metrics={supplierMetrics}
        actions={
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => openScanner()}
            aria-label="Scan QR code for delivery or dispatch"
          >
            <QrCodeScannerOutlinedIcon sx={{ fontSize: 18 }} />
            <span>Scan Shipment QR</span>
          </button>
        }
      />

      {/* Primary Workflow Cards with Distinct Actions */}
      <section className="workflow-card-grid" aria-label="Supplier workflows">
        <DashboardWorkflowCard
          icon={<WarehouseOutlinedIcon />}
          title="Receive Inbound Delivery"
          description="Scan physical packaging QR codes upon cargo arrival to verify cryptographic origin, validate batch proof, and accept custody on-chain."
          actionLabel="Scan Inbound QR"
          onAction={() => openScanner()}
        />
        <DashboardWorkflowCard
          icon={<LocalShippingOutlinedIcon />}
          title="Dispatch Outbound Shipment"
          description="Select verified inventory from your warehouse custody manifest below to dispatch freight to authorized downstream retail partners."
          actionLabel="Select from Manifest"
          onAction={handleScrollToManifest}
        />
        <DashboardWorkflowCard
          icon={<VerifiedUserOutlinedIcon />}
          title="Field Provenance Audit"
          description="Inspect digital passport, sensor logs, and cryptographic authenticity trail before clearing consignments for distribution."
          actionLabel="Open Scanner Audit"
          onAction={() => navigate('/scanner')}
        />
      </section>

      {loadError && (
        <p className="dashboard-error" role="alert">
          Custody records could not be refreshed. Check network connectivity or retry.
        </p>
      )}

      {/* Primary Custody & Inventory Manifest Data Table */}
      <div id="custody-manifest" style={{ marginTop: '24px', scrollMarginTop: '80px' }}>
        <PrimaryDataCard
          title="Inbound Cargo & Inventory Manifest"
          titleIcon={<LocalShippingOutlinedIcon className="card-title-icon" />}
          filterLabel="All Items"
          filterOptions={['All Items', 'Confirmed', 'In Transit', 'Needs Review']}
          columns={[
            { label: 'Product & Serial', icon: <QrCode2OutlinedIcon sx={{ fontSize: 16 }} /> },
            { label: 'Depot / Facility Location', icon: <WarehouseOutlinedIcon sx={{ fontSize: 16 }} /> },
            { label: 'Chain Status', icon: <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> },
          ]}
          rows={tableRows}
          emptyMessage={
            loading
              ? 'Loading cargo records…'
              : loadError
                ? 'Manifest data is temporarily unavailable.'
                : 'No consignments currently in custody manifest. Scan inbound QR to accept custody.'
          }
        />
      </div>

      {/* Protocol Checklist & Custody Guidelines */}
      <div className="dashboard-grid-split" style={{ marginTop: '24px' }}>
        <article className="dashboard-card" aria-labelledby="custody-protocol-title">
          <header className="card-header-clean">
            <div className="card-title-group">
              <AssignmentOutlinedIcon className="card-title-icon" sx={{ color: 'var(--color-primary)' }} />
              <h2 id="custody-protocol-title" className="card-title-text">
                Custody Protocol Guidelines
              </h2>
            </div>
            <span className="status-pill green">Enforced</span>
          </header>
          <div className="card-content-body">
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: '2px',
                }}>1</span>
                <div>
                  <strong style={{ fontSize: '13px', color: 'var(--color-text-main)', display: 'block', marginBottom: '2px' }}>
                    Tamper-Evident Inspection
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Physically examine outer packaging and QR labels before scanning. If physical seal is broken, reject custody.
                  </p>
                </div>
              </li>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: '2px',
                }}>2</span>
                <div>
                  <strong style={{ fontSize: '13px', color: 'var(--color-text-main)', display: 'block', marginBottom: '2px' }}>
                    Zero Gas Headless Execution
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Custody handovers are signed securely by your authenticated warehouse account without personal Sepolia gas fees.
                  </p>
                </div>
              </li>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: '2px',
                }}>3</span>
                <div>
                  <strong style={{ fontSize: '13px', color: 'var(--color-text-main)', display: 'block', marginBottom: '2px' }}>
                    Downstream Recipient Lock
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    When dispatching items to a retailer, the item state enters Transit until confirmed by the designated partner wallet.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </article>

        <article className="dashboard-card" aria-labelledby="quick-tips-title">
          <header className="card-header-clean">
            <div className="card-title-group">
              <HelpOutlineRoundedIcon className="card-title-icon" sx={{ color: 'var(--color-primary)' }} />
              <h2 id="quick-tips-title" className="card-title-text">
                Quick Actions & Resources
              </h2>
            </div>
          </header>
          <div className="card-content-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
            }}>
              <strong style={{ fontSize: '13px', color: 'var(--color-text-main)', display: 'block', marginBottom: '4px' }}>
                Camera scanner permissions
              </strong>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Ensure your browser or mobile device allows camera access. You can also paste serial codes or QR payload text directly in the scanner.
              </p>
            </div>
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
            }}>
              <strong style={{ fontSize: '13px', color: 'var(--color-text-main)', display: 'block', marginBottom: '4px' }}>
                Subaccount keys
              </strong>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Warehouse shifts can use dedicated subaccount operators configured in your organization profile for shift auditing.
              </p>
            </div>
          </div>
        </article>
      </div>
    </DashboardShell>
  );
}
