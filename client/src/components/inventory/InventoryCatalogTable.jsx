import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getFullInventory } from '../../api/client';
import { formatCurrencyINR, formatNumber, formatPercent } from '../../utils/formatters';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';

/**
 * Enterprise Warehouse Inventory Catalog with status counters, search,
 * category filtering, sorting, deficit calculation, and pagination.
 *
 * @param {{
 *   initialFilter?: 'ALL' | 'HEALTHY' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK',
 *   onSelectProduct?: (product: Object) => void
 * }} props
 */
export function InventoryCatalogTable({ initialFilter = 'ALL', onSelectProduct }) {
  const [inventoryData, setInventoryData] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    total: 0,
    healthy: 0,
    low: 0,
    critical: 0,
    outOfStock: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalRecords: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [activeStatus, setActiveStatus] = useState(initialFilter);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState('deficit');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Sync initialFilter prop if it changes externally
  useEffect(() => {
    if (initialFilter) {
      setActiveStatus(initialFilter);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [initialFilter]);

  // Fetch full inventory catalogue
  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getFullInventory({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch,
        category: category === 'ALL' ? null : category,
        status: activeStatus,
        sortBy,
        sortOrder,
      });

      setInventoryData(res.data || []);
      if (res.statusCounts) {
        setStatusCounts(res.statusCounts);
      }
      if (res.pagination) {
        setPagination((prev) => ({
          ...prev,
          totalRecords: res.pagination.totalRecords || 0,
          totalPages: res.pagination.totalPages || 1,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch inventory catalog:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, category, activeStatus, sortBy, sortOrder]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleStatusTab = (status) => {
    setActiveStatus(status);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSortChange = (e) => {
    const val = e.target.value;
    if (val === 'deficit_desc') {
      setSortBy('deficit');
      setSortOrder('DESC');
    } else if (val === 'stock_asc') {
      setSortBy('current_stock');
      setSortOrder('ASC');
    } else if (val === 'reorder_desc') {
      setSortBy('reorder_level');
      setSortOrder('DESC');
    } else if (val === 'price_desc') {
      setSortBy('selling_price');
      setSortOrder('DESC');
    } else if (val === 'name_asc') {
      setSortBy('product_name');
      setSortOrder('ASC');
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  // Derive unique categories from current items or standard list
  const categoryOptions = useMemo(() => {
    const set = new Set();
    inventoryData.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [inventoryData]);

  const renderStatusBadge = (status, currentStock) => {
    if (status === 'OUT_OF_STOCK' || currentStock === 0) {
      return (
        <span className="status-pill status-pill-danger">
          <span className="pill-dot"></span> Out of Stock
        </span>
      );
    }
    if (status === 'CRITICAL') {
      return (
        <span className="status-pill status-pill-warning">
          <span className="pill-dot"></span> Critical (&le; 50%)
        </span>
      );
    }
    if (status === 'LOW') {
      return (
        <span className="status-pill status-pill-caution">
          <span className="pill-dot"></span> Running Low
        </span>
      );
    }
    return (
      <span className="status-pill status-pill-healthy">
        <span className="pill-dot"></span> Healthy Stock
      </span>
    );
  };

  const startRecord = pagination.totalRecords === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endRecord = Math.min(pagination.page * pagination.limit, pagination.totalRecords);

  return (
    <div className="card inventory-catalog-card">
      <div className="card-header-row">
        <div>
          <div className="header-badge-row">
            <span className="summary-badge">WAREHOUSE & REORDER TELEMETRY</span>
          </div>
          <h3 className="card-title">Warehouse Inventory Management</h3>
        </div>
      </div>

      {/* Warehouse Status Pill Filter Tabs */}
      <div className="warehouse-status-tabs" role="tablist" aria-label="Inventory status filters">
        <button
          type="button"
          className={`status-tab-btn ${activeStatus === 'ALL' ? 'status-tab-active' : ''}`}
          onClick={() => handleStatusTab('ALL')}
        >
          <span className="tab-label">All Products</span>
          <span className="tab-count">{formatNumber(statusCounts.total)}</span>
        </button>

        <button
          type="button"
          className={`status-tab-btn status-tab-healthy ${activeStatus === 'HEALTHY' ? 'status-tab-active' : ''}`}
          onClick={() => handleStatusTab('HEALTHY')}
        >
          <span className="tab-dot dot-healthy"></span>
          <span className="tab-label">Healthy Stock</span>
          <span className="tab-count count-healthy">{formatNumber(statusCounts.healthy)}</span>
        </button>

        <button
          type="button"
          className={`status-tab-btn status-tab-low ${activeStatus === 'LOW' ? 'status-tab-active' : ''}`}
          onClick={() => handleStatusTab('LOW')}
        >
          <span className="tab-dot dot-low"></span>
          <span className="tab-label">Running Low</span>
          <span className="tab-count count-low">{formatNumber(statusCounts.low)}</span>
        </button>

        <button
          type="button"
          className={`status-tab-btn status-tab-critical ${activeStatus === 'CRITICAL' ? 'status-tab-active' : ''}`}
          onClick={() => handleStatusTab('CRITICAL')}
        >
          <span className="tab-dot dot-critical"></span>
          <span className="tab-label">Critical Shortage</span>
          <span className="tab-count count-critical">{formatNumber(statusCounts.critical)}</span>
        </button>

        <button
          type="button"
          className={`status-tab-btn status-tab-outofstock ${activeStatus === 'OUT_OF_STOCK' ? 'status-tab-active' : ''}`}
          onClick={() => handleStatusTab('OUT_OF_STOCK')}
        >
          <span className="tab-dot dot-danger"></span>
          <span className="tab-label">Out of Stock</span>
          <span className="tab-count count-danger">{formatNumber(statusCounts.outOfStock)}</span>
        </button>
      </div>

      {/* Graphical Inventory Health Distribution Meter */}
      {statusCounts.total > 0 && (
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#e2e8f0', width: '100%' }}>
            <div
              style={{
                width: `${Math.round(((statusCounts.healthy || 0) / (statusCounts.total || 1)) * 100)}%`,
                backgroundColor: '#10b981',
                transition: 'width 0.4s ease',
              }}
              title={`Healthy: ${formatNumber(statusCounts.healthy)}`}
            />
            <div
              style={{
                width: `${Math.round(((statusCounts.low || 0) / (statusCounts.total || 1)) * 100)}%`,
                backgroundColor: '#f59e0b',
                transition: 'width 0.4s ease',
              }}
              title={`Running Low: ${formatNumber(statusCounts.low)}`}
            />
            <div
              style={{
                width: `${Math.round(((statusCounts.critical || 0) / (statusCounts.total || 1)) * 100)}%`,
                backgroundColor: '#ea580c',
                transition: 'width 0.4s ease',
              }}
              title={`Critical: ${formatNumber(statusCounts.critical)}`}
            />
            <div
              style={{
                width: `${Math.round(((statusCounts.outOfStock || 0) / (statusCounts.total || 1)) * 100)}%`,
                backgroundColor: '#ef4444',
                transition: 'width 0.4s ease',
              }}
              title={`Out of Stock: ${formatNumber(statusCounts.outOfStock)}`}
            />
          </div>
        </div>
      )}

      {/* Filters & Search Controls Bar */}
      <div className="inventory-filters-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search products by title or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search warehouse products"
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        <div className="filters-right">
          <div className="select-group">
            <label htmlFor="inv-cat-select" className="select-label">Category:</label>
            <select
              id="inv-cat-select"
              className="filter-select"
              value={category}
              onChange={handleCategoryChange}
            >
              <option value="ALL">All Categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="select-group">
            <label htmlFor="inv-sort-select" className="select-label">Sort By:</label>
            <select
              id="inv-sort-select"
              className="filter-select"
              value={
                sortBy === 'deficit'
                  ? 'deficit_desc'
                  : sortBy === 'current_stock'
                  ? 'stock_asc'
                  : sortBy === 'reorder_level'
                  ? 'reorder_desc'
                  : sortBy === 'selling_price'
                  ? 'price_desc'
                  : 'name_asc'
              }
              onChange={handleSortChange}
            >
              <option value="deficit_desc">Deficit: Highest Needed</option>
              <option value="stock_asc">Stock: Lowest In Warehouse</option>
              <option value="reorder_desc">Reorder Threshold: Highest</option>
              <option value="price_desc">Price: Highest First</option>
              <option value="name_asc">Product Name: A to Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Inventory Catalogue Table */}
      <div className="card-body">
        {isLoading ? (
          <LoadingSpinner message="Checking warehouse database shelf levels..." />
        ) : inventoryData.length === 0 ? (
          <EmptyState
            title="No Matching Warehouse Items"
            message={
              debouncedSearch
                ? `No products matched "${debouncedSearch}". Try checking spelling or resetting your status filter.`
                : 'No inventory items match this category and status combination.'
            }
            icon="📦"
          />
        ) : (
          <div className="table-responsive">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Safety Level</th>
                  <th>Deficit (Shortage)</th>
                  <th>Wholesale / Retail</th>
                  <th>Unit Margin</th>
                  <th>Status</th>
                  <th>Reorder Guidance</th>
                </tr>
              </thead>
              <tbody>
                {inventoryData.map((item) => {
                  const unitMargin =
                    item.sellingPrice > 0
                      ? ((item.sellingPrice - item.costPrice) / item.sellingPrice) * 100
                      : 0;

                  return (
                    <tr
                      key={item.productId}
                      className={`row-status-${item.stockStatus?.toLowerCase()} ${onSelectProduct ? 'row-clickable' : ''}`}
                      onClick={() => onSelectProduct && onSelectProduct(item)}
                      title={onSelectProduct ? 'Click to inspect product economics & pricing' : undefined}
                    >
                      <td className="product-name-cell">
                        <strong>{item.productName}</strong>
                        <span className="text-muted" style={{ display: 'block', fontSize: '11px' }}>
                          SKU #{item.productId} {onSelectProduct && <span className="cell-click-hint">&bull; view economics</span>}
                        </span>
                      </td>
                      <td>
                        <span className="category-pill">{item.category}</span>
                      </td>
                      <td className="quantity-cell">
                        <span className={`stock-number ${item.currentStock === 0 ? 'text-danger font-bold' : item.stockStatus === 'CRITICAL' ? 'text-warning font-bold' : ''}`}>
                          {formatNumber(item.currentStock)} units
                        </span>
                      </td>
                      <td className="reorder-cell">
                        {formatNumber(item.reorderLevel)} units
                      </td>
                      <td className="deficit-cell">
                        {item.deficit > 0 ? (
                          <span className="deficit-tag">+{formatNumber(item.deficit)} needed</span>
                        ) : (
                          <span className="deficit-tag-safe">&check; Safe</span>
                        )}
                      </td>
                      <td>
                        <div className="price-stack">
                          <span className="cost-price text-muted">Cost: {formatCurrencyINR(item.costPrice)}</span>
                          <span className="sell-price font-bold">Sell: {formatCurrencyINR(item.sellingPrice)}</span>
                        </div>
                      </td>
                      <td>
                        <span className="margin-badge margin-high">
                          {formatPercent(unitMargin)}
                        </span>
                      </td>
                      <td>
                        {renderStatusBadge(item.stockStatus, item.currentStock)}
                      </td>
                      <td className="recommendation-cell">
                        <span className="recommendation-text">{item.reorderRecommendation}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalRecords > 0 && (
          <div className="table-pagination-row">
            <div className="pagination-info">
              Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of{' '}
              <strong>{formatNumber(pagination.totalRecords)}</strong> catalog products
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="btn-page"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
                aria-label="Previous page"
              >
                &larr; Prev
              </button>

              <span className="page-current">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="btn-page"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || isLoading}
                aria-label="Next page"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
