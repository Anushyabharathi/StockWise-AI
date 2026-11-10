import React from 'react';
import { formatCurrencyINR, formatNumber, formatPercent } from '../../utils/formatters';

/**
 * Power BI / Tableau style Product Unit Economics Drill-Down Modal.
 *
 * @param {{
 *   product: Object|null,
 *   onClose: () => void,
 *   onAskAi?: (question: string) => void
 * }} props
 */
export function BiProductDetailModal({ product, onClose, onAskAi }) {
  if (!product) return null;

  const cost = product.costPrice || 0;
  const sell = product.sellingPrice || 0;
  const unitProfit = Math.max(0, sell - cost);
  const unitMargin = sell > 0 ? (unitProfit / sell) * 100 : 0;
  const totalRev = product.totalRevenue || (product.unitsSold || 0) * sell;
  const totalProfit = product.totalProfit || (product.unitsSold || 0) * unitProfit;
  const units = product.unitsSold || 0;
  const currentStock = product.currentStock ?? null;
  const reorderLevel = product.reorderLevel ?? null;
  const deficit = product.deficit ?? (currentStock !== null && reorderLevel !== null ? Math.max(0, reorderLevel - currentStock) : null);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card bi-product-detail-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="product-title-group">
            <span className="product-sku-tag">SKU #{product.productId || product.id}</span>
            <h3 className="modal-title">{product.productName || 'Product Economics'}</h3>
            <span className="product-category-badge">{product.category}</span>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close product economics drill-down"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Key Metric Tiles */}
          <div className="bi-drilldown-grid">
            <div className="drilldown-tile tile-revenue">
              <span className="tile-label">TOTAL SALES REVENUE</span>
              <span className="tile-val font-bold text-success">{formatCurrencyINR(totalRev)}</span>
              <span className="tile-hint">From {formatNumber(units)} units sold</span>
            </div>

            <div className="drilldown-tile tile-profit">
              <span className="tile-label">RETAINED GROSS PROFIT</span>
              <span className="tile-val font-bold text-purple">{formatCurrencyINR(totalProfit)}</span>
              <span className="tile-hint">{formatPercent(unitMargin)} operating margin</span>
            </div>

            <div className="drilldown-tile tile-volume">
              <span className="tile-label">MERCHANDISE VOLUME</span>
              <span className="tile-val font-bold">{formatNumber(units)} Units</span>
              <span className="tile-hint">Purchased by customers</span>
            </div>
          </div>

          {/* Unit Economics Section */}
          <div className="economics-breakdown-card">
            <h4 className="section-title">📊 Per-Unit Economics & Margin</h4>
            <div className="economics-row">
              <div className="econ-cell">
                <span className="econ-label">Wholesale Cost Price:</span>
                <span className="econ-val">{formatCurrencyINR(cost)}</span>
              </div>
              <div className="econ-cell">
                <span className="econ-label">Retail Selling Price:</span>
                <span className="econ-val font-bold text-primary">{formatCurrencyINR(sell)}</span>
              </div>
              <div className="econ-cell">
                <span className="econ-label">Gross Margin per Unit:</span>
                <span className="econ-val font-bold text-success">
                  +{formatCurrencyINR(unitProfit)} ({formatPercent(unitMargin)})
                </span>
              </div>
            </div>
          </div>

          {/* Warehouse Stock Buffer if available */}
          {currentStock !== null && (
            <div className="warehouse-status-card">
              <h4 className="section-title">🏭 Warehouse Stock & Replenishment</h4>
              <div className="stock-metrics-row">
                <div className="stock-metric">
                  <span className="stock-lbl">On-Hand Stock:</span>
                  <span className={`stock-val ${currentStock === 0 ? 'text-danger font-bold' : currentStock <= reorderLevel ? 'text-warning font-bold' : 'text-success'}`}>
                    {formatNumber(currentStock)} units
                  </span>
                </div>
                <div className="stock-metric">
                  <span className="stock-lbl">Safety Reorder Buffer:</span>
                  <span className="stock-val">{formatNumber(reorderLevel)} units</span>
                </div>
                <div className="stock-metric">
                  <span className="stock-lbl">Deficit Shortage:</span>
                  <span className="stock-val text-danger font-bold">
                    {deficit > 0 ? `+${formatNumber(deficit)} units needed` : 'Buffer Safe'}
                  </span>
                </div>
                {deficit > 0 && cost > 0 && (
                  <div className="stock-metric">
                    <span className="stock-lbl">Wholesale Purchase Cost:</span>
                    <span className="stock-val">{formatCurrencyINR(deficit * cost)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="drilldown-actions-row">
            {onAskAi && (
              <button
                type="button"
                className="btn-ask-ai-product"
                onClick={() => {
                  onClose();
                  onAskAi(`Tell me about ${product.productName}: analyze its sales velocity, margin (${formatPercent(unitMargin)}), and whether I should restock it.`);
                }}
              >
                ✨ Ask AI About {product.productName} →
              </button>
            )}
            <button type="button" className="btn-close-secondary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
