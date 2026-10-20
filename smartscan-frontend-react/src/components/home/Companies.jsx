import { Box, Container, styled, Typography } from "@mui/material";
import React from "react";
import logoImg from "../../img/logo.png";

const Companies = () => {
  const CustomContainer = styled(Container)(({ theme }) => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    [theme.breakpoints.down("md")]: {
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      marginBottom: theme.spacing(4),
    },
  }));

  return (
    <Box sx={{ mt: 10 }}>
      <CustomContainer>
        <Box>
          <img src={logoImg} alt="logo" style={{ maxWidth: "100%" }} />
        </Box>
        <Typography
          variant="body2"
          sx={{
            color: "#7D8589",
            fontSize: "16px",
            fontWeight: "bold",
            mt: { md: 0, xs: 2 },
          }}
        >
          Blockchain-backed product verification on Ethereum
        </Typography>
      </CustomContainer>
    </Box>
  );
};

export default Companies;
