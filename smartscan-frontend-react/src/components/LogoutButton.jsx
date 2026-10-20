import { Box, Button } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const LogoutButton = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ position: 'absolute', top: 20, right: 20 }}>
      <Button onClick={handleLogout} endIcon={<LogoutIcon />}>Logout</Button>
    </Box>
  );
};

export default LogoutButton;
