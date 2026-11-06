import React from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { useScanner } from '../../context/ScannerContext';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import DashboardWorkflowCard from '../shell/DashboardWorkflowCard';

// Material Icons
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';

export default function Retailer() {
  const { auth } = useAuth();
  const { openScanner } = useScanner();
  const navigate = useNavigate();

  const retailerMetrics = [
    {
      icon: <CheckCircleRoundedIcon sx={{ fontSize: 16, color: '#16A34A' }} />,
      value: 'Online',
      label: 'POS Terminal',
      onClick: () => navigate('/pos'),
    },
    {
      icon: <SecurityRoundedIcon sx={{ fontSize: 16, color: 'var(--color-primary)' }} />,
      value: 'Headless',
      label: 'Relay Active',
    },
    {
      icon: <QrCodeScannerOutlinedIcon sx={{ fontSize: 16, color: '#D97706' }} />,
      value: 'Ready',
      label: 'Barcode & QR Scanner',
      onClick: () => openScanner(),
    },
  ];

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

      {/* Primary Workflow Cards */}
      <section className="workflow-card-grid" aria-label="Retailer workflows">
        <DashboardWorkflowCard
          icon={<PointOfSaleOutlinedIcon />}
          title="Sell Verified Product (POS)"
          description="Authenticate item QR at counter, collect buyer warranty info, and register the permanent consumer sale on-chain with instant digital receipt."
          actionLabel="Launch Checkout"
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
          icon={<QrCodeScannerOutlinedIcon />}
          title="Customer Item & Return Check"
          description="Inspect digital passport, warranty registration, and recorded retailer proof before accepting customer returns or issuing replacements."
          actionLabel="Inspect Passport"
          onAction={() => openScanner()}
        />
      </section>

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
                    Tamper Protection
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Once sold, the blockchain ledger permanently locks the product stage as Sold to prevent counterfeit clone re-entry.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </article>

        <article className="dashboard-card" aria-labelledby="terminal-shortcuts-title">
          <header className="card-header-clean">
            <div className="card-title-group">
              <HelpOutlineRoundedIcon className="card-title-icon" sx={{ color: 'var(--color-primary)' }} />
              <h2 id="terminal-shortcuts-title" className="card-title-text">
                Terminal Quick Tools
              </h2>
            </div>
          </header>
          <div className="card-content-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border)',
            }}>
              <strong style={{ fontSize: '13px', color: 'var(--color-text-main)', display: 'block', marginBottom: '4px' }}>
                Hardware barcode scanner support
              </strong>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                USB and Bluetooth HID scanners work automatically on the POS screen by typing the serial code into the scan field.
              </p>
            </div>
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border)',
            }}>
              <strong style={{ fontSize: '13px', color: 'var(--color-text-main)', display: 'block', marginBottom: '4px' }}>
                Thermal label printer integration
              </strong>
              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Use the thermal packaging modal to print standardized 4x6" shipping and counter QR labels for customer packages.
              </p>
            </div>
          </div>
        </article>
      </div>
    </DashboardShell>
  );
}
