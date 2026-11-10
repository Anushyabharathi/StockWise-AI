import React, { useState, useMemo } from 'react';
import { formatCurrencyINR, formatNumber, formatPercent } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';

const CATEGORY_ICONS = {
  Groceries: '🛒',
  Dairy: '🥛',
  Grains: '🌾',
  Bakery: '🍞',
  Snacks: '🍫',
  Beverages: '🧃',
  Stationery: '✏️',
  Electronics: '⚡',
  Household: '🧼',
  'Personal Care': '🧴',
};

function getCategoryIcon(cat) {
  if (!cat) return '📦';
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (cat.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '📦';
}

/**
 * Power BI / Tableau style Visual Product Overview Grid.
 * Displays products with visual stock gauges, sales volume, margin badges,
 * instant search, category filtering, and status chips.
 *
 * @param {{
 *   products: Array,
 *   selectedCategory?: string|null,
 *   onSelectCategory?: (category: string|null) => void,
 *   onSelectProduct?: (product: Object) => void,
 *   isLoading?: boolean
 * }} props
 */
export function BiProductOverviewGrid({
  products = [],
  selectedCategory = null,
  onSelectCategory,
  onSelectProduct,
  isLoading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'TOP' | 'LOW' | 'HEALTHY'
  const [displayMode, setDisplayMode] = useState('grid'); // 'grid' | 'table'

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategory && p.category !== selectedCategory) return false;

      // Status filter
      if (statusFilter === 'TOP' && (p.unitsSold || 0) < 5000) return false;
      if (statusFilter === 'LOW' && p.stockStatus !== 'LOW' && p.stockStatus !== 'CRITICAL' && p.stockStatus !== 'OUT_OF_STOCK') {
        return false;
      }
      if (statusFilter === 'HEALTHY' && p.stockStatus !== 'HEALTHY') return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = p.productName?.toLowerCase().includes(query);
        const matchesCat = p.category?.toLowerCase().includes(query);
        const matchesSku = String(p.productId).includes(query);
        return matchesName || matchesCat || matchesSku;
      }

      return true;
    });
  }, [products, selectedCategory, statusFilter, searchTerm]);

  // Calculate highest revenue for visual gauge
  const maxRevenue = useMemo(() => {
    if (products.length === 0) return 1;
    return Math.max(...products.map((p) => p.totalRevenue || 0), 1);
  }, [products]);

  return (
    <div className="card bi-product-overview-card">
      {/* Header & Controls Toolbar */}
      <div className="card-header-row bi-overview-header">
        <div>
          <div className="header-badge-row">
            <span className="bi-badge">CATALOG INTELLIGENCE</span>
            <span className="bi-count-pill">{filteredProducts.length} Products</span>
          </div>
          <h3 className="card-title">Interactive Product Performance & Stock Explorer</h3>
        </div>

        {/* Toolbar */}
        <div className="bi-overview-toolbar">
          {/* Search box */}
          <div className="bi-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="bi-search-input"
              placeholder="Search products or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search products"
            />
            {searchTerm && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                &times;
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <select
            className="bi-select"
            value={selectedCategory || 'ALL'}
            onChange={(e) => {
              const val = e.target.value;
              if (onSelectCategory) {
                onSelectCategory(val === 'ALL' ? null : val);
              }
            }}
            aria-label="Filter category"
          >
            <option value="ALL">All Departments</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Quick Status Filter Pills */}
          <div className="bi-pill-group" role="group" aria-label="Status filter">
            <button
              type="button"
              className={`bi-pill-btn ${statusFilter === 'ALL' ? 'bi-pill-active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All
            </button>
            <button
              type="button"
              className={`bi-pill-btn ${statusFilter === 'TOP' ? 'bi-pill-active' : ''}`}
              onClick={() => setStatusFilter('TOP')}
              title="Filter best selling products"
            >
              🔥 Best Sellers
            </button>
            <button
              type="button"
              className={`bi-pill-btn ${statusFilter === 'LOW' ? 'bi-pill-active' : ''}`}
              onClick={() => setStatusFilter('LOW')}
              title="Filter low and out of stock items"
            >
              ⚠️ Stock Shortages
            </button>
          </div>

          {/* View Toggle */}
          <div className="bi-view-toggle" role="group" aria-label="Display mode">
            <button
              type="button"
              className={`view-toggle-btn ${displayMode === 'grid' ? 'active' : ''}`}
              onClick={() => setDisplayMode('grid')}
              title="Visual Cards View"
            >
              ⊞ Grid
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${displayMode === 'table' ? 'active' : ''}`}
              onClick={() => setDisplayMode('table')}
              title="Compact Table View"
            >
              ≡ Table
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="card-body bi-overview-body">
        {isLoading ? (
          <LoadingSpinner message="Loading visual product catalog..." />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title="No Matching Products"
            message="No products match your active search or filter criteria."
            icon="🔍"
          />
        ) : displayMode === 'grid' ? (
          /* Visual Product Cards Grid */
          <div className="bi-product-grid-container">
            {filteredProducts.map((p, idx) => {
              const icon = getCategoryIcon(p.category);
              const revPercent = Math.min(100, Math.round(((p.totalRevenue || 0) / maxRevenue) * 100));
              const stockRatio = p.reorderLevel > 0 ? (p.currentStock / p.reorderLevel) : 1;
              const isLow = p.stockStatus === 'LOW' || p.stockStatus === 'CRITICAL' || p.currentStock === 0;

              return (
                <div
                  key={p.productId || idx}
                  className={`bi-product-card ${onSelectProduct ? 'bi-card-clickable' : ''}`}
                  onClick={() => onSelectProduct && onSelectProduct(p)}
                  role={onSelectProduct ? 'button' : undefined}
                  tabIndex={onSelectProduct ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onSelectProduct && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onSelectProduct(p);
                    }
                  }}
                  title="Click to view detailed unit economics and AI advice"
                >
                  {/* Top Row: Icon, Title, Category */}
                  <div className="bi-prod-top">
                    <div className="bi-prod-icon-box">{icon}</div>
                    <div className="bi-prod-meta">
                      <div className="bi-prod-category">{p.category}</div>
                      <h4 className="bi-prod-name" title={p.productName}>
                        {p.productName}
                      </h4>
                      <span className="bi-prod-sku">SKU #{p.productId}</span>
                    </div>
                    {/* Performance Badge */}
                    <div className="bi-prod-badge-wrap">
                      {p.currentStock === 0 ? (
                        <span className="status-badge-chip badge-danger">Out of Stock</span>
                      ) : p.stockStatus === 'CRITICAL' ? (
                        <span className="status-badge-chip badge-critical">Critical Low</span>
                      ) : p.stockStatus === 'LOW' ? (
                        <span className="status-badge-chip badge-warning">Low Stock</span>
                      ) : (p.unitsSold || 0) >= 5000 ? (
                        <span className="status-badge-chip badge-leader">🔥 Best Seller</span>
                      ) : (
                        <span className="status-badge-chip badge-healthy">Healthy</span>
                      )}
                    </div>
                  </div>

                  {/* Revenue Relative Gauge */}
                  <div className="bi-prod-revenue-bar">
                    <div className="rev-bar-track">
                      <div className="rev-bar-fill" style={{ width: `${Math.max(6, revPercent)}%` }} />
                    </div>
                    <div className="rev-bar-labels">
                      <span className="rev-label-text">Sales Revenue</span>
                      <span className="rev-val-text">{formatCurrencyINR(p.totalRevenue)}</span>
                    </div>
                  </div>

                  {/* Metric Chips Row */}
                  <div className="bi-prod-chips-grid">
                    <div className="prod-chip">
                      <span className="chip-label">Units Sold</span>
                      <span className="chip-value">{formatNumber(p.unitsSold)}</span>
                    </div>

                    <div className="prod-chip">
                      <span className="chip-label">On Hand</span>
                      <span className={`chip-value font-bold ${isLow ? 'text-danger' : 'text-success'}`}>
                        {formatNumber(p.currentStock)} units
                      </span>
                    </div>

                    <div className="prod-chip">
                      <span className="chip-label">Profit Margin</span>
                      <span className={`chip-value font-bold ${p.marginPercentage >= 20 ? 'text-success' : 'text-purple'}`}>
                        {formatPercent(p.marginPercentage)}
                      </span>
                    </div>
                  </div>

                  {/* Stock Buffer Status Meter */}
                  <div className="bi-prod-stock-meter">
                    <div className="stock-meter-label">
                      <span>Safety Buffer ({p.reorderLevel} min)</span>
                      <span className={stockRatio < 1 ? 'text-warning' : 'text-muted'}>
                        {Math.round(stockRatio * 100)}% of buffer
                      </span>
                    </div>
                    <div className="stock-meter-track">
                      <div
                        className={`stock-meter-fill ${
                          p.currentStock === 0
                            ? 'meter-out'
                            : stockRatio < 0.5
                            ? 'meter-critical'
                            : stockRatio < 1
                            ? 'meter-low'
                            : 'meter-healthy'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, stockRatio * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Card Footer Hint */}
                  <div className="bi-prod-footer">
                    <span className="footer-prices">
                      Sell: {formatCurrencyINR(p.sellingPrice)} &bull; Cost: {formatCurrencyINR(p.costPrice)}
                    </span>
                    <span className="footer-action">Details &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Compact Table View */
          <div className="bi-table-container">
            <table className="bi-overview-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Department</th>
                  <th className="text-right">Stock On Hand</th>
                  <th className="text-right">Safety Buffer</th>
                  <th className="text-right">Units Sold</th>
                  <th className="text-right">Total Revenue</th>
                  <th className="text-right">Gross Profit</th>
                  <th className="text-center">Margin</th>
                  <th className="text-center">Stock Health</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const icon = getCategoryIcon(p.category);
                  const isLow = p.stockStatus === 'LOW' || p.stockStatus === 'CRITICAL' || p.currentStock === 0;

                  return (
                    <tr
                      key={p.productId}
                      className="bi-table-row-clickable"
                      onClick={() => onSelectProduct && onSelectProduct(p)}
                    >
                      <td>
                        <div className="table-product-name-cell">
                          <span className="table-icon">{icon}</span>
                          <div>
                            <strong>{p.productName}</strong>
                            <div className="text-muted text-xs">SKU #{p.productId}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="bi-tag">{p.category}</span>
                      </td>
                      <td className={`text-right font-bold ${isLow ? 'text-danger' : 'text-success'}`}>
                        {formatNumber(p.currentStock)}
                      </td>
                      <td className="text-right text-muted">{formatNumber(p.reorderLevel)}</td>
                      <td className="text-right font-medium">{formatNumber(p.unitsSold)}</td>
                      <td className="text-right font-bold text-success">
                        {formatCurrencyINR(p.totalRevenue)}
                      </td>
                      <td className="text-right font-medium text-purple">
                        {formatCurrencyINR(p.totalProfit)}
                      </td>
                      <td className="text-center">
                        <span className={`margin-badge ${p.marginPercentage >= 20 ? 'margin-high' : 'margin-med'}`}>
                          {formatPercent(p.marginPercentage)}
                        </span>
                      </td>
                      <td className="text-center">
                        {p.currentStock === 0 ? (
                          <span className="status-badge-chip badge-danger">Out of Stock</span>
                        ) : p.stockStatus === 'CRITICAL' ? (
                          <span className="status-badge-chip badge-critical">Critical Low</span>
                        ) : p.stockStatus === 'LOW' ? (
                          <span className="status-badge-chip badge-warning">Low Stock</span>
                        ) : (
                          <span className="status-badge-chip badge-healthy">Healthy</span>
                        )}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectProduct) onSelectProduct(p);
                          }}
                        >
                          View &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
