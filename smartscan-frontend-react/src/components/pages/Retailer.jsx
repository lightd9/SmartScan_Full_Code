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
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';

export default function Retailer() {
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
        console.error('Failed to load retailer stock records:', err);
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const confirmedCount = products.filter((p) => p.chain_status === 'confirmed').length;

  const retailerMetrics = [
    {
      icon: <CheckCircleRoundedIcon sx={{ fontSize: 16, color: '#16A34A' }} />,
      value: 'Online',
      label: 'POS Terminal',
      onClick: () => navigate('/pos'),
    },
    {
      icon: <Inventory2OutlinedIcon sx={{ fontSize: 16, color: 'var(--color-primary)' }} />,
      value: loading ? '—' : String(products.length),
      label: 'Shelf Inventory',
    },
    {
      icon: <SecurityRoundedIcon sx={{ fontSize: 16, color: '#9333EA' }} />,
      value: loading ? '—' : String(confirmedCount),
      label: 'Ledger Verified',
    },
  ];

  const tableRows = products.map((item) => {
    const isConfirmed = item.chain_status === 'confirmed';
    const isNeedsRetry = item.chain_status === 'needs_retry';
    const isFailed = item.chain_status === 'failed';
    const isDraft = item.chain_status === 'pending_wallet';
    const statusColor = isConfirmed ? 'green' : isFailed ? 'red' : isNeedsRetry || isDraft ? 'amber' : 'purple';
    const statusLabel = isConfirmed
      ? 'Available'
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
      title: `${item.name || 'Store Item'} (${String(item.serialnumber || '').slice(0, 14)}…)`,
      assigneeName: item.chain_location || item.chain_actor || 'Retail Shelf',
      statusLabel,
      statusColor,
      onClick: () => navigate(`/product-details/${encodeURIComponent(item.serialnumber)}`),
    };
  });

  const handleScrollToInventory = () => {
    const element = document.getElementById('retail-inventory');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <DashboardShell>
      {/* Personalized Greeting & Store Operational Metrics */}
      <GreetingBanner
        title="Retail Operations"
        subtitle={`Welcome back, ${auth?.name || auth?.username || 'Partner'} · Point-of-Sale & Storefront`}
        metrics={retailerMetrics}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={() => openScanner()}
              aria-label="Open camera scanner"
            >
              <QrCodeScannerOutlinedIcon sx={{ fontSize: 17 }} />
              <span>Scan Item</span>
            </button>
            <button
              type="button"
              className="btn-primary-action"
              onClick={() => navigate('/pos')}
              aria-label="Open Point of Sale register"
            >
              <PointOfSaleOutlinedIcon sx={{ fontSize: 18 }} />
              <span>Open POS</span>
            </button>
          </div>
        }
      />

      {/* Primary Workflow Cards with Distinct Actions */}
      <section className="workflow-card-grid" aria-label="Retailer workflows">
        <DashboardWorkflowCard
          icon={<PointOfSaleOutlinedIcon />}
          title="Sell Verified Product (POS)"
          description="Authenticate item QR at counter, collect buyer warranty info, and register the permanent consumer sale on-chain with instant digital receipt."
          actionLabel="Launch POS Terminal"
          onAction={() => navigate('/pos')}
        />
        <DashboardWorkflowCard
          icon={<StorefrontOutlinedIcon />}
          title="Inbound Store Receiving"
          description="Scan incoming stock from certified logistics suppliers to authenticate dispatch proofs and confirm store custody on the blockchain."
          actionLabel="Receive Shipment"
          onAction={() => openScanner()}
        />
        <DashboardWorkflowCard
          icon={<Inventory2OutlinedIcon />}
          title="Shelf Inventory & Warranty Check"
          description="Inspect live store stock, review warranty passports, and audit returned merchandise against blockchain origin records."
          actionLabel="View Shelf Inventory"
          onAction={handleScrollToInventory}
        />
      </section>

      {loadError && (
        <p className="dashboard-error" role="alert">
          Inventory records could not be refreshed. Check network connectivity or retry.
        </p>
      )}

      {/* Store Inventory & Shelf Stock Data Table */}
      <div id="retail-inventory" style={{ marginTop: '24px', scrollMarginTop: '80px' }}>
        <PrimaryDataCard
          title="Store Stock & Shelf Inventory"
          titleIcon={<StorefrontOutlinedIcon className="card-title-icon" />}
          filterLabel="All Items"
          filterOptions={['All Items', 'Available', 'In Transit', 'Needs Review']}
          columns={[
            { label: 'Product & Serial', icon: <QrCode2OutlinedIcon sx={{ fontSize: 16 }} /> },
            { label: 'Store Custodian / Display', icon: <StorefrontOutlinedIcon sx={{ fontSize: 16 }} /> },
            { label: 'Status & Verification', icon: <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> },
          ]}
          rows={tableRows}
          emptyMessage={
            loading
              ? 'Loading store inventory records…'
              : loadError
                ? 'Store stock data is temporarily unavailable.'
                : 'No store inventory recorded yet. Receive incoming shipments to stock shelves.'
          }
        />
      </div>

      {/* Point-of-Sale Best Practices & Guidance */}
      <div className="dashboard-grid-split" style={{ marginTop: '24px' }}>
        <article className="dashboard-card" aria-labelledby="pos-guidelines-title">
          <header className="card-header-clean">
            <div className="card-title-group">
              <ReceiptLongOutlinedIcon className="card-title-icon" sx={{ color: 'var(--color-primary)' }} />
              <h2 id="pos-guidelines-title" className="card-title-text">
                Point-of-Sale Counter Protocol
              </h2>
            </div>
            <span className="status-pill blue">Standard</span>
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
                    Authenticity Verification
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Scan the product passport before billing. Verify that your store holds confirmed custody and the stage is Delivered.
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
                    Digital Receipt & Warranty Issuance
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Completing checkout automatically issues a thermal receipt QR that allows the consumer to verify their authentic ownership.
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
                    Return Clearance Verification
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Verify consumer receipt QR against original on-chain sale block before processing refunds or product exchanges.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </article>

        <article className="dashboard-card" aria-labelledby="retailer-tips-title">
          <header className="card-header-clean">
            <div className="card-title-group">
              <HelpOutlineRoundedIcon className="card-title-icon" sx={{ color: 'var(--color-primary)' }} />
              <h2 id="retailer-tips-title" className="card-title-text">
                Register Resources
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
                Hardware barcode scanner mode
              </strong>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                USB and Bluetooth HID barcode/QR wands work natively. Simply focus the POS or scanner page input and pull the trigger.
              </p>
            </div>
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
            }}>
              <strong style={{ fontSize: '13px', color: 'var(--color-text-main)', display: 'block', marginBottom: '4px' }}>
                Cashier subaccounts
              </strong>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Shift cashiers can sign sales using role-delegated operator accounts without administrative configuration permissions.
              </p>
            </div>
          </div>
        </article>
      </div>
    </DashboardShell>
  );
}
