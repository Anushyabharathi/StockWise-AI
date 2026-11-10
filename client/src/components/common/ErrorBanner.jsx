import React from 'react';

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;

  const isDbUnconfigured =
    error.code === 'DATABASE_UNCONFIGURED' ||
    (typeof error.message === 'string' && error.message.includes('Missing environment variable'));

  const isServerOffline =
    error.code === 'SERVER_OFFLINE' ||
    (typeof error.message === 'string' && error.message.includes('server is unreachable'));

  return (
    <div className={`error-banner ${isDbUnconfigured ? 'banner-warning' : 'banner-danger'}`}>
      <div className="banner-icon">
        {isDbUnconfigured ? '⚠️' : isServerOffline ? '🔌' : '❌'}
      </div>
      <div className="banner-content">
        <h4 className="banner-title">
          {isDbUnconfigured
            ? 'Database Credentials Incomplete'
            : isServerOffline
            ? 'Backend Server Unreachable'
            : 'Error Loading Dashboard Data'}
        </h4>
        <p className="banner-text">
          {isDbUnconfigured
            ? 'The backend is online, but connection variables are not yet configured in server/.env. Once configured, data will load automatically.'
            : isServerOffline
            ? 'Unable to communicate with the Express API at http://localhost:5000/api. Run "npm run dev" inside the server directory to start it.'
            : error.message || 'An unexpected error occurred while communicating with the backend.'}
        </p>
      </div>
      {onRetry && (
        <button type="button" className="banner-retry-btn" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
