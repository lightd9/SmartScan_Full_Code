import { Box, Paper, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Missing = () => {
    const navigate = useNavigate();

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', marginTop: '10%' }}>
            <Paper elevation={3} sx={{ padding: '3%', textAlign: 'center', backgroundColor: '#e3eefc' }}>
                <Typography variant="h4" sx={{ marginBottom: '5%' }}>Page Not Found</Typography>
                <Typography variant="body1" sx={{ marginBottom: '5%' }}>
                    The page you are looking for does not exist.
                </Typography>
                <Button variant="contained" onClick={() => navigate('/')}>Back to Home</Button>
            </Paper>
        </Box>
    );
};

export default Missing;
