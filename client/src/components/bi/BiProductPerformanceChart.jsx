import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { getTopSelling } from '../../api/client';
import { formatCurrencyINR, formatNumber, formatPercent } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

function ProductCustomTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const prod = payload[0].payload;

  return (
    <div className="bi-chart-tooltip">
      <div className="tooltip-title">
        📦 <strong>{prod.productName}</strong>
      </div>
      <div className="tooltip-subtitle text-muted">
        Category: {prod.category} &bull; SKU #{prod.productId}
      </div>
      <div className="tooltip-divider" />
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Sales Revenue:</span>
        <span className="tooltip-value font-bold text-success">
          {formatCurrencyINR(prod.totalRevenue)}
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Units Sold:</span>
        <span className="tooltip-value font-bold">
          {formatNumber(prod.unitsSold)} units
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Gross Profit:</span>
        <span className="tooltip-value font-bold text-purple">
          {formatCurrencyINR(prod.totalProfit)} ({formatPercent(prod.marginPercentage)} margin)
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Unit Pricing:</span>
        <span className="tooltip-value">
          Cost: {formatCurrencyINR(prod.costPrice)} &bull; Sell: {formatCurrencyINR(prod.sellingPrice)}
        </span>
      </div>
      <div className="tooltip-click-hint">Click bar to view full unit economics</div>
    </div>
  );
}

/**
 * Power BI / Tableau style Top 10 and Bottom 10 Product Performance Bar Chart.
 *
 * @param {{
 *   dateRange: { startDate: string|null, endDate: string|null },
 *   selectedCategory?: string|null,
 *   onSelectProduct?: (product: Object) => void
 * }} props
 */
export function BiProductPerformanceChart({
  dateRange,
  selectedCategory = null,
  onSelectProduct,
}) {
  const [viewMode, setViewMode] = useState('top'); // 'top' | 'bottom'
  const [rankMetric, setRankMetric] = useState('revenue'); // 'revenue' | 'units'
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getTopSelling({
        limit: 10,
        startDate: dateRange?.startDate,
        endDate: dateRange?.endDate,
        category: selectedCategory,
        sortBy: rankMetric === 'revenue' ? 'total_revenue' : 'units_sold',
        sortOrder: viewMode === 'top' ? 'DESC' : 'ASC',
      });
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to load product performance rankings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, selectedCategory, rankMetric, viewMode]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return (
    <div className="card bi-chart-card">
      <div className="card-header-row bi-chart-header">
        <div>
          <div className="header-badge-row">
            <span className="bi-badge">PRODUCT INTELLIGENCE</span>
          </div>
          <h3 className="card-title">
            {viewMode === 'top' ? '🏆 Top 10 Best Sellers' : '⚠️ Bottom 10 Underperformers'}
          </h3>
        </div>

        {/* Controls */}
        <div className="bi-controls-row">
          <div className="bi-pill-group" role="group" aria-label="Ranking perspective">
            <button
              type="button"
              className={`bi-pill-btn ${viewMode === 'top' ? 'bi-pill-active' : ''}`}
              onClick={() => setViewMode('top')}
            >
              Top 10 Leaders
            </button>
            <button
              type="button"
              className={`bi-pill-btn ${viewMode === 'bottom' ? 'bi-pill-active' : ''}`}
              onClick={() => setViewMode('bottom')}
            >
              Bottom 10 Laggards
            </button>
          </div>

          <div className="bi-pill-group" role="group" aria-label="Metric to rank by">
            <button
              type="button"
              className={`bi-pill-btn ${rankMetric === 'revenue' ? 'bi-pill-active' : ''}`}
              onClick={() => setRankMetric('revenue')}
            >
              By Revenue (₹)
            </button>
            <button
              type="button"
              className={`bi-pill-btn ${rankMetric === 'units' ? 'bi-pill-active' : ''}`}
              onClick={() => setRankMetric('units')}
            >
              By Units Sold
            </button>
          </div>
        </div>
      </div>

      <div className="card-body bi-chart-body">
        {isLoading ? (
          <LoadingSpinner message="Calculating product performance rankings..." />
        ) : products.length === 0 ? (
          <EmptyState
            title="No Product Sales Recorded"
            message="No products recorded sales matching this filter criteria."
            icon="📦"
          />
        ) : (
          <div className="recharts-wrapper-container" style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={products}
                margin={{ top: 10, right: 30, left: 140, bottom: 10 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload.length > 0 && onSelectProduct) {
                    onSelectProduct(e.activePayload[0].payload);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(val) =>
                    rankMetric === 'revenue' ? formatCurrencyINR(val, true) : formatNumber(val)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="productName"
                  stroke="#334155"
                  fontSize={12}
                  tickLine={false}
                  width={130}
                  tickFormatter={(val) => (val.length > 16 ? `${val.slice(0, 15)}…` : val)}
                />
                <Tooltip content={<ProductCustomTooltip />} />
                <Bar
                  dataKey={rankMetric === 'revenue' ? 'totalRevenue' : 'unitsSold'}
                  name={rankMetric === 'revenue' ? 'Revenue (₹)' : 'Units Sold'}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                  cursor="pointer"
                >
                  {products.map((entry, index) => {
                    const color =
                      viewMode === 'top'
                        ? index === 0
                          ? '#059669' // #1 leader dark emerald
                          : index < 3
                          ? '#10b981' // top 3 emerald
                          : '#3b82f6' // rest blue
                        : '#f59e0b'; // amber/orange for bottom laggards

                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
