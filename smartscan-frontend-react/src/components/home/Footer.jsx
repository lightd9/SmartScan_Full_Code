import { styled, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import React from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  const CustomContainer = styled(Container)(({ theme }) => ({
    display: "flex",
    justifyContent: "space-around",
    gap: theme.spacing(5),
    [theme.breakpoints.down("sm")]: {
      flexDirection: "column",
      textAlign: "center",
    },
  }));

  const FooterLink = styled(Typography)(({ theme }) => ({
    fontSize: "16px",
    color: "#7A7A7E",
    fontWeight: "300",
    marginBottom: theme.spacing(1),
    "&:hover": {
      color: "#000",
    },
  }));

  return (
    <Box sx={{ py: 10 }}>
      <CustomContainer>
        <Box>
          <Typography
            sx={{ fontSize: "20px", color: "#1C1C1D", fontWeight: "700", mb: 2 }}
          >
            Quick Links
          </Typography>

          <Link to="/" style={{ textDecoration: 'none' }}>
            <FooterLink>Home</FooterLink>
          </Link>
          <br />
          <Link to="/scanner" style={{ textDecoration: 'none' }}>
            <FooterLink>Verify a Product</FooterLink>
          </Link>
          <br />
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <FooterLink>Login</FooterLink>
          </Link>
        </Box>

        <Box>
          <Typography
            sx={{ fontSize: "20px", color: "#1C1C1D", fontWeight: "700", mb: 2 }}
          >
            About SmartScan
          </Typography>
          <Typography
            sx={{ fontSize: "16px", color: "#7A7A7E", fontWeight: "300", maxWidth: "320px" }}
          >
            SmartScan uses blockchain technology to record product provenance and
            let consumers verify authenticity with a QR scan.
          </Typography>
        </Box>

        <Box>
          <Typography
            sx={{ fontSize: "20px", color: "#1C1C1D", fontWeight: "700", mb: 2 }}
          >
            Get in touch
          </Typography>

          <Typography
            sx={{ fontSize: "16px", color: "#7A7A7E", fontWeight: "500", mb: 2 }}
          >
            Let us help you find the perfect solution for your needs.
          </Typography>
        </Box>
      </CustomContainer>
    </Box>
  );
};

export default Footer;
