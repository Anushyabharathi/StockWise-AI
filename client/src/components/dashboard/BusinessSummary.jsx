import React from 'react';
import { formatCurrencyINR, formatNumber } from '../../utils/formatters';

/**
 * Plain-language narrative summary for small business owners.
 * Converts raw KPIs into clear, non-technical explanations and provides an extension point for Claude AI.
 *
 * @param {{
 *   summary: Object,
 *   topProduct: Object,
 *   dateLabel: string,
 *   lowStockCount: number
 * }} props
 */
export function BusinessSummary({ summary, topProduct, dateLabel = 'All Time', lowStockCount = 0 }) {
  if (!summary) return null;

  const revenue = formatCurrencyINR(summary.totalRevenue || 0);
  const salesCount = formatNumber(summary.validSalesCount || 0);
  const unitsSold = formatNumber(summary.unitsSold || 0);
  const aov = formatCurrencyINR(summary.averageOrderValue || 0);

  return (
    <div className="card business-summary-card">
      <div className="card-header-row">
        <div className="summary-title-col">
          <span className="summary-badge">PLAIN-LANGUAGE REPORT</span>
          <h3 className="card-title">What’s Happening in Your Business?</h3>
          <p className="card-subtitle">
            A quick, jargon-free summary based on your actual verified sales and stock data ({dateLabel}).
          </p>
        </div>
      </div>

      <div className="summary-grid">
        {/* Factual Highlights Box */}
        <div className="summary-factual-box">
          <div className="summary-box-header">
            <span className="box-icon">📊</span>
            <span className="box-title">Verified Store Highlights</span>
            <span className="verified-badge">100% Real Data</span>
          </div>

          <ul className="summary-bullet-list">
            <li>
              💵 <strong>Total Money Earned:</strong> Your store has collected{' '}
              <span className="highlight-text">{revenue}</span> in total sales revenue from{' '}
              <span className="highlight-text">{salesCount}</span> customer orders.
            </li>
            <li>
              📦 <strong>Volume of Goods:</strong> Customers purchased{' '}
              <span className="highlight-text">{unitsSold} individual items</span> across your inventory catalogue.
            </li>
            <li>
              🧾 <strong>Order Value:</strong> On average, each customer spent{' '}
              <span className="highlight-text">{aov}</span> per visit.
            </li>
            {topProduct && (
              <li>
                ⭐ <strong>Customer Favorite:</strong> Your #1 best-selling product is{' '}
                <strong>{topProduct.productName}</strong>, with{' '}
                <span className="highlight-text">{formatNumber(topProduct.unitsSold)} units</span> sold.
              </li>
            )}
            <li>
              ⚠️ <strong>Stock Condition:</strong> You currently have{' '}
              <span className={lowStockCount > 0 ? 'text-danger font-bold' : 'text-success font-bold'}>
                {lowStockCount} {lowStockCount === 1 ? 'product' : 'products'}
              </span>{' '}
              that need replenishment before running out.
            </li>
          </ul>
        </div>

        {/* AI Advisor Preview / Extension Point */}
        <div className="summary-ai-box">
          <div className="summary-box-header">
            <span className="box-icon">🤖</span>
            <span className="box-title">AI Business Advisor</span>
            <span className="ai-preview-badge">Phase 3 Ready</span>
          </div>

          <p className="ai-description">
            StockWise AI is built to connect with <strong>Anthropic Claude</strong> to turn these sales numbers into automated restocking schedules and pricing recommendations.
          </p>

          <div className="ai-upcoming-features">
            <div className="ai-feature-item">
              <span className="feature-dot"></span>
              <span><strong>Restock Forecasting:</strong> Predicts exactly when Basmati Rice or Milk will run out based on past velocity.</span>
            </div>
            <div className="ai-feature-item">
              <span className="feature-dot"></span>
              <span><strong>Margin Optimization:</strong> Highlights items where slight price adjustments can boost weekly profit.</span>
            </div>
            <div className="ai-feature-item">
              <span className="feature-dot"></span>
              <span><strong>Risk Detection:</strong> Warns about slow-moving products before they expire or tie up your working capital.</span>
            </div>
          </div>

          <div className="ai-footer-note">
            <em>💡 All metrics above are currently calculated directly from your PostgreSQL database. No AI estimates are shown yet.</em>
          </div>
        </div>
      </div>
    </div>
  );
}
