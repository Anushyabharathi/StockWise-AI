import React, { useEffect } from 'react';
import { formatCurrencyINR, formatNumber, formatPercent } from '../../utils/formatters';

export function ProductDetailModal({ product, onClose }) {
  // Support closing with Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!product) return null;

  const sellingPrice = product.sellingPrice || 0;
  const costPrice = product.costPrice || 0;
  const profitPerUnit = Math.max(0, sellingPrice - costPrice);
  const unitsSold = product.unitsSold || 0;
  const totalRevenue = product.totalRevenue || 0;
  const totalProfit = product.totalProfit || unitsSold * profitPerUnit;
  const marginPercentage = product.marginPercentage || (totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="category-pill">{product.category}</span>
            <h3 className="modal-title">{product.productName}</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close details">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Unit Economics Box */}
          <div className="econ-box">
            <h4 className="econ-heading">Unit Pricing & Profit</h4>
            <div className="econ-grid">
              <div className="econ-item">
                <span className="econ-label">Selling Price</span>
                <span className="econ-val">{formatCurrencyINR(sellingPrice)}</span>
                <span className="econ-sub">What customers pay per item</span>
              </div>
              <div className="econ-item">
                <span className="econ-label">Supplier Cost</span>
                <span className="econ-val">{formatCurrencyINR(costPrice)}</span>
                <span className="econ-sub">What you paid for each item</span>
              </div>
              <div className="econ-item econ-highlight">
                <span className="econ-label">Profit Per Item</span>
                <span className="econ-val text-success">{formatCurrencyINR(profitPerUnit)}</span>
                <span className="econ-sub">Money kept after supplier cost</span>
              </div>
            </div>
          </div>

          {/* Sales Performance Box */}
          <div className="econ-box">
            <h4 className="econ-heading">Overall Sales Performance</h4>
            <div className="econ-grid">
              <div className="econ-item">
                <span className="econ-label">Total Units Sold</span>
                <span className="econ-val">{formatNumber(unitsSold)}</span>
                <span className="econ-sub">Items sold to customers</span>
              </div>
              <div className="econ-item">
                <span className="econ-label">Total Sales Revenue</span>
                <span className="econ-val">{formatCurrencyINR(totalRevenue)}</span>
                <span className="econ-sub">Total cash collected from this product</span>
              </div>
              <div className="econ-item econ-highlight">
                <span className="econ-label">Total Gross Profit</span>
                <span className="econ-val text-success">{formatCurrencyINR(totalProfit)}</span>
                <span className="econ-sub">Gross margin: {formatPercent(marginPercentage)}</span>
              </div>
            </div>
          </div>

          {/* Explanation note for business owners */}
          <div className="modal-explanation">
            <p>
              💡 <strong>Understanding Revenue vs. Profit:</strong>
              <br />
              <strong>Revenue</strong> ({formatCurrencyINR(totalRevenue)}) is the total money collected at the register.
              <br />
              <strong>Profit</strong> ({formatCurrencyINR(totalProfit)}) is what remains after paying the supplier ({formatCurrencyINR(unitsSold * costPrice)} total supplier cost).
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-action-btn" onClick={onClose}>
            Close Product Details
          </button>
        </div>
      </div>
    </div>
  );
}
