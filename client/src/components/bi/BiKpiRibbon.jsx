import React from 'react';
import { formatCurrencyINR, formatNumber, formatPercent } from '../../utils/formatters';
import { SkeletonCard } from '../common/LoadingSpinner';

/**
 * Power BI / Tableau inspired interactive KPI ribbon.
 * Renders 8 core executive metrics with plain-language explanations.
 *
 * @param {{
 *   summary: Object|null,
 *   isLoading?: boolean,
 *   onNavigate?: (tab: string, filter?: string) => void
 * }} props
 */
export function BiKpiRibbon({ summary, isLoading = false, onNavigate }) {
  if (isLoading && !summary) {
    return (
      <div className="bi-kpi-ribbon-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const revenue = formatCurrencyINR(summary?.totalRevenue ?? 0);
  const grossProfit = formatCurrencyINR(summary?.grossProfit ?? 0);
  const grossMargin = formatPercent(summary?.grossMargin ?? 0);
  const orders = formatNumber(summary?.validSalesCount ?? 0);
  const units = formatNumber(summary?.unitsSold ?? 0);
  const aov = formatCurrencyINR(summary?.averageOrderValue ?? 0);
  const activeProducts = formatNumber(summary?.activeProductCount ?? 0);
  const lowStock = formatNumber(summary?.lowStockProductCount ?? 0);
  const outOfStock = formatNumber(summary?.outOfStockProductCount ?? 0);

  const isLowStockZero = (summary?.lowStockProductCount ?? 0) === 0;
  const isOutOfStockZero = (summary?.outOfStockProductCount ?? 0) === 0;

  const cards = [
    {
      id: 'revenue',
      title: 'TOTAL REVENUE',
      value: revenue,
      subtitle: 'Gross customer cash inflow',
      icon: '💰',
      variant: 'success',
      badge: 'Cashflow',
      tab: 'sales',
      filter: null,
      tooltip: 'Gross sales revenue collected from all valid, non-refunded customer checkout receipts.',
      actionHint: 'View sales velocity →',
    },
    {
      id: 'grossProfit',
      title: 'GROSS PROFIT',
      value: grossProfit,
      subtitle: `Retained operating income (${grossMargin})`,
      icon: '📈',
      variant: 'purple',
      badge: `${grossMargin} Margin`,
      tab: 'reports',
      filter: null,
      tooltip: 'Real money retained by the business after covering wholesale supplier purchase costs.',
      actionHint: 'View financial P&L →',
    },
    {
      id: 'orders',
      title: 'VALID ORDERS',
      value: orders,
      subtitle: 'Completed store receipts',
      icon: '🧾',
      variant: 'primary',
      badge: 'Receipts',
      tab: 'sales',
      filter: null,
      tooltip: 'Total distinct, non-duplicate customer receipts processed in database.',
      actionHint: 'Browse order ledger →',
    },
    {
      id: 'units',
      title: 'UNITS SOLD',
      value: units,
      subtitle: 'Merchandise volume moved',
      icon: '📦',
      variant: 'info',
      badge: 'Volume',
      tab: 'products',
      filter: null,
      tooltip: 'Total aggregate item quantities purchased across all product departments.',
      actionHint: 'Inspect best-sellers →',
    },
    {
      id: 'aov',
      title: 'AVG. ORDER VALUE',
      value: aov,
      subtitle: 'Average receipt checkout size',
      icon: '📊',
      variant: 'primary',
      badge: 'Basket Size',
      tab: 'sales',
      filter: null,
      tooltip: 'Average revenue generated per customer transaction (Total Revenue ÷ Total Orders).',
      actionHint: 'Analyze checkout sizes →',
    },
    {
      id: 'activeProducts',
      title: 'ACTIVE SKUS',
      value: activeProducts,
      subtitle: 'Listed catalog products',
      icon: '🏷️',
      variant: 'primary',
      badge: 'Catalogue',
      tab: 'inventory',
      filter: 'ALL',
      tooltip: 'Number of active merchandise items currently listed in the store inventory catalog.',
      actionHint: 'Browse full warehouse →',
    },
    {
      id: 'lowStock',
      title: 'RUNNING LOW',
      value: lowStock,
      subtitle: 'At or under safety buffer',
      icon: '⚠️',
      variant: isLowStockZero ? 'success' : 'warning',
      badge: isLowStockZero ? 'Healthy Stock' : 'Needs Restock',
      tab: 'inventory',
      filter: 'LOW',
      tooltip: 'Products currently at or below minimum replenishment threshold quantity.',
      actionHint: isLowStockZero ? 'Check warehouse →' : 'Review replenishment →',
    },
    {
      id: 'outOfStock',
      title: 'OUT OF STOCK',
      value: outOfStock,
      subtitle: 'Zero units remaining on shelf',
      icon: '🚨',
      variant: isOutOfStockZero ? 'success' : 'danger',
      badge: isOutOfStockZero ? 'Fully Stocked' : 'Immediate Restock',
      tab: 'inventory',
      filter: 'OUT_OF_STOCK',
      tooltip: 'Products completely exhausted (0 units on shelf) causing lost customer sales revenue.',
      actionHint: isOutOfStockZero ? 'Warehouse safe →' : 'Order stock now →',
    },
  ];

  return (
    <div className="bi-kpi-ribbon-grid">
      {cards.map((c) => (
        <div
          key={c.id}
          className={`bi-kpi-card bi-kpi-${c.variant} ${onNavigate ? 'bi-kpi-clickable' : ''}`}
          onClick={() => onNavigate && onNavigate(c.tab, c.filter)}
          title={c.tooltip}
          role={onNavigate ? 'button' : undefined}
          tabIndex={onNavigate ? 0 : undefined}
          onKeyDown={(e) => {
            if (onNavigate && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onNavigate(c.tab, c.filter);
            }
          }}
        >
          <div className="bi-kpi-top">
            <span className="bi-kpi-title">{c.title}</span>
            <span className="bi-kpi-icon-pill">{c.icon}</span>
          </div>

          <div className="bi-kpi-value-row">
            <span className="bi-kpi-val">{c.value}</span>
            {c.badge && <span className={`bi-kpi-badge badge-${c.variant}`}>{c.badge}</span>}
          </div>

          <div className="bi-kpi-graphic-meter">
            <div className={`meter-bar meter-bar-${c.variant}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
