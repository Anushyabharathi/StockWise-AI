import React, { useState, useId, useMemo } from 'react';
import { formatCurrencyINR, formatNumber, formatPeriodLabel } from '../../utils/formatters';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';

const PERIODS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

export function RevenueChart({ data = [], activePeriod = 'monthly', onPeriodChange, isLoading }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const gradientId = useId();

  const width = 800;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 45, left: 75 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Compute key stats for selected view
  const { totalRevenueView, peakPeriod, avgRevenue } = useMemo(() => {
    if (!data || data.length === 0) {
      return { totalRevenueView: 0, peakPeriod: null, avgRevenue: 0 };
    }
    let total = 0;
    let peak = data[0];
    data.forEach((d) => {
      const rev = d.totalRevenue || 0;
      total += rev;
      if (rev > (peak.totalRevenue || 0)) {
        peak = d;
      }
    });
    return {
      totalRevenueView: total,
      peakPeriod: peak,
      avgRevenue: Math.round(total / data.length),
    };
  }, [data]);

  // Compute scale boundaries
  const values = data.map((d) => d.totalRevenue || 0);
  const maxVal = values.length > 0 ? Math.max(...values, 100) : 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const yMax = Math.ceil((maxVal * 1.15) / magnitude) * magnitude;

  // 4 horizontal gridlines
  const yTicks = [0, yMax * 0.33, yMax * 0.66, yMax];

  // Map data to coordinates
  const points = data.map((d, i) => {
    const x =
      data.length > 1
        ? padding.left + (i / (data.length - 1)) * chartWidth
        : padding.left + chartWidth / 2;
    const y = padding.top + chartHeight - ((d.totalRevenue || 0) / yMax) * chartHeight;
    return { x, y, data: d, index: i };
  });

  // Build SVG path
  let pathD = '';
  let areaD = '';

  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = prev.x + (curr.x - prev.x) / 2;
      pathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    const baseY = padding.top + chartHeight;
    areaD = `${pathD} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }

  const labelInterval = Math.max(1, Math.ceil(data.length / 8));
  const activePoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div className="card revenue-chart-card">
      <div className="chart-header">
        <div className="chart-titles">
          <h3 className="card-title">Sales Revenue Movement</h3>
          <p className="card-subtitle plain-explanation">
            📈 This chart shows how your sales money has moved over time.
          </p>
        </div>

        <div className="period-selector" role="group" aria-label="Select trend period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`period-btn ${activePeriod === p.id ? 'period-btn-active' : ''}`}
              onClick={() => onPeriodChange(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Summary Chips for the selected view */}
      {data.length > 0 && !isLoading && (
        <div className="chart-stat-chips">
          <div className="stat-chip">
            <span className="chip-label">Total for this period:</span>
            <span className="chip-val text-success">{formatCurrencyINR(totalRevenueView)}</span>
          </div>
          {peakPeriod && (
            <div className="stat-chip">
              <span className="chip-label">Best period:</span>
              <span className="chip-val">
                {formatPeriodLabel(peakPeriod.period, activePeriod.replace(/ly$/, ''))} ({formatCurrencyINR(peakPeriod.totalRevenue)})
              </span>
            </div>
          )}
          <div className="stat-chip">
            <span className="chip-label">Average per {activePeriod.replace(/ly$/, '')}:</span>
            <span className="chip-val">{formatCurrencyINR(avgRevenue)}</span>
          </div>
        </div>
      )}

      <div className="chart-body">
        {isLoading ? (
          <div className="chart-loading">
            <LoadingSpinner message="Calculating sales trend numbers..." />
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            title="No Sales Records Found"
            message={`No sales were recorded for this ${activePeriod} time window. Try selecting "Monthly" or "Yearly" to view historical trends.`}
            icon="📉"
          />
        ) : (
          <div className="svg-chart-wrapper">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="trend-svg"
              preserveAspectRatio="xMidYMid meet"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-labels */}
              {yTicks.map((tickVal, idx) => {
                const yPos = padding.top + chartHeight - (tickVal / yMax) * chartHeight;
                return (
                  <g key={idx} className="y-grid-group">
                    <line
                      x1={padding.left}
                      y1={yPos}
                      x2={width - padding.right}
                      y2={yPos}
                      className="grid-line"
                    />
                    <text
                      x={padding.left - 12}
                      y={yPos + 4}
                      className="axis-label y-label"
                      textAnchor="end"
                    >
                      {formatCurrencyINR(tickVal, true)}
                    </text>
                  </g>
                );
              })}

              {/* Area fill */}
              {areaD && <path d={areaD} fill={`url(#${gradientId})`} />}

              {/* Line stroke */}
              {pathD && <path d={pathD} className="chart-line" fill="none" />}

              {/* Hover vertical crosshair */}
              {activePoint && (
                <line
                  x1={activePoint.x}
                  y1={padding.top}
                  x2={activePoint.x}
                  y2={padding.top + chartHeight}
                  className="crosshair-line"
                />
              )}

              {/* Data points and hover zones */}
              {points.map((pt) => {
                const isHovered = hoveredIndex === pt.index;
                return (
                  <g key={pt.index} className="point-group">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : data.length > 30 ? 2.5 : 4}
                      className={`chart-point ${isHovered ? 'point-active' : ''}`}
                    />
                    <rect
                      x={pt.x - Math.max(15, chartWidth / points.length) / 2}
                      y={padding.top}
                      width={Math.max(15, chartWidth / points.length)}
                      height={chartHeight}
                      fill="transparent"
                      className="hover-rect"
                      onMouseEnter={() => setHoveredIndex(pt.index)}
                    />
                  </g>
                );
              })}

              {/* X-axis labels */}
              {points.map((pt, i) => {
                if (i % labelInterval !== 0 && i !== points.length - 1) return null;
                return (
                  <text
                    key={i}
                    x={pt.x}
                    y={height - 12}
                    className="axis-label x-label"
                    textAnchor="middle"
                  >
                    {formatPeriodLabel(pt.data.period, activePeriod.replace(/ly$/, ''))}
                  </text>
                );
              })}
            </svg>

            {/* Plain-Language Hover Tooltip */}
            {activePoint && (
              <div
                className="chart-tooltip"
                style={{
                  left: `${(activePoint.x / width) * 100}%`,
                  top: `${(activePoint.y / height) * 100}%`,
                }}
              >
                <div className="tooltip-period">
                  📅 {formatPeriodLabel(activePoint.data.period, activePeriod.replace(/ly$/, ''))}
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-key">Money Earned:</span>
                  <span className="tooltip-val text-success">
                    {formatCurrencyINR(activePoint.data.totalRevenue)}
                  </span>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-key">Orders Completed:</span>
                  <span className="tooltip-val">{formatNumber(activePoint.data.totalSales)} orders</span>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-key">Items Sold:</span>
                  <span className="tooltip-val">{formatNumber(activePoint.data.unitsSold)} items</span>
                </div>
                {activePoint.data.averageOrderValue > 0 && (
                  <div className="tooltip-row">
                    <span className="tooltip-key">Avg. Sale Size:</span>
                    <span className="tooltip-val">
                      {formatCurrencyINR(activePoint.data.averageOrderValue)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
