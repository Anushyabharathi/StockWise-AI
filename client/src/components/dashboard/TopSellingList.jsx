import React, { useState, useMemo } from 'react';
import { formatCurrencyINR, formatNumber, formatPercent } from '../../utils/formatters';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function TopSellingList({ products = [], isLoading, compact = false, onSelectProduct }) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [products]);

  // Filter products by category & search term
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchesSearch =
        searchTerm === '' ||
        p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  const maxUnits = useMemo(() => {
    if (filteredProducts.length === 0) return 1;
    return Math.max(...filteredProducts.map((p) => p.unitsSold || 0), 1);
  }, [filteredProducts]);

  return (
    <div className="card top-selling-card">
      <div className="card-header-row">
        <div>
          <h3 className="card-title">Best-Selling Products</h3>
        </div>

        <div className="table-controls">
          {!compact && (
            <input
              type="text"
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              aria-label="Search best-selling products"
            />
          )}

          {categories.length > 2 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select"
              aria-label="Filter products by category"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="card-body">
        {isLoading ? (
          <LoadingSpinner message="Checking best-selling products..." />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title="No Matching Products"
            message={
              products.length === 0
                ? 'No sales records found in the database.'
                : 'No products match your search or category filter.'
            }
            icon="📦"
          />
        ) : (
          <div className="top-selling-list">
            {filteredProducts.map((p, index) => {
              const percentOfMax = Math.min(100, Math.round(((p.unitsSold || 0) / maxUnits) * 100));
              const isTopThree = index < 3;

              return (
                <div
                  key={p.productId || index}
                  className={`top-selling-item ${onSelectProduct ? 'item-clickable' : ''}`}
                  onClick={() => onSelectProduct && onSelectProduct(p)}
                  role={onSelectProduct ? 'button' : undefined}
                  tabIndex={onSelectProduct ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onSelectProduct && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onSelectProduct(p);
                    }
                  }}
                  title="Click to view pricing, cost, and gross profit details"
                >
                  <div className="item-rank-col">
                    <span className={`rank-badge ${isTopThree ? `rank-${index + 1}` : ''}`}>
                      #{index + 1}
                    </span>
                  </div>

                  <div className="item-info-col">
                    <div className="item-name-row">
                      <span className="item-name">{p.productName}</span>
                      <span className="item-category-tag">{p.category}</span>
                    </div>

                    <div className="item-progress-track">
                      <div
                        className="item-progress-fill"
                        style={{ width: `${Math.max(4, percentOfMax)}%` }}
                      />
                    </div>

                    <div className="item-sub-meta">
                      <span>Selling Price: {formatCurrencyINR(p.sellingPrice)}</span>
                      <span>Supplier Cost: {formatCurrencyINR(p.costPrice)}</span>
                    </div>
                  </div>

                  <div className="item-metrics-col">
                    <div className="metric-primary">
                      <span className="units-count">{formatNumber(p.unitsSold)}</span>
                      <span className="units-label">units sold</span>
                    </div>
                    <div className="metric-secondary">
                      <span className="revenue-val">{formatCurrencyINR(p.totalRevenue)}</span>
                      {p.marginPercentage !== undefined && (
                        <span
                          className={`margin-badge ${
                            p.marginPercentage >= 20
                              ? 'margin-high'
                              : p.marginPercentage >= 10
                              ? 'margin-med'
                              : 'margin-low'
                          }`}
                          title={`Profit: ${formatCurrencyINR(p.totalProfit)}`}
                        >
                          {formatPercent(p.marginPercentage)} margin
                        </span>
                      )}
                    </div>
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
