import React from 'react';
import { createRoot } from 'react-dom/client';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthProvider';
import { ScannerProvider } from './context/ScannerContext';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const defaultTheme = createTheme();

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ThemeProvider theme={defaultTheme}>
      <AuthProvider>
        <ScannerProvider>
          <Routes>
            <Route path='/*' element={<App />} />
          </Routes>
        </ScannerProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);
