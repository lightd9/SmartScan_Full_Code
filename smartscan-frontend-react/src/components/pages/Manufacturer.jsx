import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import PrimaryDataCard from '../shell/PrimaryDataCard';

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
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    axios.get('/product/chain-status')
      .then((res) => {
        if (active && Array.isArray(res.data)) setProducts(res.data);
      })
      .catch((err) => {
        console.error('Failed to load manufacturer products:', err);
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const tableRows = products.map((item) => {
    const isConfirmed = item.chain_status === 'confirmed';
    const isNeedsRetry = item.chain_status === 'needs_retry';
    const isFailed = item.chain_status === 'failed';
    const isDraft = item.chain_status === 'pending_wallet';
    const statusColor = isConfirmed ? 'green' : isFailed ? 'red' : isNeedsRetry || isDraft ? 'amber' : 'purple';
    const statusLabel = isConfirmed
      ? 'Confirmed'
      : isFailed
        ? 'Failed'
        : isNeedsRetry
          ? 'Needs Retry'
          : isDraft
            ? 'Draft'
            : 'Submitted';

    return {
      id: item.serialnumber,
      icon: <QrCode2OutlinedIcon sx={{ fontSize: 18, color: 'var(--color-primary)' }} />,
      title: `${item.name || 'Product'} (${String(item.serialnumber || '').slice(0, 14)}…)`,
      assigneeName: item.chain_actor || '—',
      statusLabel,
      statusColor,
      onClick: () => navigate(`/product-details/${encodeURIComponent(item.serialnumber)}`),
    };
  });

  const confirmedCount = products.filter((product) => product.chain_status === 'confirmed').length;
  const retryCount = products.filter((product) => ['needs_retry', 'failed', 'pending_wallet'].includes(product.chain_status)).length;
  const metricValue = (value) => loading ? '—' : String(value);
  const manufacturerMetrics = [
    {
      icon: <Inventory2OutlinedIcon sx={{ fontSize: 17, color: 'var(--color-primary)' }} />,
      value: metricValue(products.length),
      label: 'Products listed',
    },
    {
      icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 17, color: '#10B981' }} />,
      value: metricValue(confirmedCount),
      label: 'Chain confirmed',
    },
    {
      icon: <HourglassEmptyRoundedIcon sx={{ fontSize: 17, color: retryCount > 0 ? '#DC2626' : '#8A92A6' }} />,
      value: metricValue(retryCount),
      label: 'Needs attention',
    },
  ];

  return (
    <DashboardShell>
      <GreetingBanner
        title={`Products, ${auth?.name || auth?.username || 'Manufacturer'}`}
        metrics={manufacturerMetrics}
        actions={
          <button type="button" className="btn-primary-action" onClick={() => navigate('/add-product')}>
            <AddRoundedIcon sx={{ fontSize: 18 }} />
            <span>Register product</span>
          </button>
        }
      />

      {loadError && (
        <p className="dashboard-error" role="alert">
          Product records could not be loaded. Refresh the page or contact your administrator if the problem continues.
        </p>
      )}

      <PrimaryDataCard
        title="Product registration queue"
        titleIcon={<Inventory2OutlinedIcon className="card-title-icon" />}
        columns={[
          { label: 'Product and serial', icon: <QrCode2OutlinedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Registered actor', icon: <LocalShippingOutlinedIcon sx={{ fontSize: 16 }} /> },
          { label: 'Chain status', icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16 }} /> },
        ]}
        rows={tableRows}
        emptyMessage={loading ? 'Loading product records…' : loadError ? 'Product data is temporarily unavailable.' : 'No products registered yet. Register a product to start its provenance record.'}
      />
    </DashboardShell>
  );
}
