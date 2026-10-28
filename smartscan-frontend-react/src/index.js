import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthProvider';
import { ScannerProvider } from './context/ScannerContext';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ScannerProvider>
        <Routes>
          <Route path='/*' element={<App />} />
        </Routes>
      </ScannerProvider>
    </AuthProvider>
  </BrowserRouter>
);
