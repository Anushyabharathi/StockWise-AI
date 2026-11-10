import React, { useState, useEffect, useMemo } from 'react';
import { getDistribution } from '../../api/client';
import { formatCurrencyINR, formatNumber } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

/**
 * Weekday sales distribution chart and breakdown (Sunday to Saturday).
 *
 * @param {{
 *   dateRange: { startDate: string|null, endDate: string|null, label: string }
 * }} props
 */
export function WeekdayDistribution({ dateRange }) {
  const [distribution, setDistribution] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setIsLoading(true);
      try {
        const data = await getDistribution({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });
        if (!ignore) setDistribution(data || []);
      } catch (err) {
        console.error('Failed to load weekday distribution:', err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [dateRange.startDate, dateRange.endDate]);

  // Find peak day for scaling bars
  const { maxRevenue, peakDay } = useMemo(() => {
    let max = 0;
    let peak = null;
    distribution.forEach((d) => {
      if (d.totalRevenue > max) {
        max = d.totalRevenue;
        peak = d;
      }
    });
    return { maxRevenue: max || 1, peakDay: peak };
  }, [distribution]);

  return (
    <div className="card weekday-distribution-card">
      <div className="card-header-row">
        <div>
          <span className="summary-badge">SHOPPING PATTERNS</span>
          <h3 className="card-title">Weekday Sales Activity (Sun &ndash; Sat)</h3>
          <p className="card-subtitle plain-explanation">
            🗓️ Discover which days of the week drive the highest footfall, customer checkout sizes, and revenue.
          </p>
        </div>

        {peakDay && (
          <div className="peak-badge-chip">
            <span className="chip-label">Busiest Day:</span>
            <span className="chip-highlight font-bold text-success">
              {peakDay.dayName} ({formatCurrencyINR(peakDay.totalRevenue)})
            </span>
          </div>
        )}
      </div>

      <div className="card-body">
        {isLoading ? (
          <LoadingSpinner message="Analyzing customer shopping schedules..." />
        ) : distribution.length === 0 ? (
          <EmptyState
            title="No Weekday Data Available"
            message="No sales records found for this period."
            icon="📅"
          />
        ) : (
          <div className="weekday-grid">
            {distribution.map((day) => {
              const heightPct = Math.round(((day.totalRevenue || 0) / maxRevenue) * 100);
              const isPeak = peakDay?.dayOfWeek === day.dayOfWeek && day.totalRevenue > 0;

              return (
                <div key={day.dayOfWeek} className={`weekday-col ${isPeak ? 'col-peak' : ''}`}>
                  <div className="weekday-bar-container">
                    <div
                      className={`weekday-bar-fill ${isPeak ? 'bar-peak' : ''}`}
                      style={{ height: `${Math.max(6, heightPct)}%` }}
                      title={`${day.dayName}: ${formatCurrencyINR(day.totalRevenue)} (${formatNumber(day.totalSales)} orders)`}
                    />
                  </div>

                  <div className="weekday-info">
                    <span className="weekday-name">{day.dayShort}</span>
                    <span className="weekday-rev text-primary font-bold">
                      {formatCurrencyINR(day.totalRevenue, true)}
                    </span>
                    <span className="weekday-orders text-muted">
                      {formatNumber(day.totalSales)} sales
                    </span>
                    {day.averageOrderValue > 0 && (
                      <span className="weekday-aov" title="Average Order Value on this day">
                        Avg: {formatCurrencyINR(day.averageOrderValue, true)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
