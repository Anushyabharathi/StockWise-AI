import React from 'react';
import { formatNumber, formatCurrencyINR } from '../../utils/formatters';

/**
 * Compact Power BI visual alert strip.
 * Replaces bulky text-heavy warning cards with an efficient, high-impact alert bar.
 *
 * @param {{
 *   lowStock: Array,
 *   onNavigate: (tab: string, filter?: string) => void,
 *   onOpenAi: () => void
 * }} props
 */
export function BiVisualAlertsBar({ lowStock = [], onNavigate, onOpenAi }) {
  if (!lowStock || lowStock.length === 0) return null;

  const outOfStockCount = lowStock.filter((i) => i.currentStock === 0).length;
  const criticalCount = lowStock.filter((i) => i.stockStatus === 'CRITICAL' && i.currentStock > 0).length;
  const lowCount = lowStock.filter((i) => i.stockStatus === 'LOW').length;

  const totalDeficitUnits = lowStock.reduce((acc, i) => acc + (i.deficit || Math.max(0, (i.reorderLevel || 0) - (i.currentStock || 0))), 0);
  const totalRestockCost = lowStock.reduce(
    (acc, i) =>
      acc + (i.deficit || Math.max(0, (i.reorderLevel || 0) - (i.currentStock || 0))) * (i.costPrice || 0),
    0
  );

  return (
    <div className="bi-visual-alerts-bar">
      <div className="alert-bar-left">
        <span className="alert-pulse-icon">⚠️</span>
        <div className="alert-bar-text">
          <strong className="alert-bar-title">Warehouse Safety Alert:</strong>
          <span className="alert-bar-desc">
            {outOfStockCount > 0 && (
              <span className="alert-highlight danger">
                {outOfStockCount} Out-of-Stock
              </span>
            )}
            {criticalCount > 0 && (
              <span className="alert-highlight warning">
                {criticalCount} Critical Shortages
              </span>
            )}
            {lowCount > 0 && (
              <span className="alert-highlight info">
                {lowCount} Low Stock
              </span>
            )}
            <span className="alert-summary-metric">
              &bull; Total Deficit: <strong>+{formatNumber(totalDeficitUnits)} units</strong> ({formatCurrencyINR(totalRestockCost)} est. replenishment)
            </span>
          </span>
        </div>
      </div>

      <div className="alert-bar-actions">
        <button
          type="button"
          className="btn-alert-action"
          onClick={() => onNavigate('inventory', 'LOW')}
          title="Review replenishments in warehouse catalog"
        >
          Review Shortages &rarr;
        </button>
        <button
          type="button"
          className="btn-alert-ai"
          onClick={onOpenAi}
          title="Generate AI Restock Plan"
        >
          ✨ AI Restock Plan
        </button>
      </div>
    </div>
  );
}
