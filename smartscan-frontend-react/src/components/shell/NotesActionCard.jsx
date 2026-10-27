import React, { useState } from 'react';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import './shell.css';

export default function NotesActionCard({
  title = 'Notes',
  items: initialItems = [
    {
      id: 1,
      title: 'Batch Packaging Verification',
      description: 'Review high-resolution QR rendering and confirm on-chain contract address matching before label printing.',
      completed: false,
    },
    {
      id: 2,
      title: 'Physical Location Cross-Check',
      description: 'Verify warehouse GPS coordinates against registered corporate business profiles to prevent geofence anomalies.',
      completed: false,
    },
    {
      id: 3,
      title: 'Custody Handover Protocols',
      description: 'Require receiving carrier to provide cryptographically linked wallet address prior to physical departure.',
      completed: true,
    },
  ],
}) {
  const [items, setItems] = useState(initialItems);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const toggleItem = (id) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newItem = {
      id: Date.now(),
      title: newTitle.trim(),
      description: newDesc.trim() || 'Custom checklist task recorded by operator.',
      completed: false,
    };
    setItems((prev) => [newItem, ...prev]);
    setNewTitle('');
    setNewDesc('');
    setIsAddOpen(false);
  };

  const clearCompleted = () => {
    setItems((prev) => prev.filter((item) => !item.completed));
  };

  const hasCompleted = items.some((item) => item.completed);

  return (
    <div className="dashboard-card">
      {/* Header Bar with Working Add and Clear Actions */}
      <div className="card-header-bar">
        <div className="card-title-group">
          <ArticleOutlinedIcon className="card-title-icon" />
          <h2 className="card-title-text">{title}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasCompleted && (
            <button
              type="button"
              onClick={clearCompleted}
              title="Clear finished tasks"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#9CA3AF',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '6px',
              }}
            >
              <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="Add new note or task"
            style={{
              background: '#F3F4F6',
              border: 'none',
              cursor: 'pointer',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            <AddRoundedIcon sx={{ fontSize: 16 }} />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Notes / Action Items List */}
      <div className="notes-list">
        {items.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            All tasks completed. Click "+ Add Task" to record a new milestone.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="note-item"
              onClick={() => toggleItem(item.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleItem(item.id); }}
              style={{ cursor: 'pointer' }}
            >
              {/* Interactive Check Circle */}
              <div
                className={`note-check-circle ${item.completed ? 'checked' : ''}`}
                role="checkbox"
                aria-checked={item.completed}
                tabIndex={-1}
              >
                {item.completed && <CheckRoundedIcon sx={{ fontSize: 13 }} />}
              </div>

              {/* Note Content */}
              <div className="note-content">
                <span
                  className="note-title"
                  style={{
                    textDecoration: item.completed ? 'line-through' : 'none',
                    color: item.completed ? 'var(--color-text-muted)' : 'var(--color-text-main)',
                  }}
                >
                  {item.title}
                </span>
                <p className="note-description">{item.description}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Task Modal Dialog */}
      <Dialog
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '20px',
              padding: '12px',
              maxWidth: 440,
              width: '100%',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800 }}>
          Create Operational Task
        </DialogTitle>
        <form onSubmit={handleAddTask}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              autoFocus
              label="Task Title"
              size="small"
              fullWidth
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Verify pallet security seal"
            />
            <TextField
              label="Description (Optional)"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Operational instructions or requirements..."
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setIsAddOpen(false)}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, color: '#6B7280' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{
                borderRadius: '10px',
                backgroundColor: '#2F66EE',
                textTransform: 'none',
                fontWeight: 700,
                boxShadow: 'none',
                '&:hover': { backgroundColor: '#1E4FD9', boxShadow: 'none' },
              }}
            >
              Add Checklist Item
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}
