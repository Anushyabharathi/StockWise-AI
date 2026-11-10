import React, { useState, useEffect } from 'react';
import { getCategories } from '../../api/client';
import { formatCurrencyINR, formatNumber, formatPercent } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

/**
 * Category-wise revenue, volume, and profit margin breakdown.
 *
 * @param {{
 *   dateRange: { startDate: string|null, endDate: string|null, label: string }
 * }} props
 */
export function CategoryBreakdown({ dateRange }) {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setIsLoading(true);
      try {
        const data = await getCategories({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          limit: 20,
        });
        if (!ignore) setCategories(data || []);
      } catch (err) {
        console.error('Failed to load category analytics:', err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [dateRange.startDate, dateRange.endDate]);

  return (
    <div className="card category-breakdown-card">
      <div className="card-header-row">
        <div>
          <span className="summary-badge">MERCHANDISE PERFORMANCE</span>
          <h3 className="card-title">Category Revenue & Profit Share</h3>
          <p className="card-subtitle plain-explanation">
            🏷️ Compare how each merchandise category contributes to your top-line sales and bottom-line profit.
          </p>
        </div>
      </div>

      <div className="card-body">
        {isLoading ? (
          <LoadingSpinner message="Calculating category sales share..." />
        ) : categories.length === 0 ? (
          <EmptyState
            title="No Category Sales Recorded"
            message="No sales were recorded for products in this period."
            icon="🏷️"
          />
        ) : (
          <div className="category-list">
            {categories.map((cat, idx) => (
              <div key={idx} className="category-item">
                <div className="category-header-row">
                  <div className="category-title-group">
                    <span className="category-name">{cat.category}</span>
                    <span className="category-sub">
                      {formatNumber(cat.orderCount)} orders &bull; {formatNumber(cat.unitsSold)} units sold
                    </span>
                  </div>
                  <div className="category-metrics-group">
                    <span className="category-rev font-bold text-primary">
                      {formatCurrencyINR(cat.totalRevenue)}
                    </span>
                    <span className="category-share-pct text-muted">
                      ({formatPercent(cat.percentageOfRevenue)} of sales)
                    </span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="category-progress-track">
                  <div
                    className="category-progress-fill"
                    style={{ width: `${Math.min(100, Math.max(2, cat.percentageOfRevenue))}%` }}
                  />
                </div>

                <div className="category-footer-row">
                  <span className="cat-profit text-success">
                    Gross Profit: <strong>{formatCurrencyINR(cat.grossProfit)}</strong>
                  </span>
                  <span className="margin-badge margin-high">
                    {formatPercent(cat.marginPercentage)} Margin
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
