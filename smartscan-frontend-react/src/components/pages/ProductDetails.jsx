import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import QRCode from 'qrcode.react';
import dayjs from 'dayjs';

import axios, { getApiUrl } from '../../api/axios';
import useAuth from '../../hooks/useAuth';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_NAME, BLOCK_EXPLORER_URL, CHAIN_RPC_URL } from '../../config/contract';
import DashboardShell from '../shell/DashboardShell';
import GreetingBanner from '../shell/GreetingBanner';
import '../shell/shell.css';

// Material Icons
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

const ROLE_NAMES = ['Unregistered', 'Admin', 'Manufacturer', 'Supplier', 'Retailer'];
const STAGE_NAMES = ['Unregistered', 'Manufactured', 'In Transit', 'In Custody', 'Sold'];

export default function ProductDetails() {
  const { serialNumber } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [productDb, setProductDb] = useState(null);
  const [onchainProduct, setOnchainProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const loadProductData = useCallback(async () => {
    if (!serialNumber) return;
    setLoading(true);
    setError('');
    try {
      // 1. Fetch DB product record
      let dbData = null;
      try {
        const res = await axios.get(`/product/${encodeURIComponent(serialNumber)}/chain-status`);
        dbData = res.data;
        setProductDb(dbData);
      } catch (dbErr) {
        console.warn('Could not load DB record for product:', dbErr.message);
      }

      // 2. Fetch on-chain record directly from Sepolia
      const provider = new ethers.JsonRpcProvider(CHAIN_RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const exists = await contract.productExists(serialNumber);

      if (exists) {
        const chainData = await contract.getProduct(serialNumber);
        const parsedHistory = chainData[5].map((evt) => ({
          id: evt.id.toString(),
          actor: evt.actor,
          actorWallet: evt.actorWallet,
          actorRole: Number(evt.actorRole),
          location: (evt.location || '').replace(/;/g, ', '),
          timestamp: Number(evt.timestamp),
          action: Number(evt.action),
          recipientWallet: evt.recipientWallet,
        }));

        setOnchainProduct({
          serialNumber: chainData[0],
          name: chainData[1],
          brand: chainData[2],
          description: (chainData[3] || '').replace(/;/g, ', '),
          image: chainData[4],
          history: parsedHistory,
          stage: Number(chainData[6]),
          custodian: chainData[7],
          pendingRecipient: chainData[8],
          isSold: Boolean(chainData[9]),
          isRecalled: Boolean(chainData[10]),
        });
      } else if (!dbData) {
        setError(`Product identifier "${serialNumber}" was not found on the blockchain or in the registry.`);
      }
    } catch (err) {
      console.error('Failed to load product details:', err);
      setError(err.response?.data?.error || err.message || 'Unable to load product data.');
    } finally {
      setLoading(false);
    }
  }, [serialNumber]);

  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  const copySerial = async () => {
    if (!serialNumber) return;
    try {
      await navigator.clipboard.writeText(serialNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      // ignore
    }
  };

  const downloadQR = () => {
    const canvas = document.getElementById('ProductQRCode');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `QR-${serialNumber}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handle1ClickDispatch = async () => {
    setDispatchLoading(true);
    setActionNotice('');
    try {
      const res = await axios.post('/api/custody/auto-execute', {
        serialNumber,
        action: 'dispatch',
        location: productDb?.chain_location || 'Headquarters Distribution Facility',
        recipientWallet: ethers.ZeroAddress,
      });

      if (res.data?.success) {
        setActionNotice('🚀 Product consignment successfully dispatched to distribution network! Logistics partners can now confirm delivery.');
        await loadProductData();
      } else {
        throw new Error(res.data?.error || 'Dispatch execution failed.');
      }
    } catch (err) {
      console.error('Dispatch error:', err);
      setActionNotice(`❌ Dispatch error: ${err.response?.data?.error || err.message}`);
    } finally {
      setDispatchLoading(false);
    }
  };

  const qrUrl = `${window.location.origin}/verify/${encodeURIComponent(serialNumber || '')}`;
  const displayStage = onchainProduct ? onchainProduct.stage : 1;
  const isDispatched = displayStage >= 2;
  const isDelivered = displayStage >= 3;
  const isSold = onchainProduct?.isSold || displayStage === 4;

  const stageBadgeLabel = isSold
    ? 'Finalized / Sold'
    : isDelivered
    ? 'In Custody of Partner'
    : isDispatched
    ? 'In Transit (Dispatched)'
    : 'Manufactured (Ready for Dispatch)';

  const stageBadgeColor = isSold ? 'blue' : isDelivered ? 'purple' : isDispatched ? 'orange' : 'green';

  const txHash = onchainProduct?.history?.[0]?.txHash || productDb?.chain_tx_hash;
  const imageFileName = onchainProduct?.image || productDb?.chain_image;
  const imageUrl = imageFileName ? getApiUrl(`/file/product/${encodeURIComponent(imageFileName)}`) : null;

  return (
    <DashboardShell>
      <GreetingBanner
        title={onchainProduct?.name || productDb?.name || 'Product Details'}
        subtitle={`Canonical Serial Number: ${serialNumber}`}
        metrics={[
          {
            icon: <Inventory2OutlinedIcon sx={{ fontSize: 17, color: 'var(--color-primary)' }} />,
            value: onchainProduct?.brand || productDb?.brand || 'Brand',
            label: 'Product Brand',
          },
          {
            icon: <CheckCircleRoundedIcon sx={{ fontSize: 17, color: '#10B981' }} />,
            value: onchainProduct ? 'On-Chain' : productDb?.chain_status || 'Registered',
            label: 'Provenance Status',
          },
          {
            icon: <LocalShippingOutlinedIcon sx={{ fontSize: 17, color: isDispatched ? '#2563EB' : '#10B981' }} />,
            value: STAGE_NAMES[displayStage] || 'Manufactured',
            label: 'Supply Chain Stage',
          },
        ]}
        actions={
          <button
            type="button"
            className="btn-secondary-action"
            onClick={() => navigate('/manufacturer')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
            <span>Back to Dashboard</span>
          </button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {actionNotice && (
        <Alert severity={actionNotice.startsWith('❌') ? 'error' : 'success'} sx={{ mb: 3 }}>
          {actionNotice}
        </Alert>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
          <CircularProgress size={32} />
        </div>
      ) : (
        <div className="dashboard-grid-dual">
          {/* Left Column: Product Passport & Specifications */}
          <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={onchainProduct?.name || productDb?.name || 'Product'}
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 14,
                    objectFit: 'cover',
                    border: '1px solid var(--color-border)',
                  }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 14,
                    backgroundColor: 'var(--color-primary-subtle)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    fontWeight: 700,
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {(onchainProduct?.name || productDb?.name || 'P').charAt(0).toUpperCase()}
                </div>
              )}

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {onchainProduct?.name || productDb?.name || 'Untitled Product'}
                  </h2>
                  <span className={`status-pill ${stageBadgeColor}`}>
                    {stageBadgeLabel}
                  </span>
                </div>

                <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--color-text-secondary)' }}>
                  Brand: <strong style={{ color: 'var(--color-text-main)' }}>{onchainProduct?.brand || productDb?.brand || '—'}</strong>
                  {productDb?.manufacturer_username && (
                    <span> • Registered by @{productDb.manufacturer_username}</span>
                  )}
                </p>

                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ fontSize: '12.5px', color: 'var(--color-text-main)', background: 'var(--color-surface-subtle)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                    {serialNumber}
                  </code>
                  <button
                    type="button"
                    onClick={copySerial}
                    className="btn-secondary-action"
                    style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <ContentCopyRoundedIcon sx={{ fontSize: 12 }} />
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Product Description */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Product Description
              </span>
              <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'var(--color-text-main)', lineHeight: 1.5 }}>
                {onchainProduct?.description || productDb?.chain_description || 'No corporate description provided.'}
              </p>
            </div>

            {/* Manufacturing & Origin Information */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--color-surface-subtle)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <PlaceOutlinedIcon sx={{ fontSize: 13 }} /> Origin Location
                </span>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-main)', fontWeight: 500 }}>
                  {onchainProduct?.history?.[0]?.location || productDb?.chain_location || 'Not specified'}
                </p>
              </div>

              <div style={{ background: 'var(--color-surface-subtle)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BusinessRoundedIcon sx={{ fontSize: 13 }} /> Registered Origin
                </span>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-text-main)', fontWeight: 500 }}>
                  {onchainProduct?.history?.[0]?.actor || productDb?.chain_actor || 'Origin Facility'}
                </p>
              </div>
            </div>

            {/* On-Chain Ledger Audit */}
            <div style={{ background: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 14 }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Sepolia Smart Contract Identity
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Contract:</span>
                  <code style={{ fontSize: '11.5px' }}>{CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-8)}</code>
                </div>
                {txHash && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Tx Hash:</span>
                    <a
                      href={`${BLOCK_EXPLORER_URL}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '11.5px' }}
                    >
                      <span>{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                      <OpenInNewRoundedIcon sx={{ fontSize: 12 }} />
                    </a>
                  </div>
                )}
                {onchainProduct?.custodian && onchainProduct.custodian !== ethers.ZeroAddress && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Current Custodian:</span>
                    <code style={{ fontSize: '11.5px' }}>{onchainProduct.custodian.slice(0, 10)}...{onchainProduct.custodian.slice(-8)}</code>
                  </div>
                )}
              </div>
            </div>

            {/* Dispatch Action for Manufacturer */}
            {auth?.role === 'manufacturer' && (
              <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                {!isDispatched ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', fontSize: '13px' }}>
                      📦 <strong>Ready for Distribution:</strong> This product has been minted on {CHAIN_NAME}. Click below to dispatch the item into the logistics network.
                    </div>
                    <button
                      type="button"
                      className="btn-primary-action"
                      style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px' }}
                      onClick={handle1ClickDispatch}
                      disabled={dispatchLoading}
                    >
                      {dispatchLoading ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CircularProgress size={16} color="inherit" />
                          Signing Outbound Dispatch via Facility Wallet...
                        </span>
                      ) : (
                        '🚀 1-Click Dispatch to Distribution Network'
                      )}
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '14px 16px', borderRadius: 10, backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', fontSize: '13.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircleRoundedIcon sx={{ fontSize: 20, color: '#2563EB' }} />
                    <span>Consignment Dispatched & In Transit to Partners</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Packaging QR Code & Provenance Timeline */}
          <div className="dashboard-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Packaging QR Code Card */}
            <div style={{ background: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Official Packaging QR Code
                </span>
                <span className={`status-pill ${isDispatched ? 'orange' : 'green'}`} style={{ fontSize: '11px' }}>
                  {isDispatched ? 'In Transit Tag' : 'Factory Tag'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, background: '#FFFFFF', padding: 16, borderRadius: 10, width: 'fit-content', margin: '0 auto 14px auto', border: '1px solid var(--color-border)' }}>
                <QRCode
                  id="ProductQRCode"
                  value={qrUrl}
                  size={160}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                Scanning this QR code directs logistics partners, retailers, and end-consumers to the cryptographic provenance verification record.
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={downloadQR}
                  className="btn-secondary-action"
                  style={{ flex: 1, justifyContent: 'center', padding: '10px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <DownloadRoundedIcon sx={{ fontSize: 16 }} />
                  <span>Download PNG Label</span>
                </button>

                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary-action"
                  style={{ flex: 1, justifyContent: 'center', padding: '10px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                >
                  <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
                  <span>Consumer Verification</span>
                </a>
              </div>
            </div>

            {/* Provenance Event Timeline */}
            <div>
              <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                Cryptographic Custody Timeline
              </h3>

              {onchainProduct?.history && onchainProduct.history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {onchainProduct.history.map((event, idx) => {
                    const actionLabel =
                      event.action === 0
                        ? 'Product Manufactured & Minted'
                        : event.action === 1
                        ? 'Dispatched to Logistics Network'
                        : event.action === 2
                        ? 'Custody Handover Confirmed'
                        : event.action === 3
                        ? 'Final Sale at Retail'
                        : 'Custody Event';

                    const roleLabel = ROLE_NAMES[event.actorRole] || 'Partner';
                    const formattedDate = event.timestamp
                      ? dayjs.unix(event.timestamp).format('MMM D, YYYY • h:mm A')
                      : 'Initial Registration';

                    return (
                      <div
                        key={event.id || idx}
                        style={{
                          background: 'var(--color-surface-subtle)',
                          borderRadius: 10,
                          padding: '12px 14px',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <strong style={{ fontSize: '13.5px', color: 'var(--color-text-main)' }}>
                            {actionLabel}
                          </strong>
                          <span className="status-pill purple" style={{ fontSize: '10.5px' }}>
                            {roleLabel}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          Actor: {event.actor} {event.location ? `• ${event.location}` : ''}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          <span>{formattedDate}</span>
                          <code>{event.actorWallet ? `${event.actorWallet.slice(0, 8)}...` : ''}</code>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Initial on-chain registration block recorded. No subsequent supply chain movements logged yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
