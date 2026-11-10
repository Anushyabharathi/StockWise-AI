import React, { useMemo } from 'react';
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
import { formatCurrencyINR, formatNumber } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

function WeekdayCustomTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const day = payload[0].payload;

  return (
    <div className="bi-chart-tooltip">
      <div className="tooltip-title">
        🗓️ <strong>{day.dayName}</strong>
      </div>
      <div className="tooltip-divider" />
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Sales Revenue:</span>
        <span className="tooltip-value font-bold text-success">
          {formatCurrencyINR(day.totalRevenue)}
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Completed Orders:</span>
        <span className="tooltip-value font-bold">{formatNumber(day.totalSales)} orders</span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-label">Units Sold:</span>
        <span className="tooltip-value">{formatNumber(day.unitsSold)} items</span>
      </div>
      {day.averageOrderValue > 0 && (
        <div className="tooltip-metric-row">
          <span className="tooltip-label">Avg Order Value:</span>
          <span className="tooltip-value text-primary font-bold">
            {formatCurrencyINR(day.averageOrderValue)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Power BI / Tableau style Weekday Shopping Pattern chart with Recharts.
 *
 * @param {{
 *   data: Array,
 *   isLoading?: boolean
 * }} props
 */
export function BiWeekdayChart({ data = [], isLoading = false }) {
  const peakDay = useMemo(() => {
    if (!data || data.length === 0) return null;
    let peak = data[0];
    data.forEach((d) => {
      if ((d.totalRevenue || 0) > (peak.totalRevenue || 0)) peak = d;
    });
    return peak;
  }, [data]);

  return (
    <div className="card bi-chart-card">
      <div className="card-header-row bi-chart-header">
        <div>
          <div className="header-badge-row">
            <span className="bi-badge">WEEKDAY SHOPPING PATTERN</span>
          </div>
          <h3 className="card-title">Sales by Day of the Week</h3>
        </div>

        {peakDay && (
          <div className="bi-chip-best">
            <span className="chip-label">Peak Footfall:</span>
            <span className="chip-val text-success">
              {peakDay.dayName} ({formatCurrencyINR(peakDay.totalRevenue)})
            </span>
          </div>
        )}
      </div>

      <div className="card-body bi-chart-body">
        {isLoading ? (
          <LoadingSpinner message="Calculating weekday Recharts distribution..." />
        ) : data.length === 0 ? (
          <EmptyState
            title="No Weekday Data Available"
            message="No sales recorded for this period."
            icon="📅"
          />
        ) : (
          <div className="recharts-wrapper-container" style={{ width: '100%', height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 15, right: 25, left: 20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="dayShort"
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
                <Tooltip content={<WeekdayCustomTooltip />} />
                <Bar
                  dataKey="totalRevenue"
                  name="Sales Revenue (₹)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
                >
                  {data.map((entry, index) => {
                    const isPeak = peakDay?.dayOfWeek === entry.dayOfWeek;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isPeak ? '#10b981' : '#3b82f6'}
                      />
                    );
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
