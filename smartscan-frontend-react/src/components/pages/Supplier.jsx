import React from 'react';
import useAuth from '../../hooks/useAuth';
import { useScanner } from '../../context/ScannerContext';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import DashboardWorkflowCard from '../shell/DashboardWorkflowCard';

// Material Icons
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';

export default function Supplier() {
  const { auth } = useAuth();
  const { openScanner } = useScanner();

  const supplierMetrics = [
    {
      icon: <CheckCircleRoundedIcon sx={{ fontSize: 16, color: '#16A34A' }} />,
      value: 'Active',
      label: 'Custody Node',
    },
    {
      icon: <SecurityRoundedIcon sx={{ fontSize: 16, color: 'var(--color-primary)' }} />,
      value: 'Headless',
      label: 'Gasless Relay',
    },
    {
      icon: <QrCodeScannerOutlinedIcon sx={{ fontSize: 16, color: '#D97706' }} />,
      value: 'Ready',
      label: 'Scan Facility',
      onClick: () => openScanner(),
    },
  ];

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

      {/* Primary Workflow Cards */}
      <section className="workflow-card-grid" aria-label="Supplier workflows">
        <DashboardWorkflowCard
          icon={<WarehouseOutlinedIcon />}
          title="Receive Inbound Delivery"
          description="Scan physical packaging QR codes upon cargo arrival to verify cryptographic origin, validate batch proof, and accept custody on-chain."
          actionLabel="Receive Delivery"
          onAction={() => openScanner()}
        />
        <DashboardWorkflowCard
          icon={<LocalShippingOutlinedIcon />}
          title="Dispatch Outbound Shipment"
          description="Scan inventory in your warehouse custody to assign freight shipments to downstream retail partners or distribution facilities."
          actionLabel="Dispatch Freight"
          onAction={() => openScanner()}
        />
        <DashboardWorkflowCard
          icon={<VerifiedUserOutlinedIcon />}
          title="Field Provenance Audit"
          description="Inspect digital passport, sensor and packaging tamper data, and verify cryptographic authenticity before clearing cargo for dispatch."
          actionLabel="Verify Passport"
          onAction={() => openScanner()}
        />
      </section>

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
              backgroundColor: 'var(--color-bg-subtle)',
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
              backgroundColor: 'var(--color-bg-subtle)',
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
