import { Button } from "@mui/material";
import React from "react";

const CustomButton = ({
  backgroundColor = "#2563EB",
  color = "#FFFFFF",
  buttonText,
  heroBtn,
  guideBtn,
  getStartedBtn,
  sx = {},
  ...props
}) => {
  return (
    <Button
      sx={{
        backgroundColor,
        color,
        fontWeight: "700",
        fontSize: "14px",
        cursor: "pointer",
        padding: "0.5rem 1.25rem",
        borderRadius: "10px",
        textTransform: "none",
        display: "block",
        border: "2px solid transparent",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        "&:hover": {
          backgroundColor: color,
          color: backgroundColor,
          borderColor: backgroundColor,
        },
        "@media (max-width: 900px)": {
          margin: (heroBtn || getStartedBtn) ? "0 auto 24px auto" : undefined,
          width: (heroBtn || getStartedBtn) ? "90%" : undefined,
        },
        "@media (max-width: 600px)": {
          marginTop: guideBtn ? "24px" : undefined,
          width: guideBtn ? "90%" : undefined,
        },
        ...sx,
      }}
      {...props}
    >
      {buttonText}
    </Button>
  );
};

export default CustomButton;
