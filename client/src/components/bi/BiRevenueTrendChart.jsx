import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatCurrencyINR, formatNumber, formatPercent, formatPeriodLabel } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

const PERIODS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

const METRICS = [
  { id: 'revenue', label: 'Total Revenue (₹)', key: 'totalRevenue', color: '#10b981', fill: '#10b981' },
  { id: 'profit', label: 'Gross Profit (₹)', key: 'grossProfit', color: '#8b5cf6', fill: '#8b5cf6' },
  { id: 'orders', label: 'Order Volume', key: 'totalSales', color: '#3b82f6', fill: '#3b82f6' },
  { id: 'units', label: 'Units Sold', key: 'unitsSold', color: '#f59e0b', fill: '#f59e0b' },
];

function RevenueTrendCustomTooltip({ active, payload, label, activePeriod = 'monthly' }) {
  if (!active || !payload || payload.length === 0) return null;
  const itemData = payload[0].payload;

  return (
    <div className="bi-chart-tooltip">
      <div className="tooltip-title">
        📅 {formatPeriodLabel(label, activePeriod.replace(/ly$/, ''))}
      </div>
      <div className="tooltip-divider" />
      <div className="tooltip-metric-row">
        <span className="tooltip-dot" style={{ backgroundColor: '#10b981' }} />
        <span className="tooltip-label">Sales Revenue:</span>
        <span className="tooltip-value font-bold text-success">
          {formatCurrencyINR(itemData.totalRevenue)}
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-dot" style={{ backgroundColor: '#8b5cf6' }} />
        <span className="tooltip-label">Gross Profit:</span>
        <span className="tooltip-value font-bold text-purple">
          {formatCurrencyINR(itemData.grossProfit)} ({formatPercent(itemData.marginPercentage)} margin)
        </span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-dot" style={{ backgroundColor: '#3b82f6' }} />
        <span className="tooltip-label">Orders Completed:</span>
        <span className="tooltip-value">{formatNumber(itemData.totalSales)} orders</span>
      </div>
      <div className="tooltip-metric-row">
        <span className="tooltip-dot" style={{ backgroundColor: '#f59e0b' }} />
        <span className="tooltip-label">Units Sold:</span>
        <span className="tooltip-value">{formatNumber(itemData.unitsSold)} items</span>
      </div>
      {itemData.averageOrderValue > 0 && (
        <div className="tooltip-metric-row tooltip-aov-row">
          <span className="tooltip-label">Avg Order Value (AOV):</span>
          <span className="tooltip-value">{formatCurrencyINR(itemData.averageOrderValue)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Power BI / Tableau style interactive Revenue & Sales Trend chart with Recharts.
 *
 * @param {{
 *   data: Array,
 *   activePeriod: 'daily'|'weekly'|'monthly'|'yearly',
 *   onPeriodChange: (period: string) => void,
 *   onSelectPoint?: (point: Object) => void,
 *   isLoading?: boolean
 * }} props
 */
export function BiRevenueTrendChart({
  data = [],
  activePeriod = 'monthly',
  onPeriodChange,
  onSelectPoint,
  isLoading = false,
}) {
  const [selectedMetric, setSelectedMetric] = useState('revenue');

  // Compute dynamic totals and peak/lowest intervals
  const {
    totalRevenue,
    totalProfit,
    peakItem,
    lowestItem,
  } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalRevenue: 0,
        totalProfit: 0,
        peakItem: null,
        lowestItem: null,
      };
    }

    let rev = 0;
    let profit = 0;
    let peak = data[0];
    let lowest = data[0];

    data.forEach((d) => {
      const r = d.totalRevenue || 0;
      const p = d.grossProfit || 0;
      rev += r;
      profit += p;
      if (r > (peak.totalRevenue || 0)) peak = d;
      if (r < (lowest.totalRevenue || 0)) lowest = d;
    });

    return {
      totalRevenue: rev,
      totalProfit: profit,
      peakItem: peak,
      lowestItem: lowest,
    };
  }, [data]);

  const activeMetricConfig = METRICS.find((m) => m.id === selectedMetric) || METRICS[0];

  return (
    <div className="card bi-chart-card">
      <div className="card-header-row bi-chart-header">
        <div>
          <div className="header-badge-row">
            <span className="bi-badge">TIME-SERIES BI VELOCITY</span>
          </div>
          <h3 className="card-title">Sales Revenue & Profit Movement</h3>
        </div>

        {/* Period & Metric Switches */}
        <div className="bi-controls-row">
          <div className="bi-pill-group" role="group" aria-label="Metric to chart">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`bi-pill-btn ${selectedMetric === m.id ? 'bi-pill-active' : ''}`}
                onClick={() => setSelectedMetric(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="bi-period-selector" role="group" aria-label="Aggregation period">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`bi-period-btn ${activePeriod === p.id ? 'bi-period-active' : ''}`}
                onClick={() => onPeriodChange(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick BI Summary Chips */}
      {data.length > 0 && !isLoading && (
        <div className="bi-stat-strip">
          <div className="bi-stat-cell">
            <span className="bi-stat-label">Total for Selected View</span>
            <span className="bi-stat-value text-success">{formatCurrencyINR(totalRevenue)}</span>
          </div>
          <div className="bi-stat-cell">
            <span className="bi-stat-label">Retained Gross Profit</span>
            <span className="bi-stat-value text-purple">{formatCurrencyINR(totalProfit)}</span>
          </div>
          {peakItem && (
            <div className="bi-stat-cell">
              <span className="bi-stat-label">Best {activePeriod.replace(/ly$/, '')} Record</span>
              <span className="bi-stat-value">
                {formatPeriodLabel(peakItem.period, activePeriod.replace(/ly$/, ''))} ({formatCurrencyINR(peakItem.totalRevenue)})
              </span>
            </div>
          )}
          {lowestItem && lowestItem !== peakItem && (
            <div className="bi-stat-cell">
              <span className="bi-stat-label">Lowest {activePeriod.replace(/ly$/, '')} Record</span>
              <span className="bi-stat-value text-muted">
                {formatPeriodLabel(lowestItem.period, activePeriod.replace(/ly$/, ''))} ({formatCurrencyINR(lowestItem.totalRevenue)})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Chart Canvas */}
      <div className="card-body bi-chart-body">
        {isLoading ? (
          <LoadingSpinner message="Calculating multi-period Recharts analytics..." />
        ) : data.length === 0 ? (
          <EmptyState
            title="No Time-Series Sales Found"
            message={`No customer checkouts recorded for this ${activePeriod} time window. Try selecting "Monthly" or "All Time".`}
            icon="📉"
          />
        ) : (
          <div className="recharts-wrapper-container" style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 15, right: 25, left: 20, bottom: 10 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload.length > 0 && onSelectPoint) {
                    onSelectPoint(e.activePayload[0].payload);
                  }
                }}
              >
                <defs>
                  <linearGradient id="biMetricGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeMetricConfig.color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={activeMetricConfig.color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="period"
                  tickFormatter={(val) => formatPeriodLabel(val, activePeriod.replace(/ly$/, ''))}
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(val) =>
                    selectedMetric === 'revenue' || selectedMetric === 'profit'
                      ? formatCurrencyINR(val, true)
                      : formatNumber(val)
                  }
                  dx={-8}
                />
                <Tooltip content={<RevenueTrendCustomTooltip activePeriod={activePeriod} />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px' }}
                />
                <Area
                  type="monotone"
                  dataKey={activeMetricConfig.key}
                  name={activeMetricConfig.label}
                  stroke={activeMetricConfig.color}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#biMetricGradient)"
                  activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
