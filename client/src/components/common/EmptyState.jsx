import React from 'react';

export function EmptyState({
  title = 'No Data Available',
  message = 'There are currently no records to display for this view.',
  icon = '📭',
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>
    </div>
  );
}
