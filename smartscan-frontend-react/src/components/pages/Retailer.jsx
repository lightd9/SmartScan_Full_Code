import React from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { useScanner } from '../../context/ScannerContext';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import DashboardWorkflowCard from '../shell/DashboardWorkflowCard';

import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';

export default function Retailer() {
  const { auth } = useAuth();
  const { openScanner } = useScanner();
  const navigate = useNavigate();

  return (
    <DashboardShell>
      <GreetingBanner
        title={`Retail operations, ${auth?.name || auth?.username || ''}`}
        actions={
          <button type="button" className="btn-primary-action" onClick={() => navigate('/pos')}>
            <PointOfSaleOutlinedIcon sx={{ fontSize: 18 }} />
            <span>Open POS</span>
          </button>
        }
      />

      <section className="workflow-card-grid" aria-label="Retailer workflows">
        <DashboardWorkflowCard
          icon={<PointOfSaleOutlinedIcon />}
          title="Sell a verified product"
          description="Check a product and complete checkout through the point-of-sale flow. The sale is recorded on the configured chain."
          actionLabel="Open checkout"
          onAction={() => navigate('/pos')}
        />
        <DashboardWorkflowCard
          icon={<StorefrontOutlinedIcon />}
          title="Receive or inspect a product"
          description="Scan the product QR to inspect its provenance and review the custody action available to your retailer wallet."
          actionLabel="Scan product"
          onAction={() => openScanner()}
        />
        <DashboardWorkflowCard
          icon={<QrCodeScannerOutlinedIcon />}
          title="Verify a customer item"
          description="Use the scanner to review the product passport and chain status before accepting a return or answering a customer question."
          actionLabel="Open scanner"
          onAction={() => openScanner()}
        />
      </section>
    </DashboardShell>
  );
}
