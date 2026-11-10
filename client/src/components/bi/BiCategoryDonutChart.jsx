import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { formatCurrencyINR, formatNumber, formatPercent } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

const PALETTE = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#14b8a6', // teal
];

function CategoryCustomTooltip({ active, payload, selectedCategory }) {
  if (!active || !payload || payload.length === 0) return null;
  const cat = payload[0].payload;

  return (
    <div className="bi-chart-tooltip">
      <div className="tooltip-title">
        🏷️ Category: <strong>{cat.category}</strong>
      </div>
      <div className="tooltip-divider" />
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Gross Revenue:</span>
        <span className="tooltip-value font-bold text-success">
          {formatCurrencyINR(cat.totalRevenue)}
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Share of Total:</span>
        <span className="tooltip-value font-bold text-primary">
          {formatPercent(cat.percentageOfRevenue)}
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Gross Profit:</span>
        <span className="tooltip-value font-bold text-purple">
          {formatCurrencyINR(cat.grossProfit)} ({formatPercent(cat.marginPercentage)} margin)
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Sales Volume:</span>
        <span className="tooltip-value">
          {formatNumber(cat.orderCount)} orders &bull; {formatNumber(cat.unitsSold)} units
        </span>
      </div>
      <div className="tooltip-click-hint">
        {selectedCategory === cat.category ? 'Click to clear filter' : 'Click to filter dashboard to this category'}
      </div>
    </div>
  );
}

/**
 * Power BI / Tableau style Category Contribution Donut chart with Recharts.
 *
 * @param {{
 *   data: Array,
 *   selectedCategory?: string|null,
 *   onSelectCategory?: (category: string|null) => void,
 *   isLoading?: boolean
 * }} props
 */
export function BiCategoryDonutChart({
  data = [],
  selectedCategory = null,
  onSelectCategory,
  isLoading = false,
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Compute total category revenue for center donut label
  const totalRevenue = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.reduce((acc, c) => acc + (c.totalRevenue || 0), 0);
  }, [data]);

  return (
    <div className="card bi-chart-card">
      <div className="card-header-row bi-chart-header">
        <div>
          <div className="header-badge-row">
            <span className="bi-badge">PORTFOLIO MIX</span>
          </div>
          <h3 className="card-title">Category Revenue Contribution</h3>
        </div>

        {selectedCategory && (
          <button
            type="button"
            className="bi-clear-filter-btn"
            onClick={() => onSelectCategory && onSelectCategory(null)}
          >
            Clear Filter ({selectedCategory}) &times;
          </button>
        )}
      </div>

      <div className="card-body bi-chart-body">
        {isLoading ? (
          <LoadingSpinner message="Calculating category contribution donut..." />
        ) : data.length === 0 ? (
          <EmptyState
            title="No Category Sales Recorded"
            message="No sales records available in this time filter."
            icon="🏷️"
          />
        ) : (
          <div className="recharts-wrapper-container" style={{ width: '100%', height: 380, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="totalRevenue"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={128}
                  paddingAngle={3}
                  onMouseEnter={(_, idx) => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={(entry) => {
                    if (onSelectCategory) {
                      onSelectCategory(
                        selectedCategory === entry.category ? null : entry.category
                      );
                    }
                  }}
                  cursor="pointer"
                >
                  {data.map((entry, index) => {
                    const isSelected = selectedCategory === entry.category;
                    const isHovered = hoveredIdx === index;
                    const baseColor = PALETTE[index % PALETTE.length];

                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={baseColor}
                        stroke={isSelected ? '#0f172a' : '#ffffff'}
                        strokeWidth={isSelected ? 3 : 1.5}
                        opacity={selectedCategory && !isSelected ? 0.4 : isHovered ? 1 : 0.9}
                      />
                    );
                  })}
                </Pie>
                <Tooltip content={<CategoryCustomTooltip selectedCategory={selectedCategory} />} />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  iconType="circle"
                  wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centered Donut Label */}
            <div className="donut-center-overlay">
              <span className="donut-center-title">
                {selectedCategory ? selectedCategory : 'Total Sales'}
              </span>
              <span className="donut-center-value">
                {selectedCategory
                  ? formatCurrencyINR(data.find((c) => c.category === selectedCategory)?.totalRevenue || 0, true)
                  : formatCurrencyINR(totalRevenue, true)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
