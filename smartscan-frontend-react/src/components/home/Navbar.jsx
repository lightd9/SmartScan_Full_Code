import * as React from "react";
import Box from "@mui/material/Box";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import LoginIcon from "@mui/icons-material/Login";
import logoImg from "../../img/logo.png";
import { Container } from "@mui/system";
import CustomButton from "./CustomButton";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  styled,
} from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useScanner } from "../../context/ScannerContext";

const navLinks = [
  { text: "Home", to: "/", icon: <HomeIcon /> },
  { text: "Verify Product", to: "/scanner", icon: <QrCodeScannerIcon /> },
  { text: "Login", to: "/login", icon: <LoginIcon /> },
];

export const Navbar = () => {
  const { openScanner } = useScanner();
  const [mobileMenu, setMobileMenu] = useState({
    left: false,
  });

  const toggleDrawer = (anchor, open) => (event) => {
    if (
      event.type === "keydown" &&
      (event.key === "Tab" || event.key === "Shift")
    ) {
      return;
    }

    setMobileMenu({ ...mobileMenu, [anchor]: open });
  };

  const list = (anchor) => (
    <Box
      sx={{ width: 250 }}
      role="presentation"
      onClick={toggleDrawer(anchor, false)}
      onKeyDown={toggleDrawer(anchor, false)}
    >
      <List>
        {navLinks.map((link) => (
          <ListItem
            key={link.text}
            disablePadding
            component={link.to === '/scanner' ? 'button' : Link}
            to={link.to === '/scanner' ? undefined : link.to}
            onClick={link.to === '/scanner' ? () => openScanner() : undefined}
            sx={{ color: "inherit", border: 'none', background: 'transparent', textAlign: 'left', width: '100%' }}
          >
            <ListItemButton>
              <ListItemIcon>{link.icon}</ListItemIcon>
              <ListItemText primary={link.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const CustomMenuIcon = styled(MenuIcon)(({ theme }) => ({
    cursor: "pointer",
    display: "none",
    marginRight: theme.spacing(2),
    [theme.breakpoints.down("md")]: {
      display: "block",
    },
  }));

  const NavbarContainer = styled(Container)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(5),
    [theme.breakpoints.down("md")]: {
      padding: theme.spacing(2),
    },
  }));

  const NavbarLogo = styled("img")(({ theme }) => ({
    cursor: "pointer",
    [theme.breakpoints.down("md")]: {
      display: "none",
    },
  }));

  return (
    <NavbarContainer>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "2.5rem",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <CustomMenuIcon onClick={toggleDrawer("left", true)} />
          <Drawer
            anchor="left"
            open={mobileMenu["left"]}
            onClose={toggleDrawer("left", false)}
          >
            {list("left")}
          </Drawer>
          <Link to="/">
            <NavbarLogo src={logoImg} alt="SmartScan" />
          </Link>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
        }}
      >
        <button
          type="button"
          onClick={() => openScanner()}
          className="btn-scan-action"
          style={{ cursor: 'pointer', padding: '9px 18px', borderRadius: '8px' }}
        >
          <QrCodeScannerIcon sx={{ fontSize: 18, color: 'var(--color-primary, #2F66EE)' }} />
          <span>Verify Product</span>
        </button>
        <Link to="/login" style={{ textDecoration: 'none' }}>
          <CustomButton
            backgroundColor="#0F1B4C"
            color="#fff"
            buttonText="Login"
          />
        </Link>
      </Box>
    </NavbarContainer>
  );
};

export default Navbar;
