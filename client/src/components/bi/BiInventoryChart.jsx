import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { formatNumber, formatCurrencyINR } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

function InventoryCustomTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;

  return (
    <div className="bi-chart-tooltip">
      <div className="tooltip-title">
        🏭 <strong>{item.productName}</strong>
      </div>
      <div className="tooltip-subtitle text-muted">
        Category: {item.category} &bull; SKU #{item.productId}
      </div>
      <div className="tooltip-divider" />
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Current Stock:</span>
        <span className={`tooltip-value font-bold ${item.currentStock === 0 ? 'text-danger' : item.stockStatus === 'CRITICAL' ? 'text-warning' : 'text-primary'}`}>
          {formatNumber(item.currentStock)} units
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Safety Reorder Level:</span>
        <span className="tooltip-value">{formatNumber(item.reorderLevel)} units</span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Deficit (Units Needed):</span>
        <span className="tooltip-value font-bold text-danger">
          +{formatNumber(item.deficit || Math.max(0, item.reorderLevel - item.currentStock))} units
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Wholesale Restock Cost:</span>
        <span className="tooltip-value">
          {formatCurrencyINR((item.deficit || Math.max(0, item.reorderLevel - item.currentStock)) * (item.costPrice || 0))}
        </span>
      </div>
      <div className="tooltip-click-hint">Click bar to inspect product in warehouse</div>
    </div>
  );
}

/**
 * Power BI / Tableau style Inventory Intelligence horizontal bar chart.
 * Compares Current Stock with Reorder Safety Level.
 *
 * @param {{
 *   data: Array,
 *   onSelectProduct?: (product: Object) => void,
 *   isLoading?: boolean
 * }} props
 */
export function BiInventoryChart({ data = [], onSelectProduct, isLoading = false }) {
  // Focus on top 12 items needing restock or with lowest stock
  const chartItems = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data]
      .sort((a, b) => {
        // Prioritize out of stock (currentStock = 0) then highest deficit
        if (a.currentStock === 0 && b.currentStock !== 0) return -1;
        if (b.currentStock === 0 && a.currentStock !== 0) return 1;
        return (b.deficit || 0) - (a.deficit || 0);
      })
      .slice(0, 12);
  }, [data]);

  // Compute stock health counts for visual legend chips
  const { outCount, critCount, lowCount } = useMemo(() => {
    let out = 0;
    let crit = 0;
    let low = 0;

    data.forEach((item) => {
      if (item.currentStock === 0) out++;
      else if (item.stockStatus === 'CRITICAL') crit++;
      else if (item.stockStatus === 'LOW') low++;
    });

    return {
      outCount: out,
      critCount: crit,
      lowCount: low,
    };
  }, [data]);

  return (
    <div className="card bi-chart-card">
      <div className="card-header-row bi-chart-header">
        <div>
          <div className="header-badge-row">
            <span className="bi-badge">WAREHOUSE BUFFER BI</span>
          </div>
          <h3 className="card-title">Inventory Stock vs. Reorder Level</h3>
        </div>

        <div className="bi-stock-status-legend">
          <span className="status-indicator">
            <span className="legend-dot" style={{ backgroundColor: '#ef4444' }} /> Out of Stock ({outCount})
          </span>
          <span className="status-indicator">
            <span className="legend-dot" style={{ backgroundColor: '#ea580c' }} /> Critical Low ({critCount})
          </span>
          <span className="status-indicator">
            <span className="legend-dot" style={{ backgroundColor: '#f59e0b' }} /> Low Stock ({lowCount})
          </span>
        </div>
      </div>

      <div className="card-body bi-chart-body">
        {isLoading ? (
          <LoadingSpinner message="Evaluating warehouse buffer Recharts levels..." />
        ) : chartItems.length === 0 ? (
          <EmptyState
            title="Warehouse Inventory Healthy"
            message="No products currently have inventory shortages."
            icon="✅"
          />
        ) : (
          <div className="recharts-wrapper-container" style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartItems}
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
                  tickFormatter={(val) => `${val} units`}
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
                <Tooltip content={<InventoryCustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px' }}
                />
                <Bar
                  dataKey="currentStock"
                  name="Current Stock Units"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  cursor="pointer"
                >
                  {chartItems.map((entry, index) => {
                    const color =
                      entry.currentStock === 0
                        ? '#ef4444' // red
                        : entry.stockStatus === 'CRITICAL'
                        ? '#ea580c' // orange
                        : entry.stockStatus === 'LOW'
                        ? '#f59e0b' // amber
                        : '#10b981'; // green

                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
                <Bar
                  dataKey="reorderLevel"
                  name="Safety Threshold"
                  fill="#94a3b8"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  opacity={0.6}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
