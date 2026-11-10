import React from 'react';

const BI_NAV_ITEMS = [
  { id: 'overview', label: 'Executive Overview', icon: '📊', hint: 'Store health & KPIs' },
  { id: 'ai', label: 'AI Advisor', icon: '✨', hint: 'Executive briefings & chat' },
  { id: 'sales', label: 'Sales & Trends BI', icon: '📈', hint: 'Velocity, curves & reports' },
  { id: 'products', label: 'Product Intelligence', icon: '📦', hint: 'Best-sellers & unit margins' },
  { id: 'inventory', label: 'Warehouse & Inventory', icon: '🏭', hint: 'Full catalogue & deficits' },
  { id: 'reports', label: 'Financial Statements', icon: '💰', hint: 'Revenue, COGS & profit' },
  { id: 'api-usage', label: 'API Usage', icon: '⚡', hint: 'Claude token telemetry & budget' },
];

/**
 * Power BI & Tableau inspired collapsible navigation sidebar.
 *
 * @param {{
 *   currentTab: string,
 *   onSelectTab: (tab: string) => void,
 *   isCollapsed: boolean,
 *   onToggleCollapse: () => void,
 *   isOpenMobile: boolean,
 *   onCloseMobile: () => void,
 *   lowStockCount?: number,
 *   admin?: Object|null
 * }} props
 */
export function BiSidebar({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isOpenMobile,
  onCloseMobile,
  lowStockCount = 0,
}) {
  return (
    <>
      {isOpenMobile && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside
        className={`app-sidebar bi-sidebar ${isCollapsed ? 'bi-sidebar-collapsed' : ''} ${
          isOpenMobile ? 'sidebar-open' : ''
        }`}
        aria-label="BI Navigation Sidebar"
      >
        {/* Brand & Collapse Toggle */}
        <div className="bi-sidebar-header">
          <div className="bi-brand-wrapper">
            <div className="brand-logo">
              <span className="brand-icon">📈</span>
            </div>
            {!isCollapsed && (
              <div className="brand-info">
                <h1 className="brand-title">StockWise BI</h1>
                <span className="brand-badge">Enterprise Edition</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="bi-collapse-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand navigation (Power BI view)' : 'Collapse navigation to rail'}
            aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {isCollapsed ? '⇥' : '⇤'}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav bi-nav">
          {!isCollapsed && <div className="nav-section-title">ANALYTICS & REPORTS</div>}
          {BI_NAV_ITEMS.map((item) => {
            const isActive = currentTab === item.id;
            const hasAlert = item.id === 'inventory' && lowStockCount > 0;

            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item bi-nav-item ${isActive ? 'nav-item-active' : ''} ${
                  isCollapsed ? 'bi-nav-item-collapsed' : ''
                }`}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                title={isCollapsed ? `${item.label} — ${item.hint}` : item.hint}
              >
                <span className="nav-icon">{item.icon}</span>

                {!isCollapsed && (
                  <span className="nav-label-group">
                    <span className="nav-label">{item.label}</span>
                  </span>
                )}

                {hasAlert && (
                  <span className={`nav-alert-tag ${isCollapsed ? 'nav-alert-collapsed' : ''}`}>
                    {lowStockCount}
                  </span>
                )}

                {isActive && <span className="nav-active-pill" />}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
