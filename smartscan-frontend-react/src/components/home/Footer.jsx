import { Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import React from "react";
import { Link } from "react-router-dom";
import { useScanner } from "../../context/ScannerContext";

const footerLinkSx = {
  fontSize: "15px",
  color: "#64748B",
  fontWeight: "500",
  mb: 1.5,
  display: "block",
  textDecoration: "none",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  transition: "color 0.2s ease",
  "&:hover": {
    color: "#2563EB",
  },
};

const Footer = () => {
  const { openScanner } = useScanner();

  return (
    <Box sx={{ py: 8, borderTop: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
      <Container
        sx={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 4,
          "@media (max-width: 600px)": {
            flexDirection: "column",
            textAlign: "center",
          },
        }}
      >
        <Box sx={{ minWidth: 160 }}>
          <Typography
            sx={{ fontSize: "17px", color: "#0F172A", fontWeight: "700", mb: 2, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Quick Links
          </Typography>

          <Link to="/" style={{ textDecoration: 'none' }}>
            <Typography sx={footerLinkSx}>Home</Typography>
          </Link>
          <span onClick={() => openScanner()} style={{ cursor: 'pointer' }}>
            <Typography sx={footerLinkSx}>Verify a Product</Typography>
          </span>
          <Link to="/pos" style={{ textDecoration: 'none' }}>
            <Typography sx={footerLinkSx}>POS Checkout Terminal</Typography>
          </Link>
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <Typography sx={footerLinkSx}>Enterprise Login</Typography>
          </Link>
        </Box>

        <Box sx={{ maxWidth: 360 }}>
          <Typography
            sx={{ fontSize: "17px", color: "#0F172A", fontWeight: "700", mb: 2, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            About SmartScan
          </Typography>
          <Typography
            sx={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            SmartScan provides immutable cryptographic provenance and anti-counterfeiting tracking across manufacturers, distributors, and retailers on Ethereum.
          </Typography>
        </Box>

        <Box sx={{ minWidth: 200 }}>
          <Typography
            sx={{ fontSize: "17px", color: "#0F172A", fontWeight: "700", mb: 2, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Resources & Code
          </Typography>
          <a
            href="https://github.com/lightd9/SmartScan_Full_Code"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <Typography sx={footerLinkSx}>GitHub Repository</Typography>
          </a>
          <a
            href="https://sepolia.etherscan.io/address/0xC4Dc9a66A669F88ac80eA6555796Fb576a388D96"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <Typography sx={footerLinkSx}>Sepolia Smart Contract</Typography>
          </a>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
