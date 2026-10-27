import React from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import './shell.css';

export default function DashboardShell({ children, onSearch }) {
  return (
    <div className="app-layout">
      {/* Pinned Left Sidebar */}
      <Sidebar />

      {/* Main Canvas Area */}
      <div className="app-main">
        <TopHeader onSearch={onSearch} />
        <main className="canvas-body" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
