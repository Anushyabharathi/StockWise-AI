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
} from 'recharts';
import { formatCurrencyINR, formatNumber, formatPercent, formatPeriodLabel } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

function MonthlyCustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const month = payload[0].payload;
  const cogs = Math.max(0, (month.totalRevenue || 0) - (month.grossProfit || 0));

  return (
    <div className="bi-chart-tooltip">
      <div className="tooltip-title">
        📅 Month: {formatPeriodLabel(label, 'month')}
      </div>
      <div className="tooltip-divider" />
      <div className="tooltip-metric-row">
        <span className="tooltip-dot" style={{ backgroundColor: '#10b981' }} />
        <span className="tooltip-label">Sales Revenue:</span>
        <span className="tooltip-value font-bold text-success">
          {formatCurrencyINR(month.totalRevenue)}
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-dot" style={{ backgroundColor: '#94a3b8' }} />
        <span className="tooltip-label">Supplier COGS:</span>
        <span className="tooltip-value text-muted">
          {formatCurrencyINR(cogs)}
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-dot" style={{ backgroundColor: '#8b5cf6' }} />
        <span className="tooltip-label">Retained Gross Profit:</span>
        <span className="tooltip-value font-bold text-purple">
          {formatCurrencyINR(month.grossProfit)} ({formatPercent(month.marginPercentage)} margin)
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-dot" style={{ backgroundColor: '#3b82f6' }} />
        <span className="tooltip-label">Orders & Units:</span>
        <span className="tooltip-value">
          {formatNumber(month.totalSales)} orders &bull; {formatNumber(month.unitsSold)} units
        </span>
      </div>
    </div>
  );
}

/**
 * Power BI / Tableau style Monthly Revenue vs Gross Profit comparison bar chart.
 *
 * @param {{
 *   data: Array,
 *   onSelectMonth?: (monthItem: Object) => void,
 *   isLoading?: boolean
 * }} props
 */
export function BiMonthlyComparisonChart({ data = [], onSelectMonth, isLoading = false }) {
  // Compute peak performing month for visual badge
  const bestMonth = useMemo(() => {
    if (!data || data.length === 0) return null;
    let peak = data[0];
    data.forEach((m) => {
      if ((m.totalRevenue || 0) > (peak.totalRevenue || 0)) peak = m;
    });
    return peak;
  }, [data]);

  return (
    <div className="card bi-chart-card">
      <div className="card-header-row bi-chart-header">
        <div>
          <div className="header-badge-row">
            <span className="bi-badge">FINANCIAL TELEMETRY</span>
          </div>
          <h3 className="card-title">Monthly Revenue vs. Gross Profit</h3>
        </div>

        {bestMonth && (
          <div className="bi-chip-best">
            <span className="chip-label">Best Month:</span>
            <span className="chip-val text-success">
              {bestMonth.period} ({formatCurrencyINR(bestMonth.totalRevenue)})
            </span>
          </div>
        )}
      </div>

      <div className="card-body bi-chart-body">
        {isLoading ? (
          <LoadingSpinner message="Calculating monthly Recharts bar analytics..." />
        ) : data.length === 0 ? (
          <EmptyState
            title="No Monthly Sales Recorded"
            message="No sales transactions are available in this date filter."
            icon="📊"
          />
        ) : (
          <div className="recharts-wrapper-container" style={{ width: '100%', height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 15, right: 25, left: 20, bottom: 10 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload.length > 0 && onSelectMonth) {
                    onSelectMonth(e.activePayload[0].payload);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="period"
                  tickFormatter={(val) => formatPeriodLabel(val, 'month')}
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(val) => formatCurrencyINR(val, true)}
                  dx={-8}
                />
                <Tooltip content={<MonthlyCustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px' }}
                />
                <Bar
                  dataKey="totalRevenue"
                  name="Sales Revenue (₹)"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
                  cursor="pointer"
                />
                <Bar
                  dataKey="grossProfit"
                  name="Gross Profit (₹)"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
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
