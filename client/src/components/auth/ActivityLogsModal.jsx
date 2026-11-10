import React, { useState, useEffect, useCallback } from 'react';
import { getActivityLogs } from '../../api/client';
import { formatDateTime, formatNumber } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

/**
 * Modal displaying database activity and security audit trail.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void
 * }} props
 */
export function ActivityLogsModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalRecords: 0, totalPages: 1 });
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getActivityLogs({
        page: pagination.page,
        limit: pagination.limit,
        action: actionFilter || null,
      });

      setLogs(res.data || []);
      if (res.pagination) {
        setPagination((prev) => ({
          ...prev,
          totalRecords: res.pagination.totalRecords || 0,
          totalPages: res.pagination.totalPages || 1,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, actionFilter]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  if (!isOpen) return null;

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const getActionBadge = (action) => {
    if (action === 'AUTH_LOGIN_SUCCESS') {
      return (
        <span className="log-action-badge log-action-login">
          🔑 Login Success
        </span>
      );
    }
    if (action === 'AUTH_LOGIN_FAILED') {
      return (
        <span className="log-action-badge log-action-fail">
          🚫 Login Failed
        </span>
      );
    }
    if (action === 'AUTH_LOGOUT') {
      return (
        <span className="log-action-badge log-action-logout">
          🚪 Signed Out
        </span>
      );
    }
    if (action === 'SALES_CSV_EXPORT') {
      return (
        <span className="log-action-badge log-action-export">
          📥 Exported CSV Report
        </span>
      );
    }
    if (action === 'SYSTEM_ADMIN_SEEDED') {
      return (
        <span className="log-action-badge log-action-system">
          ⚙️ Setup Seed
        </span>
      );
    }

    return (
      <span className="log-action-badge log-action-default">
        {action}
      </span>
    );
  };

  const startRecord = pagination.totalRecords === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endRecord = Math.min(pagination.page * pagination.limit, pagination.totalRecords);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container activity-logs-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-logs-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">DATABASE AUDIT TRAIL</span>
            <h2 id="activity-logs-title" className="modal-title">
              Shop Admin Activity Logs
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close activity logs"
          >
            &times;
          </button>
        </div>

        {/* Filter bar */}
        <div className="logs-filter-bar">
          <div className="select-group">
            <label htmlFor="log-action-filter" className="select-label">Event Type:</label>
            <select
              id="log-action-filter"
              className="filter-select"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <option value="">All Events</option>
              <option value="AUTH_LOGIN_SUCCESS">Login Success</option>
              <option value="AUTH_LOGIN_FAILED">Login Failed</option>
              <option value="AUTH_LOGOUT">Logout</option>
              <option value="SALES_CSV_EXPORT">CSV Export</option>
              <option value="SYSTEM_ADMIN_SEEDED">System Setup</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchLogs}
            disabled={isLoading}
          >
            🔄 Refresh Logs
          </button>
        </div>

        <div className="modal-body">
          {isLoading ? (
            <LoadingSpinner message="Querying database activity records..." />
          ) : logs.length === 0 ? (
            <EmptyState
              title="No Activity Logs Found"
              message="No security or admin events match this filter."
              icon="📜"
            />
          ) : (
            <div className="table-responsive">
              <table className="inventory-table logs-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>User / Administrator</th>
                    <th>Status</th>
                    <th>IP Address</th>
                    <th>Event Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const detailStr = log.details && Object.keys(log.details).length > 0
                      ? JSON.stringify(log.details)
                      : '—';

                    return (
                      <tr key={log.logId}>
                        <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td>{getActionBadge(log.action, log.status)}</td>
                        <td>
                          <strong>{log.fullName}</strong>
                          <span className="text-muted" style={{ display: 'block', fontSize: '11px' }}>
                            @{log.username} ({log.role})
                          </span>
                        </td>
                        <td>
                          {log.status === 'SUCCESS' ? (
                            <span className="status-pill status-pill-healthy">
                              <span className="pill-dot"></span> Success
                            </span>
                          ) : (
                            <span className="status-pill status-pill-danger">
                              <span className="pill-dot"></span> Failed
                            </span>
                          )}
                        </td>
                        <td className="text-muted" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                          {log.ipAddress || '127.0.0.1'}
                        </td>
                        <td className="log-details-cell">
                          <code className="log-details-code" title={detailStr}>
                            {detailStr}
                          </code>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination footer */}
        <div className="modal-footer table-pagination-row">
          <div className="pagination-info">
            Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of{' '}
            <strong>{formatNumber(pagination.totalRecords)}</strong> audit events
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="btn-page"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
            >
              &larr; Prev
            </button>
            <span className="page-current">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              className="btn-page"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
