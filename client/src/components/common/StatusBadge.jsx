import React from 'react';

/**
 * Renders an indicator pill showing server & database health status.
 * @param {{ health: { isOnline: boolean, status: string, database: { connected: boolean, message: string } } }} props
 */
export function StatusBadge({ health }) {
  if (!health) {
    return (
      <div className="status-badge status-loading">
        <span className="status-dot"></span>
        <span className="status-text">Checking status...</span>
      </div>
    );
  }

  if (!health.isOnline) {
    return (
      <div className="status-badge status-offline" title="Backend server not reachable on port 5000">
        <span className="status-dot"></span>
        <span className="status-text">Server Offline</span>
      </div>
    );
  }

  if (!health.database?.connected) {
    return (
      <div className="status-badge status-degraded" title="Data connection pending">
        <span className="status-dot"></span>
        <span className="status-text">Connecting...</span>
      </div>
    );
  }

  return (
    <div className="status-badge status-online" title="System connected and online">
      <span className="status-dot"></span>
      <span className="status-text">System Online</span>
    </div>
  );
}
