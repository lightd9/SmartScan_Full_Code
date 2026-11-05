import React from 'react';
import './shell.css';

export default function DashboardWorkflowCard({ icon, title, description, actionLabel, onAction }) {
  return (
    <article className="workflow-card">
      <div className="workflow-card-icon" aria-hidden="true">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <button type="button" className="btn-secondary-action" onClick={onAction}>
        {actionLabel}
      </button>
    </article>
  );
}
