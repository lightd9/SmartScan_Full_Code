import { Dialog, DialogContent, DialogActions, Button, Box, Typography, IconButton } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import QRCode from 'qrcode.react';
import dayjs from 'dayjs';
import { useState } from 'react';

/**
 * 80mm (3-Inch) Thermal POS Customer Warranty Receipt Modal
 * Formatted for standard retail POS thermal printers (Epson, Star Micronics, Citizen, Rongta)
 */
const POSCustomerReceiptModal = ({
    open,
    onClose,
    receiptData,
    productData,
}) => {
    const [copied, setCopied] = useState(false);

    if (!receiptData && !productData) return null;

    const serialNumber = productData?.serialNumber || receiptData?.serialNumber || '';
    const productName = productData?.name || receiptData?.name || 'Verified Product';
    const brand = productData?.brand || receiptData?.brand || '';
    const receiptId = receiptData?.receiptId || `REC-${dayjs().format('YYYYMMDD')}-POS`;
    const storeId = receiptData?.storeId || 'STORE #01';
    const registerId = receiptData?.registerId || 'REG-01';
    const cashierName = receiptData?.cashierName || 'Cashier';
    const formattedDate = dayjs(receiptData?.timestamp || undefined).format('MMM D, YYYY · h:mm:ss A');
    const verificationUrl = receiptData?.verificationUrl || `https://smart-scan-ten.vercel.app/verify/${serialNumber}`;

    const handlePrint = () => {
        window.print();
    };

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(verificationUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (_err) {
            // ignore
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '20px',
                    padding: 0,
                    overflow: 'hidden',
                }
            }}
        >
            {/* Modal Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2.5,
                py: 1.8,
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
            }}>
                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0F172A' }}>
                        Customer Warranty Receipt (80mm POS)
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>
                        Cryptographically sealed authenticity passport
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="small">
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>

            <DialogContent sx={{ p: 2.5, backgroundColor: '#F1F5F9', display: 'flex', justifyContent: 'center' }}>
                {/* Print Stylesheet for 80mm POS Receipt Printers */}
                <style>{`
                    @media print {
                        body * {
                            visibility: hidden !important;
                        }
                        #pos-customer-receipt, #pos-customer-receipt * {
                            visibility: visible !important;
                        }
                        #pos-customer-receipt {
                            position: fixed !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 80mm !important;
                            margin: 0 !important;
                            padding: 4mm !important;
                            box-sizing: border-box !important;
                            background: #ffffff !important;
                            color: #000000 !important;
                            border: none !important;
                            font-size: 11px !important;
                        }
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }
                    }
                `}</style>

                {/* 80mm Physical Thermal Paper Receipt Preview */}
                <div
                    id="pos-customer-receipt"
                    style={{
                        width: '320px',
                        backgroundColor: '#FFFFFF',
                        color: '#000000',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '16px 14px',
                        boxSizing: 'border-box',
                        fontFamily: "'Courier New', Courier, monospace",
                        fontSize: '11.5px',
                        lineHeight: 1.35,
                        boxShadow: '0 8px 20px -4px rgba(0, 0, 0, 0.1)',
                    }}
                >
                    {/* Store Title & SmartScan Header */}
                    <div style={{ textAlign: 'center', borderBottom: '1.5px dashed #000000', paddingBottom: '10px', marginBottom: '10px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '0.08em' }}>
                            SMARTSCAN™ RETAIL
                        </div>
                        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em' }}>
                            ETHEREUM PRODUCT PASSPORT
                        </div>
                        <div style={{ fontSize: '10px', marginTop: '4px', fontWeight: 600 }}>
                            {storeId} · {registerId}
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#475569' }}>
                            {formattedDate}
                        </div>
                    </div>

                    {/* Receipt Meta */}
                    <div style={{ marginBottom: '10px', fontSize: '10.5px' }}>
                        <div><strong>RECEIPT ID: </strong>{receiptId}</div>
                        <div><strong>CASHIER: </strong>{cashierName}</div>
                        <div><strong>STATUS: </strong>100% AUTHENTIC (VERIFIED)</div>
                    </div>

                    {/* Purchased Item Block */}
                    <div style={{
                        borderTop: '1px solid #000000',
                        borderBottom: '1px solid #000000',
                        padding: '8px 0',
                        marginBottom: '10px',
                    }}>
                        <div style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase' }}>ITEM IDENTIFIER</div>
                        <div style={{ fontSize: '14px', fontWeight: 900, lineHeight: 1.2 }}>
                            {productName}
                        </div>
                        {brand && (
                            <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>
                                BRAND: {brand.toUpperCase()}
                            </div>
                        )}
                        <div style={{
                            marginTop: '6px',
                            padding: '4px 6px',
                            backgroundColor: '#F1F5F9',
                            border: '1px dashed #64748B',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            wordBreak: 'break-all',
                            textAlign: 'center',
                        }}>
                            {serialNumber}
                        </div>
                    </div>

                    {/* QR Code for Consumer Verification */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '10px 0',
                    }}>
                        <QRCode
                            value={verificationUrl}
                            size={140}
                            level="M"
                            includeMargin={false}
                        />
                        <div style={{ fontSize: '8.5px', fontWeight: 700, marginTop: '5px', textAlign: 'center', letterSpacing: '0.04em' }}>
                            SCAN WITH PHONE TO VIEW BLOCKCHAIN PASSPORT
                        </div>
                    </div>

                    {/* Security Footer */}
                    <div style={{
                        borderTop: '1.5px dashed #000000',
                        paddingTop: '8px',
                        textAlign: 'center',
                        fontSize: '8.5px',
                        color: '#334155',
                        lineHeight: 1.3,
                    }}>
                        <div><strong>OFFICIAL WARRANTY CERTIFICATE</strong></div>
                        <div>Non-repudiable origin recorded on Ethereum Sepolia. This receipt proves genuine manufacturer authenticity.</div>
                        <div style={{ marginTop: '4px', fontSize: '8px', color: '#64748B' }}>
                            smart-scan-ten.vercel.app
                        </div>
                    </div>
                </div>
            </DialogContent>

            {/* Actions */}
            <DialogActions sx={{ px: 2.5, py: 1.5, backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={copied ? <CheckCircleRoundedIcon sx={{ color: '#10B981' }} /> : <ContentCopyRoundedIcon />}
                    onClick={handleCopyUrl}
                    sx={{ textTransform: 'none', borderRadius: '8px', fontSize: '11.5px' }}
                >
                    {copied ? 'URL Copied!' : 'Copy Verify URL'}
                </Button>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        size="small"
                        variant="text"
                        onClick={onClose}
                        sx={{ textTransform: 'none', color: '#64748B', fontSize: '11.5px' }}
                    >
                        Close
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        startIcon={<PrintRoundedIcon />}
                        onClick={handlePrint}
                        sx={{
                            textTransform: 'none',
                            borderRadius: '8px',
                            backgroundColor: '#2563EB',
                            fontWeight: 700,
                            fontSize: '11.5px',
                            '&:hover': { backgroundColor: '#1D4ED8' }
                        }}
                    >
                        Print Receipt (80mm)
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
};

export default POSCustomerReceiptModal;
