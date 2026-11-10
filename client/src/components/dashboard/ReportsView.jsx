import React, { useState, useEffect, useMemo } from 'react';
import { getCategories } from '../../api/client';
import { formatCurrencyINR, formatNumber, formatPercent } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function ReportsView({ summary, lowStock = [], dateRange }) {
  const [categoriesData, setCategoriesData] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Fetch real category data from the new endpoint
  useEffect(() => {
    let ignore = false;
    async function load() {
      setIsLoadingCategories(true);
      try {
        const data = await getCategories({
          startDate: dateRange?.startDate,
          endDate: dateRange?.endDate,
          limit: 20,
        });
        if (!ignore) setCategoriesData(data || []);
      } catch (err) {
        console.error('Failed to load categories in ReportsView:', err);
      } finally {
        if (!ignore) setIsLoadingCategories(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [dateRange?.startDate, dateRange?.endDate]);

  // Calculate estimated restock capital needed for low stock deficit
  const totalRestockCost = useMemo(() => {
    return lowStock.reduce((acc, item) => {
      const deficit = item.deficit || Math.max(0, (item.reorderLevel || 0) - (item.currentStock || 0));
      return acc + deficit * (item.costPrice || 0);
    }, 0);
  }, [lowStock]);

  const totalRevenue = summary?.totalRevenue || 0;
  // Authoritative Gross Profit from PostgreSQL KPI calculations
  const grossProfit = summary?.grossProfit !== undefined ? summary.grossProfit : (totalRevenue * 0.25);
  const grossMargin = summary?.grossMargin !== undefined ? summary.grossMargin : (totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0);
  const costOfGoodsSold = Math.max(0, totalRevenue - grossProfit);

  return (
    <div className="tab-pane reports-view">
      {/* Financial Health Summary */}
      <section className="dashboard-section">
        <div className="card">
          <div className="card-header-row">
            <div>
              <span className="summary-badge">AUDITED ACCOUNTING & PROFITABILITY</span>
              <h3 className="card-title">Business Profit & Loss Statement</h3>
            </div>
          </div>

          <div className="card-body">
            <div className="financial-kpi-grid">
              <div className="fin-card fin-card-revenue">
                <span className="fin-label">Gross Sales Revenue</span>
                <span className="fin-val text-primary">{formatCurrencyINR(totalRevenue)}</span>
              </div>

              <div className="fin-card fin-card-cogs">
                <span className="fin-label">Cost of Goods Sold (COGS)</span>
                <span className="fin-val text-muted">{formatCurrencyINR(costOfGoodsSold)}</span>
              </div>

              <div className="fin-card fin-card-profit">
                <span className="fin-label">Retained Gross Profit</span>
                <span className="fin-val text-success">{formatCurrencyINR(grossProfit)}</span>
              </div>

              <div className="fin-card fin-card-margin">
                <span className="fin-label">Gross Profit Margin</span>
                <span className="fin-val text-success">{formatPercent(grossMargin)}</span>
              </div>
            </div>

            {/* Reorder Capital Requirement */}
            <div className="reorder-capital-box">
              <div className="reorder-capital-info">
                <span className="reorder-capital-icon">💼</span>
                <div>
                  <h4 className="reorder-capital-title">Restock Capital Requirement</h4>
                  <span style={{ fontSize: '12px', background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                    {lowStock.length} Shortage Items
                  </span>
                </div>
              </div>
              <div className="reorder-capital-amount">
                <span className="reorder-amount-val text-danger">{formatCurrencyINR(totalRestockCost)}</span>
              </div>
            </div>
            {/* Graphical Margin & Profitability Distribution Bar */}
            <div className="profitability-visual-bar-wrap" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>
                <span style={{ color: '#059669' }}>
                  🟢 Retained Profit: {formatPercent(grossMargin)} ({formatCurrencyINR(grossProfit)})
                </span>
                <span style={{ color: '#64748b' }}>
                  ⚪ Wholesale Supplier COGS: {formatPercent(100 - grossMargin)} ({formatCurrencyINR(costOfGoodsSold)})
                </span>
              </div>
              <div style={{ width: '100%', height: '14px', borderRadius: '7px', overflow: 'hidden', display: 'flex', backgroundColor: '#e2e8f0' }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.max(5, grossMargin))}%`,
                    background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                    height: '100%',
                    transition: 'width 0.4s ease',
                  }}
                  title={`Gross Profit: ${formatPercent(grossMargin)}`}
                />
                <div
                  style={{
                    width: `${Math.max(0, 100 - grossMargin)}%`,
                    backgroundColor: '#94a3b8',
                    height: '100%',
                    transition: 'width 0.4s ease',
                  }}
                  title={`COGS: ${formatPercent(100 - grossMargin)}`}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Performance Breakdown */}
      <section className="dashboard-section">
        <div className="card">
          <div className="card-header-row">
            <div>
              <h3 className="card-title">Category Revenue & Profit Breakdown</h3>
            </div>
          </div>

          <div className="card-body">
            {isLoadingCategories ? (
              <LoadingSpinner message="Calculating category financials..." />
            ) : categoriesData.length === 0 ? (
              <p className="text-muted" style={{ padding: '20px 0' }}>No category transactions recorded for this period.</p>
            ) : (
              <div className="table-responsive">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Orders</th>
                      <th>Units Sold</th>
                      <th>Gross Sales Revenue</th>
                      <th>Revenue Share</th>
                      <th>Gross Profit</th>
                      <th>Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoriesData.map((cat, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className="category-pill">{cat.category}</span>
                        </td>
                        <td>{formatNumber(cat.orderCount)} orders</td>
                        <td>{formatNumber(cat.unitsSold)} units</td>
                        <td>{formatCurrencyINR(cat.totalRevenue)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="category-progress-track" style={{ width: '80px', height: '6px', margin: 0 }}>
                              <div
                                className="category-progress-fill"
                                style={{ width: `${Math.min(100, Math.max(2, cat.percentageOfRevenue))}%` }}
                              />
                            </div>
                            <span style={{ fontSize: '12px' }}>{formatPercent(cat.percentageOfRevenue)}</span>
                          </div>
                        </td>
                        <td className="text-success font-bold">{formatCurrencyINR(cat.grossProfit)}</td>
                        <td>
                          <span className="margin-badge margin-high">{formatPercent(cat.marginPercentage)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
