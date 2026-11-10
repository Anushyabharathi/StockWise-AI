import React from 'react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '📊', hint: 'Business at a glance' },
  { id: 'sales', label: 'Sales Reports', icon: '🧾', hint: 'Order receipts & CSV export' },
  { id: 'analytics', label: 'Analytics', icon: '📈', hint: 'Velocity, categories & patterns' },
  { id: 'products', label: 'Products', icon: '📦', hint: 'Best-sellers & unit margins' },
  { id: 'inventory', label: 'Inventory', icon: '🏭', hint: 'Full catalogue & reorders' },
  { id: 'reports', label: 'Financials', icon: '📋', hint: 'Profit, COGS & statements' },
];

export function Sidebar({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
  lowStockCount = 0,
  admin,
  onOpenLogs,
}) {
  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">
            <span className="brand-icon">📈</span>
          </div>
          <div className="brand-info">
            <h1 className="brand-title">StockWise AI</h1>
            <span className="brand-badge">Retail Intelligence</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">NAVIGATION</div>
          {NAV_ITEMS.map((item) => {
            const isActive = currentTab === item.id;
            const hasAlert = item.id === 'inventory' && lowStockCount > 0;

            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onClose) onClose();
                }}
                title={item.hint}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label-group">
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-hint">{item.hint}</span>
                </span>
                {hasAlert && <span className="nav-alert-tag">{lowStockCount}</span>}
                {isActive && <span className="nav-active-pill" />}
              </button>
            );
          })}

          {/* Audit Logs navigation item */}
          <div className="nav-section-title" style={{ marginTop: '14px' }}>SECURITY & AUDIT</div>
          <button
            type="button"
            className="nav-item nav-item-audit"
            onClick={() => {
              onOpenLogs();
              if (onClose) onClose();
            }}
            title="View database activity logs and admin audit trail"
          >
            <span className="nav-icon">📜</span>
            <span className="nav-label-group">
              <span className="nav-label">Activity Logs</span>
              <span className="nav-hint">Database audit trail</span>
            </span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="system-pill">
            <span className="system-dot"></span>
            <span className="system-text">
              {admin ? `Admin: ${admin.username}` : 'Public Storefront Mode'}
            </span>
          </div>
          <p className="system-version">System Active &bull; Activity Logged</p>
        </div>
      </aside>
    </>
  );
}
