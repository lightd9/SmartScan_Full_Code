import React, { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import './shell.css';

export default function DashboardShell({ children, onSearch }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const navigationRef = useRef(null);
  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') closeMobileNav();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    navigationRef.current?.querySelector('a, button')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileNavOpen, closeMobileNav]);

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {mobileNavOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={closeMobileNav}
        />
      )}
      <Sidebar isOpen={mobileNavOpen} onClose={closeMobileNav} navigationRef={navigationRef} />

      <div className="app-main">
        <TopHeader
          onSearch={onSearch}
          mobileNavOpen={mobileNavOpen}
          menuButtonRef={menuButtonRef}
          onMenuClick={() => setMobileNavOpen((open) => !open)}
        />
        <main className="canvas-body" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
