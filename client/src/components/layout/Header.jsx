import React, { useState, useEffect } from 'react';
import { DateRangePicker } from '../common/DateRangePicker';

export function Header({
  title,
  health: _health,
  admin,
  onOpenLogin,
  onOpenLogs: _onOpenLogs,
  onOpenAiAdvisor,
  onLogout,
  onRefresh,
  isRefreshing,
  lastUpdated,
  activeDatePreset,
  onChangeDateRange,
  onToggleSidebar,
}) {
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };
  return (
    <header className="app-header">
      <div className="header-top-row">
        <div className="header-left">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
          >
            ☰
          </button>
          <div className="header-titles">
            <h2 className="header-title">{title}</h2>
          </div>
        </div>

        <div className="header-right">
          {/* AI Advisor trigger button */}
          <button
            type="button"
            className="header-ai-advisor-btn"
            onClick={onOpenAiAdvisor}
            title="Open AI Executive Advisor & Business Copilot"
          >
            <span className="ai-sparkle-icon">✨</span>
            <span className="ai-btn-text">Ask AI Advisor</span>
          </button>

          {/* Admin Sign Out or Login Button */}
          {admin ? (
            <button
              type="button"
              className="header-action-btn btn-logout"
              onClick={onLogout}
              title="Sign out of Admin session"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              className="admin-login-btn"
              onClick={onOpenLogin}
              title="Sign in with your Shop Administrator account"
            >
              🔒 Admin Login
            </button>
          )}

          <button
            type="button"
            className="header-action-btn btn-fullscreen"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen mode' : 'Enter Fullscreen Power BI Canvas mode'}
          >
            {isFullscreen ? '⤢ Normal View' : '⛶ Fullscreen'}
          </button>

          <button
            type="button"
            className={`refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Fetch the newest sales and stock numbers from your database"
          >
            <span className="refresh-icon">🔄</span>
            <span className="refresh-text">{isRefreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <div className="header-bottom-row">
        <div className="header-date-filter">
          <span className="filter-label">Filter Period:</span>
          <DateRangePicker
            activePreset={activeDatePreset}
            onChangeRange={onChangeDateRange}
          />
        </div>

        {lastUpdated && (
          <div className="last-updated-text">
            <span>Last checked: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>
    </header>
  );
}
