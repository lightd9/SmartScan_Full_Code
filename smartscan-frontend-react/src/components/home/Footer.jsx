import { Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import React from "react";
import { Link } from "react-router-dom";
import { useScanner } from "../../context/ScannerContext";
import { BLOCK_EXPLORER_URL, CHAIN_NAME, CONTRACT_ADDRESS } from "../../config/contract";

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
          {CONTRACT_ADDRESS && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000' && (
            <a
              href={`${BLOCK_EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <Typography sx={footerLinkSx}>{CHAIN_NAME} smart contract</Typography>
            </a>
          )}
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
