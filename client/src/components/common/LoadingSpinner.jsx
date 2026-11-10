import React from 'react';

export function LoadingSpinner({ message = 'Loading analytics data...' }) {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-message">{message}</p>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-line skeleton-title"></div>
      <div className="skeleton-line skeleton-value"></div>
      <div className="skeleton-line skeleton-sub"></div>
    </div>
  );
}
