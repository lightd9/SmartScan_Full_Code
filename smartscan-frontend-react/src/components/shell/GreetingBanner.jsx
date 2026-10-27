import React, { useState } from 'react';
import useAuth from '../../hooks/useAuth';
import './shell.css';

// Material Icons & Components
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

export default function GreetingBanner({
  title,
  subtitle,
  actions,
  metrics = [],
}) {
  const { auth } = useAuth();
  const [toastMessage, setToastMessage] = useState('');

  // Dynamic greeting based on current local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning!';
    if (hour < 17) return 'Good Afternoon!';
    return 'Good Evening!';
  };

  // Format today's date like "Thursday, 20th February"
  const getFormattedDate = () => {
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    const dayNum = today.getDate();
    const monthName = today.toLocaleDateString('en-US', { month: 'long' });

    // Suffix (st, nd, rd, th)
    const suffix =
      dayNum % 10 === 1 && dayNum !== 11
        ? 'st'
        : dayNum % 10 === 2 && dayNum !== 12
        ? 'nd'
        : dayNum % 10 === 3 && dayNum !== 13
        ? 'rd'
        : 'th';

    return `${dayName}, ${dayNum}${suffix} ${monthName}`;
  };

  const displayName = auth?.name || auth?.username || 'Partner';

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SmartScan Portal', url: window.location.href });
      } catch (_err) {
        // User cancelled or unsupported
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setToastMessage('Portal URL copied to clipboard!');
    }
  };

  return (
    <section className="greeting-section" aria-label="Overview Banner">
      <div className="greeting-header-row">
        <div>
          <div className="date-pretitle">{subtitle || getFormattedDate()}</div>
          <h1 className="greeting-headline">
            {title || `${getGreeting()} ${displayName},`}
          </h1>
        </div>

        {/* Action Buttons on Right */}
        <div className="greeting-actions">
          {actions ? (
            actions
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary-action"
                onClick={handleShare}
                aria-label="Share current view"
              >
                <ShareOutlinedIcon sx={{ fontSize: 16 }} />
                <span>Share</span>
              </button>

              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => window.location.reload()}
                aria-label="Refresh and sync data"
              >
                <SyncRoundedIcon sx={{ fontSize: 16 }} />
                <span>Refresh Sync</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metric Pill Strip with Working Click Targets */}
      {metrics && metrics.length > 0 && (
        <div className="metrics-pill-strip">
          {metrics.map((metric, idx) => (
            <div
              key={idx}
              className="metric-pill"
              onClick={metric.onClick}
              role={metric.onClick ? 'button' : undefined}
              tabIndex={metric.onClick ? 0 : undefined}
              onKeyDown={(e) => {
                if (metric.onClick && (e.key === 'Enter' || e.key === ' ')) metric.onClick();
              }}
              style={{
                cursor: metric.onClick ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
              }}
            >
              {metric.icon}
              <span>
                <strong>{metric.value}</strong> {metric.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Feedback Toast */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={2500}
        onClose={() => setToastMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ borderRadius: '12px', fontWeight: 600 }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </section>
  );
}
