import { styled, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import React from "react";
import { Link } from "react-router-dom";
import homeIllustration from "../../img/illustration.png";
import CustomButton from "./CustomButton";

const GetStarted = () => {
  const CustomContainer = styled(Container)(({ theme }) => ({
    backgroundColor: "#17275F",
    height: "416px",
    borderRadius: "15px",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    [theme.breakpoints.down("md")]: {
      height: "auto",
      flexDirection: "column",
      alignItems: "center",
      padding: theme.spacing(3, 3, 0, 3),
      width: "90%",
    },
  }));

  const CustomBox = styled(Box)(({ theme }) => ({
    padding: theme.spacing(10, 0, 10, 0),
    margin: theme.spacing(0, 2, 0, 2),
    [theme.breakpoints.down("md")]: {
      padding: "0",
    },
  }));

  return (
    <CustomBox>
      <CustomContainer>
        <Box>
          <Typography
            sx={{ fontSize: "35px", color: "white", fontWeight: "700" }}
          >
            Protect Your Supply Chain
          </Typography>
          <Typography
            sx={{ fontSize: "16px", color: "#ccc", fontWeight: "500", my: 3 }}
          >
            Register products on-chain and let consumers verify authenticity in seconds.
          </Typography>

          <Link to="/login" style={{ textDecoration: "none" }}>
            <CustomButton
              backgroundColor="#fff"
              color="#17275F"
              buttonText="Get Started Now"
              getStartedBtn={true}
            />
          </Link>
        </Box>

        <img
          src={homeIllustration}
          alt="illustration"
          style={{ maxWidth: "100%" }}
        />
      </CustomContainer>
    </CustomBox>
  );
};

export default GetStarted;
