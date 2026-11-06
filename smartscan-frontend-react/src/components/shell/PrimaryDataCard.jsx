import React, { useState } from 'react';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import ModeEditOutlineOutlinedIcon from '@mui/icons-material/ModeEditOutlineOutlined';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import './shell.css';

export default function PrimaryDataCard({
  title = 'My Projects',
  titleIcon = <FormatListBulletedRoundedIcon className="card-title-icon" />,
  filterLabel: defaultFilterLabel = 'All Items',
  filterOptions = [],
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

  const displayedRows = filterOptions.length && currentFilter && currentFilter !== 'All Items'
    ? rows.filter((row) => row.statusLabel === currentFilter)
    : rows;

  return (
    <div className="dashboard-card" style={{ width: '100%' }}>
      {/* Card Header Bar */}
      <div className="card-header-bar">
        <div className="card-title-group">
          {titleIcon}
          <h2 className="card-title-text">{title}</h2>
          {filterOptions.length > 0 && (
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
                    sx: { borderRadius: '12px', minWidth: 160, boxShadow: '0 8px 24px rgba(15,23,42,0.1)' },
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
          >
            See All
          </button>
        )}
      </div>

      {/* Table Content */}
      <div style={{ maxHeight: 520, overflow: 'auto' }}>
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
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--color-text-muted)' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayedRows.map((row, index) => (
                <tr
                  key={row.id || index}
                  role={row.onClick ? 'button' : undefined}
                  tabIndex={row.onClick ? 0 : undefined}
                  onClick={row.onClick}
                  onKeyDown={(e) => {
                    if (row.onClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      row.onClick();
                    }
                  }}
                >
                  {/* Item / Task Name Column */}
                  <td>
                    <div className="row-item-cell">
                      {row.icon}
                      <span className="row-item-title">{row.title}</span>
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
                            background: 'var(--color-primary-subtle)',
                            color: 'var(--color-primary)',
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
