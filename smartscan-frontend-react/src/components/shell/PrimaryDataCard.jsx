import React, { useState } from 'react';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import ModeEditOutlineOutlinedIcon from '@mui/icons-material/ModeEditOutlineOutlined';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import './shell.css';

export default function PrimaryDataCard({
  title = 'My Projects',
  titleIcon = <FormatListBulletedRoundedIcon className="card-title-icon" />,
  filterLabel: defaultFilterLabel = 'All Items',
  filterOptions = ['All Items', 'Confirmed', 'Pending', 'In Custody'],
  onFilterSelect,
  onSeeAllClick,
  columns = [
    { label: 'Item Name', icon: <ModeEditOutlineOutlinedIcon sx={{ fontSize: 16 }} /> },
    { label: 'Assignee / Partner', icon: <PeopleOutlineOutlinedIcon sx={{ fontSize: 16 }} /> },
    { label: 'Status', icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} /> },
  ],
  rows = [],
  emptyMessage = 'No records found in this view.',
}) {
  const [currentFilter, setCurrentFilter] = useState(defaultFilterLabel);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);

  const handleFilterClick = (e) => {
    setFilterMenuAnchor(e.currentTarget);
  };

  const handleFilterOptionChoose = (option) => {
    setCurrentFilter(option);
    setFilterMenuAnchor(null);
    if (onFilterSelect) {
      onFilterSelect(option);
    }
  };

  // Internal filtering if onFilterSelect is not overriding
  const displayedRows = rows.filter((r) => {
    if (!currentFilter || currentFilter === 'All Items' || currentFilter === 'All Partners' || currentFilter === 'This Week' || currentFilter === 'Recent Batches' || currentFilter === 'In Transit' || currentFilter === 'Available Stock') {
      return true;
    }
    const label = (r.statusLabel || '').toLowerCase();
    const filter = currentFilter.toLowerCase();
    return label.includes(filter) || filter.includes(label);
  });

  return (
    <div className="dashboard-card" style={{ width: '100%' }}>
      {/* Card Header Bar */}
      <div className="card-header-bar">
        <div className="card-title-group">
          {titleIcon}
          <h2 className="card-title-text">{title}</h2>
          {defaultFilterLabel && (
            <>
              <button
                type="button"
                className="card-filter-pill"
                onClick={handleFilterClick}
                aria-haspopup="true"
                aria-expanded={Boolean(filterMenuAnchor)}
              >
                <span>{currentFilter}</span>
                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16 }} />
              </button>

              <Menu
                anchorEl={filterMenuAnchor}
                open={Boolean(filterMenuAnchor)}
                onClose={() => setFilterMenuAnchor(null)}
                slotProps={{
                  paper: {
                    sx: { borderRadius: '12px', minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' },
                  },
                }}
              >
                {filterOptions.map((opt) => (
                  <MenuItem
                    key={opt}
                    selected={opt === currentFilter}
                    onClick={() => handleFilterOptionChoose(opt)}
                    sx={{ fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    {opt}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
        </div>

        {onSeeAllClick && (
          <button
            type="button"
            className="card-header-action-link"
            onClick={onSeeAllClick}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            See All
          </button>
        )}
      </div>

      {/* Table Content */}
      <div style={{ overflowX: 'auto' }}>
        <table className="template-table">
          <thead>
            <tr>
              {columns.map((col, index) => (
                <th key={index}>
                  <div className="th-content">
                    {col.icon}
                    <span>{col.label}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayedRows.map((row, index) => (
                <tr
                  key={row.id || index}
                  onClick={row.onClick}
                  style={{
                    cursor: row.onClick ? 'pointer' : 'default',
                    transition: 'background-color 0.15s ease',
                  }}
                  tabIndex={row.onClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (row.onClick && (e.key === 'Enter' || e.key === ' ')) {
                      row.onClick();
                    }
                  }}
                >
                  {/* Item / Task Name Column */}
                  <td>
                    <div className="row-item-cell">
                      {row.icon}
                      <span className="row-item-title">{row.title}</span>

                      {/* Meta counters (Comments, Links) */}
                      {(row.commentCount !== undefined || row.linkCount !== undefined) && (
                        <div className="row-meta-indicators">
                          {row.commentCount !== undefined && (
                            <span className="meta-count-item" title="Scans / Interactions">
                              <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />
                              {row.commentCount}
                            </span>
                          )}
                          {row.linkCount !== undefined && (
                            <span className="meta-count-item" title="Chain Hops">
                              <LinkRoundedIcon sx={{ fontSize: 14 }} />
                              {row.linkCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Assignee / Partner Column */}
                  <td>
                    <div className="user-assignee-cell">
                      {row.assigneeAvatar ? (
                        <img
                          src={row.assigneeAvatar}
                          alt={row.assigneeName || 'User'}
                          className="assignee-avatar"
                        />
                      ) : (
                        <div
                          className="assignee-avatar"
                          style={{
                            background: '#EBF1FE',
                            color: '#2F66EE',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {(row.assigneeName || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{row.assigneeName || 'Unassigned'}</span>
                    </div>
                  </td>

                  {/* Status Column with Colored Pill */}
                  <td>
                    <span className={`status-pill ${row.statusColor || 'blue'}`}>
                      {row.statusLabel}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
