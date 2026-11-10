import React, { useEffect } from 'react';
import { formatCurrencyINR, formatNumber, formatPercent, formatDateTime } from '../../utils/formatters';

/**
 * Inspection modal for a single sales transaction and its line items.
 *
 * @param {{
 *   sale: Object|null,
 *   onClose: () => void
 * }} props
 */
export function SaleDetailModal({ sale, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!sale) return null;

  const {
    saleId,
    saleDate,
    headerTotal = 0,
    calculatedTotal = 0,
    grossProfit = 0,
    hasDiscrepancy = false,
    discrepancyAmount = 0,
    items = [],
    unitsCount = 0,
  } = sale;

  const margin = calculatedTotal > 0 ? (grossProfit / calculatedTotal) * 100 : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container sale-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-detail-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">TRANSACTION LEDGER</span>
            <h2 id="sale-detail-title" className="modal-title">
              Sale Order #{saleId}
            </h2>
            <p className="modal-subtitle">
              Completed on {formatDateTime(saleDate)}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close transaction details"
          >
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Financial Summary Cards */}
          <div className="sale-summary-grid">
            <div className="sale-stat-card">
              <span className="sale-stat-label">Total Revenue</span>
              <span className="sale-stat-val text-primary">
                {formatCurrencyINR(calculatedTotal || headerTotal)}
              </span>
              <span className="sale-stat-sub">{formatNumber(unitsCount)} units in {items.length} item(s)</span>
            </div>

            <div className="sale-stat-card">
              <span className="sale-stat-label">Gross Profit</span>
              <span className="sale-stat-val text-success">
                {formatCurrencyINR(grossProfit)}
              </span>
              <span className="sale-stat-sub">Retained earnings</span>
            </div>

            <div className="sale-stat-card">
              <span className="sale-stat-label">Profit Margin</span>
              <span className="sale-stat-val text-success">
                {formatPercent(margin)}
              </span>
              <span className="sale-stat-sub">Markup over wholesale</span>
            </div>

            <div className="sale-stat-card">
              <span className="sale-stat-label">Reconciliation</span>
              {hasDiscrepancy ? (
                <span className="sale-stat-val text-danger">
                  Mismatch: {formatCurrencyINR(discrepancyAmount)}
                </span>
              ) : (
                <span className="sale-stat-val text-success">
                  &check; Verified Match
                </span>
              )}
              <span className="sale-stat-sub">
                {hasDiscrepancy ? 'Header vs line-item difference' : 'Header & line items 100% matched'}
              </span>
            </div>
          </div>

          {/* Line Items Detail Table */}
          <div className="sale-items-section">
            <div className="section-title-row">
              <h3 className="section-heading">Order Line Items ({items.length})</h3>
              <span className="section-hint">Individual products included in this customer checkout</span>
            </div>

            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Line Total</th>
                    <th>Wholesale Cost</th>
                    <th>Line Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const itemMargin = it.lineTotal > 0 ? (it.lineProfit / it.lineTotal) * 100 : 0;
                    return (
                      <tr key={it.saleItemId || idx}>
                        <td className="text-muted">{idx + 1}</td>
                        <td className="product-name-cell">
                          <strong>{it.productName}</strong>
                          <span className="text-muted" style={{ display: 'block', fontSize: '11px' }}>
                            ID: #{it.productId}
                          </span>
                        </td>
                        <td>
                          <span className="category-pill">{it.category}</span>
                        </td>
                        <td className="quantity-cell">
                          <strong>{formatNumber(it.quantity)}</strong>
                        </td>
                        <td>{formatCurrencyINR(it.unitPrice)}</td>
                        <td className="font-bold text-primary">{formatCurrencyINR(it.lineTotal)}</td>
                        <td className="text-muted">{formatCurrencyINR(it.costPrice)}</td>
                        <td className="text-success font-bold">
                          {formatCurrencyINR(it.lineProfit)}
                          <span style={{ fontSize: '11px', display: 'block', color: 'var(--text-muted)' }}>
                            ({formatPercent(itemMargin)})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
