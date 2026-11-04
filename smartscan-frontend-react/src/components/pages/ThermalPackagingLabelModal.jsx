import { Dialog, DialogContent, DialogActions, Button, Box, Typography, IconButton } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import QRCode from 'qrcode.react';
import dayjs from 'dayjs';

/**
 * Standard 4x6 inch (100mm x 150mm) Thermal Shipping & Packaging Label Modal
 * Optimized for Zebra, Dymo, Rollo, Brother, and standard desktop office printers.
 */
const ThermalPackagingLabelModal = ({
    open,
    onClose,
    serialNumber,
    name,
    brand,
    location,
    date,
    qrData,
    contractAddress,
}) => {
    if (!serialNumber) return null;

    const formattedDate = date ? dayjs(Number(date) * 1000).format('MMMM D, YYYY · h:mm A') : dayjs().format('MMMM D, YYYY');
    const cleanLocation = (location || 'Factory Floor, Verified Origin').replace(/;/g, ', ');

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPng = () => {
        const canvas = document.getElementById("thermal-label-qrcode-canvas");
        if (!canvas) return;
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `thermal_label_${serialNumber}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
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
                px: 3,
                py: 2,
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
            }}>
                <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F172A' }}>
                        Print Packaging Label (4×6″ Thermal Specification)
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>
                        Universal packaging tag compatible with barcode scanners & smartphone cameras
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="small">
                    <CloseRoundedIcon />
                </IconButton>
            </Box>

            <DialogContent sx={{ p: 3, backgroundColor: '#F1F5F9', display: 'flex', justifyContent: 'center' }}>
                {/* Print Stylesheet (Injected dynamically) */}
                <style>{`
                    @media print {
                        body * {
                            visibility: hidden !important;
                        }
                        #thermal-packaging-label, #thermal-packaging-label * {
                            visibility: visible !important;
                        }
                        #thermal-packaging-label {
                            position: fixed !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 4in !important;
                            height: 6in !important;
                            margin: 0 !important;
                            padding: 0.25in !important;
                            box-sizing: border-box !important;
                            background: #ffffff !important;
                            color: #000000 !important;
                            border: 2px dashed #000000 !important;
                        }
                        @page {
                            size: 4in 6in;
                            margin: 0;
                        }
                    }
                `}</style>

                {/* 4x6 Physical Label Canvas Container */}
                <div
                    id="thermal-packaging-label"
                    style={{
                        width: '380px',
                        minHeight: '570px',
                        backgroundColor: '#FFFFFF',
                        color: '#000000',
                        border: '2px dashed #334155',
                        borderRadius: '8px',
                        padding: '20px',
                        boxSizing: 'border-box',
                        fontFamily: "'Courier New', Courier, monospace",
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                    }}
                >
                    {/* Top Header Block */}
                    <div>
                        <div style={{
                            borderBottom: '2px solid #000000',
                            paddingBottom: '8px',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <div>
                                <span style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '0.08em', display: 'block' }}>
                                    SMARTSCAN™ VERIFIED
                                </span>
                                <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.05em' }}>
                                    ETHEREUM SEPOLIA PRODUCT PASSPORT
                                </span>
                            </div>
                            <div style={{
                                border: '1.5px solid #000',
                                padding: '2px 6px',
                                fontSize: '10px',
                                fontWeight: 800,
                            }}>
                                STAGE: 01
                            </div>
                        </div>

                        {/* Product Title & Brand */}
                        <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                                ITEM DESCRIPTION
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 900, lineHeight: 1.2, wordBreak: 'break-word', color: '#000000' }}>
                                {name || 'Authentic Product'}
                            </div>
                            {brand && (
                                <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>
                                    BRAND: {brand.toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Central High-Resolution QR Code */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '10px 0',
                        padding: '12px',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        backgroundColor: '#FFFFFF',
                    }}>
                        <QRCode
                            value={qrData || serialNumber}
                            id="thermal-label-qrcode-canvas"
                            size={185}
                            level="H"
                            includeMargin={false}
                        />
                        <div style={{ fontSize: '9px', fontWeight: 700, marginTop: '6px', textAlign: 'center', letterSpacing: '0.05em' }}>
                            SCAN WITH SMARTPHONE CAMERA OR 2D SCANNER
                        </div>
                    </div>

                    {/* Human-Readable Serial Number (Monospace, Large) */}
                    <div>
                        <div style={{
                            borderTop: '1.5px solid #000000',
                            borderBottom: '1.5px solid #000000',
                            padding: '8px 0',
                            textAlign: 'center',
                            marginBottom: '10px',
                        }}>
                            <div style={{ fontSize: '9px', letterSpacing: '0.08em', fontWeight: 700 }}>
                                HUMAN-READABLE PRODUCT IDENTIFIER
                            </div>
                            <div style={{ fontSize: '13.5px', fontWeight: 900, letterSpacing: '0.05em', wordBreak: 'break-all' }}>
                                {serialNumber}
                            </div>
                        </div>

                        {/* Metadata Grid */}
                        <div style={{ fontSize: '10.5px', lineHeight: 1.45, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div>
                                <strong>ORIGIN: </strong>{cleanLocation}
                            </div>
                            <div>
                                <strong>DATE: </strong>{formattedDate}
                            </div>
                            {contractAddress && (
                                <div style={{ fontSize: '9px', color: '#334155', wordBreak: 'break-all' }}>
                                    <strong>CONTRACT: </strong>{contractAddress}
                                </div>
                            )}
                        </div>

                        {/* Security Footer Notice */}
                        <div style={{
                            marginTop: '10px',
                            paddingTop: '6px',
                            borderTop: '1px dashed #64748B',
                            fontSize: '8.5px',
                            textAlign: 'center',
                            color: '#334155',
                            lineHeight: 1.3,
                        }}>
                            Tamper-evident cryptographic seal. Verification history is permanently recorded on blockchain.
                        </div>
                    </div>
                </div>
            </DialogContent>

            {/* Modal Actions */}
            <DialogActions sx={{ px: 3, py: 2, backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
                <Button
                    variant="outlined"
                    startIcon={<DownloadRoundedIcon />}
                    onClick={handleDownloadPng}
                    sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 600 }}
                >
                    Save QR PNG
                </Button>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                        variant="text"
                        onClick={onClose}
                        sx={{ textTransform: 'none', borderRadius: '10px', color: '#64748B' }}
                    >
                        Close
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<PrintRoundedIcon />}
                        onClick={handlePrint}
                        sx={{
                            textTransform: 'none',
                            borderRadius: '10px',
                            backgroundColor: '#2563EB',
                            fontWeight: 700,
                            px: 3,
                            '&:hover': { backgroundColor: '#1D4ED8' }
                        }}
                    >
                        Print 4×6 Label
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
};

export default ThermalPackagingLabelModal;

