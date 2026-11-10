import React from 'react';

/**
 * Reusable Power BI / Tableau style dynamic chart explanation widget.
 * Analyzes actual API data and renders plain-language business answers:
 * 1. What does this chart show?
 * 2. Is the result improving or declining?
 * 3. Which products/categories need attention?
 * 4. What action could the store owner take?
 *
 * @param {{
 *   title: string,
 *   whatItShows: string,
 *   trendStatus?: 'improving' | 'declining' | 'stable' | 'neutral',
 *   trendMessage: string,
 *   attentionItem?: string,
 *   recommendedAction: string,
 * }} props
 */
export function BiChartExplanation({
  title,
  whatItShows,
  trendStatus = 'neutral',
  trendMessage,
  attentionItem,
  recommendedAction,
}) {
  const getStatusBadge = () => {
    switch (trendStatus) {
      case 'improving':
        return <span className="bi-trend-pill bi-trend-positive">▲ Improving</span>;
      case 'declining':
        return <span className="bi-trend-pill bi-trend-negative">▼ Declining</span>;
      case 'stable':
        return <span className="bi-trend-pill bi-trend-stable">■ Stable</span>;
      case 'neutral':
      default:
        return <span className="bi-trend-pill bi-trend-neutral">● Telemetry</span>;
    }
  };

  return (
    <div className="bi-chart-explanation-box">
      <div className="bi-explanation-header">
        <span className="bi-bulb-icon">💡</span>
        <div className="bi-explanation-title-group">
          <h4 className="bi-explanation-title">Business Owner's Guide &mdash; {title}</h4>
          <span className="bi-explanation-sub">Dynamic plain-language insights generated from real database results</span>
        </div>
        {getStatusBadge()}
      </div>

      <div className="bi-explanation-grid">
        <div className="bi-explanation-item">
          <span className="bi-item-label">📊 What This Shows</span>
          <p className="bi-item-text">{whatItShows}</p>
        </div>

        <div className="bi-explanation-item">
          <span className="bi-item-label">📈 Performance Trend</span>
          <p className="bi-item-text">{trendMessage}</p>
        </div>

        {attentionItem && (
          <div className="bi-explanation-item">
            <span className="bi-item-label">⚠️ Needs Attention</span>
            <p className="bi-item-text text-warning font-semibold">{attentionItem}</p>
          </div>
        )}

        <div className="bi-explanation-item">
          <span className="bi-item-label">🎯 Recommended Action</span>
          <p className="bi-item-text text-primary font-semibold">{recommendedAction}</p>
        </div>
      </div>
    </div>
  );
}
