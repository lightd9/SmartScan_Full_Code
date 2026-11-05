import React from 'react';
import useAuth from '../../hooks/useAuth';
import { useScanner } from '../../context/ScannerContext';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import DashboardWorkflowCard from '../shell/DashboardWorkflowCard';

import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';

export default function Supplier() {
  const { auth } = useAuth();
  const { openScanner } = useScanner();

  return (
    <DashboardShell>
      <GreetingBanner
        title={`Supplier operations, ${auth?.name || auth?.username || ''}`}
        actions={
          <button type="button" className="btn-primary-action" onClick={() => openScanner()}>
            <QrCodeScannerOutlinedIcon sx={{ fontSize: 18 }} />
            <span>Scan shipment</span>
          </button>
        }
      />

      <section className="workflow-card-grid" aria-label="Supplier workflows">
        <DashboardWorkflowCard
          icon={<WarehouseOutlinedIcon />}
          title="Receive a delivery"
          description="Scan the product QR after physical receipt to review its provenance and record an eligible custody confirmation."
          actionLabel="Scan delivery"
          onAction={() => openScanner()}
        />
        <DashboardWorkflowCard
          icon={<LocalShippingOutlinedIcon />}
          title="Dispatch a shipment"
          description="Scan a product in your custody to review its current chain stage and available dispatch action."
          actionLabel="Scan product"
          onAction={() => openScanner()}
        />
      </section>
    </DashboardShell>
  );
}
