import React, { useState } from 'react';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import './shell.css';

export default function ScheduleTimelineCard({
  title = 'Schedule',
  days: initialDays = [
    { day: 'Mo', date: '15' },
    { day: 'Tu', date: '16' },
    { day: 'We', date: '17', active: true },
    { day: 'Th', date: '18' },
    { day: 'Fr', date: '19' },
    { day: 'Sa', date: '20' },
    { day: 'Su', date: '14' },
  ],
  events = [
    {
      title: 'Batch Dispatch to Logistics',
      time: '01:00 PM to 02:30 PM',
      color: 'green',
      description: 'Physical handover and carrier signing for outbound verified batch items.',
      avatars: ['https://i.pravatar.cc/100?img=1', 'https://i.pravatar.cc/100?img=2'],
    },
    {
      title: 'Chain Event Verification',
      time: '04:00 PM to 05:00 PM',
      color: 'blue',
      description: 'On-chain block confirmation and node receipt validation with smart contract state.',
      avatars: ['https://i.pravatar.cc/100?img=3', 'https://i.pravatar.cc/100?img=4'],
    },
    {
      title: 'Dock Delivery Reconciliation',
      time: '05:30 PM to 06:15 PM',
      color: 'orange',
      description: 'Inbound consignment optical scan verification and storage placement.',
      avatars: ['https://i.pravatar.cc/100?img=5'],
    },
  ],
}) {
  const [activeDayIdx, setActiveDayIdx] = useState(2);
  const [headerAnchorEl, setHeaderAnchorEl] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const handleHeaderMenuOpen = (e) => {
    e.stopPropagation();
    setHeaderAnchorEl(e.currentTarget);
  };

  const handleHeaderMenuClose = () => {
    setHeaderAnchorEl(null);
  };

  return (
    <div className="dashboard-card">
      {/* Header Bar */}
      <div className="card-header-bar">
        <div className="card-title-group">
          <CalendarTodayOutlinedIcon className="card-title-icon" />
          <h2 className="card-title-text">{title}</h2>
        </div>
        <button
          type="button"
          onClick={handleHeaderMenuOpen}
          aria-label="Schedule options"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            padding: '4px',
            borderRadius: '6px',
          }}
        >
          <MoreHorizRoundedIcon />
        </button>
        <Menu
          anchorEl={headerAnchorEl}
          open={Boolean(headerAnchorEl)}
          onClose={handleHeaderMenuClose}
          slotProps={{
            paper: {
              sx: { borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 160 },
            },
          }}
        >
          <MenuItem onClick={() => { setActiveDayIdx(2); handleHeaderMenuClose(); }}>
            Jump to Today
          </MenuItem>
          <MenuItem onClick={() => { handleHeaderMenuClose(); window.print?.(); }}>
            Print Schedule
          </MenuItem>
        </Menu>
      </div>

      {/* Week Day Ribbon with Working Click Selection */}
      <div className="schedule-days-ribbon" role="tablist" aria-label="Schedule Days">
        {initialDays.map((item, idx) => (
          <div
            key={idx}
            role="tab"
            aria-selected={activeDayIdx === idx}
            tabIndex={0}
            className={`schedule-day-item ${activeDayIdx === idx ? 'active' : ''}`}
            onClick={() => setActiveDayIdx(idx)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveDayIdx(idx); }}
            style={{ cursor: 'pointer' }}
          >
            <span>{item.day}</span>
            <span style={{ fontWeight: 700 }}>{item.date}</span>
          </div>
        ))}
      </div>

      {/* Timeline Events List with Interactive Event Details Dialog */}
      <div className="timeline-list">
        {events.map((ev, index) => (
          <div
            key={index}
            className={`timeline-event-card ${ev.color || 'blue'}`}
            onClick={() => setSelectedEvent(ev)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') setSelectedEvent(ev); }}
            style={{ cursor: 'pointer' }}
          >
            <div className="timeline-info">
              <span className="timeline-title">{ev.title}</span>
              <span className="timeline-time">{ev.time}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {ev.avatars && ev.avatars.length > 0 && (
                <div className="avatar-stack">
                  {ev.avatars.map((av, avIdx) => (
                    <img key={avIdx} src={av} alt="Participant" />
                  ))}
                </div>
              )}
              <MoreHorizRoundedIcon
                sx={{ fontSize: 18, color: 'var(--color-text-muted)', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEvent(ev);
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Event Detail Modal */}
      <Dialog
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '20px',
              padding: '8px',
              maxWidth: 420,
              width: '100%',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, pb: 1 }}>
          {selectedEvent?.title}
        </DialogTitle>
        <DialogContent>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor:
                  selectedEvent?.color === 'green'
                    ? '#16A34A'
                    : selectedEvent?.color === 'orange'
                    ? '#F59E0B'
                    : '#2F66EE',
              }}
            />
            <strong style={{ fontSize: '0.9rem', color: '#374151' }}>
              {selectedEvent?.time}
            </strong>
          </div>
          <p style={{ color: '#6B7280', fontSize: '0.925rem', lineHeight: 1.5, margin: 0 }}>
            {selectedEvent?.description || 'Active scheduled milestone in the SmartScan decentralized operational pipeline.'}
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setSelectedEvent(null)}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              color: '#374151',
            }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => setSelectedEvent(null)}
            sx={{
              borderRadius: '10px',
              backgroundColor: '#2F66EE',
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: 'none',
              '&:hover': { backgroundColor: '#1E4FD9', boxShadow: 'none' },
            }}
          >
            Acknowledge Milestone
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
