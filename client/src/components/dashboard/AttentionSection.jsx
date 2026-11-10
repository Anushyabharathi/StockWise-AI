import React from 'react';

/**
 * Highly visible "Needs Your Attention" alert center for store owners.
 * Prioritizes urgent stock shortages and provides clear, 1-click actions.
 *
 * @param {{
 *   lowStock: Array,
 *   health: Object,
 *   onNavigateTab: (tab: string, filter?: string) => void
 * }} props
 */
export function AttentionSection({ lowStock = [], health, onNavigateTab }) {
  // Analyze inventory conditions from actual data
  const outOfStockItems = lowStock.filter((item) => item.currentStock === 0);
  const criticalItems = lowStock.filter(
    (item) => item.currentStock > 0 && item.stockStatus === 'CRITICAL'
  );
  const lowWarningItems = lowStock.filter(
    (item) => item.currentStock > 0 && item.stockStatus !== 'CRITICAL'
  );

  const hasDbIssue = health && !health.database?.connected;
  const totalIssues = outOfStockItems.length + criticalItems.length + lowWarningItems.length;

  // Calm positive state if no issues exist
  if (totalIssues === 0 && !hasDbIssue) {
    return (
      <div className="attention-section attention-healthy">
        <div className="attention-header">
          <div className="attention-title-group">
            <span className="attention-icon">✅</span>
            <div>
              <h3 className="attention-title">Everything Looks Healthy</h3>
              <p className="attention-subtitle">
                All inventory items are currently above their minimum reorder thresholds. No urgent actions needed.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="action-link-btn"
            onClick={() => onNavigateTab('inventory')}
          >
            Check Inventory Status &rarr;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="attention-section">
      <div className="attention-header">
        <div className="attention-title-group">
          <span className="attention-badge-pulse">⚠️ Needs Your Attention</span>
          <p className="attention-subtitle">
            {totalIssues} {totalIssues === 1 ? 'item requires' : 'items require'} action to keep your store operating smoothly.
          </p>
        </div>
      </div>

      <div className="attention-cards-grid">
        {/* Urgent: Out of Stock */}
        {outOfStockItems.length > 0 && (
          <div className="alert-card alert-urgent">
            <div className="alert-top">
              <span className="alert-pill alert-pill-urgent">URGENT</span>
              <span className="alert-count">{outOfStockItems.length} Products</span>
            </div>
            <h4 className="alert-heading">Completely Out of Stock</h4>
            <p className="alert-problem">
              {outOfStockItems.length === 1 ? (
                <>
                  <strong>{outOfStockItems[0].productName}</strong> has 0 units available.
                </>
              ) : (
                <>
                  <strong>{outOfStockItems[0].productName}</strong> and {outOfStockItems.length - 1} other products are empty.
                </>
              )}
            </p>
            <p className="alert-impact">
              💡 <strong>Why this matters:</strong> Customers cannot buy these items. You may be losing direct daily sales until restocked.
            </p>
            <button
              type="button"
              className="alert-action-btn btn-urgent"
              onClick={() => onNavigateTab('inventory', 'OUT_OF_STOCK')}
            >
              Restock Out-of-Stock Items &rarr;
            </button>
          </div>
        )}

        {/* Warning: Critical Stock (<= 50% reorder level) */}
        {criticalItems.length > 0 && (
          <div className="alert-card alert-warning">
            <div className="alert-top">
              <span className="alert-pill alert-pill-warning">RUNNING LOW</span>
              <span className="alert-count">{criticalItems.length} Products</span>
            </div>
            <h4 className="alert-heading">Critically Low Stock</h4>
            <p className="alert-problem">
              {criticalItems.length === 1 ? (
                <>
                  <strong>{criticalItems[0].productName}</strong> has only {criticalItems[0].currentStock} units left (safety level: {criticalItems[0].reorderLevel}).
                </>
              ) : (
                <>
                  {criticalItems.length} products are at less than half of their safety reorder level.
                </>
              )}
            </p>
            <p className="alert-impact">
              💡 <strong>Why this matters:</strong> At current sales velocity, these products may run out before your next supplier delivery.
            </p>
            <button
              type="button"
              className="alert-action-btn btn-warning"
              onClick={() => onNavigateTab('inventory', 'CRITICAL')}
            >
              Order Low-Stock Items &rarr;
            </button>
          </div>
        )}

        {/* Caution: Items below reorder level */}
        {lowWarningItems.length > 0 && (
          <div className="alert-card alert-caution">
            <div className="alert-top">
              <span className="alert-pill alert-pill-caution">REORDER ALERT</span>
              <span className="alert-count">{lowWarningItems.length} Products</span>
            </div>
            <h4 className="alert-heading">Approaching Reorder Level</h4>
            <p className="alert-problem">
              {lowWarningItems.length} products have reached their standard reorder threshold.
            </p>
            <p className="alert-impact">
              💡 <strong>Why this matters:</strong> Ordering early prevents shipping delays and keeps your best-selling shelves full.
            </p>
            <button
              type="button"
              className="alert-action-btn btn-caution"
              onClick={() => onNavigateTab('inventory', 'LOW')}
            >
              Review Reorder List &rarr;
            </button>
          </div>
        )}

        {/* System Alert: Database Configuration */}
        {hasDbIssue && (
          <div className="alert-card alert-system">
            <div className="alert-top">
              <span className="alert-pill alert-pill-system">SETUP NOTICE</span>
            </div>
            <h4 className="alert-heading">Database Not Fully Connected</h4>
            <p className="alert-problem">
              {health.database?.message || 'Database connection credentials incomplete.'}
            </p>
            <p className="alert-impact">
              💡 <strong>Why this matters:</strong> Live data requires PostgreSQL credentials in <code>server/.env</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
