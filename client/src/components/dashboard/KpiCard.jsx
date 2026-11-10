import React from 'react';

/**
 * Interactive KPI metric card for small business owners.
 *
 * @param {{
 *   title: string,
 *   value: string,
 *   subtitle: string,
 *   icon: string,
 *   variant?: 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'info',
 *   badge?: string,
 *   onClick?: () => void,
 *   tooltip?: string,
 *   actionLabel?: string
 * }} props
 */
export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'primary',
  badge,
  onClick,
  tooltip,
  actionLabel = 'View details &rarr;',
}) {
  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`kpi-card kpi-${variant} ${onClick ? 'kpi-clickable' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={tooltip || subtitle}
      aria-label={`${title}: ${value}. ${subtitle}`}
    >
      <div className="kpi-top">
        <span className="kpi-title">{title}</span>
        <div className="kpi-icon-wrapper">
          <span className="kpi-icon">{icon}</span>
        </div>
      </div>

      <div className="kpi-middle">
        <div className="kpi-value">{value}</div>
        {badge && <span className="kpi-badge">{badge}</span>}
      </div>

      <div className="kpi-subtitle">{subtitle}</div>

      {onClick && (
        <div className="kpi-action-row">
          <span className="kpi-action-text">{actionLabel}</span>
        </div>
      )}
    </div>
  );
}
