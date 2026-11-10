import React, { useState, useEffect, useCallback } from 'react';
import { getSales, exportSalesCsv } from '../../api/client';
import { formatCurrencyINR, formatNumber, formatPercent, formatDateTime } from '../../utils/formatters';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { SaleDetailModal } from './SaleDetailModal';

/**
 * Enterprise Sales Transactions Ledger with pagination, search, sorting,
 * line-item inspection, and CSV export.
 *
 * @param {{
 *   dateRange: { startDate: string|null, endDate: string|null, label: string }
 * }} props
 */
export function SalesTransactionsTable({ dateRange }) {
  const [salesData, setSalesData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalRecords: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Filters & Sorting state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('sale_date');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [selectedSale, setSelectedSale] = useState(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch sales records
  const fetchSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getSales({
        page: pagination.page,
        limit: pagination.limit,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });

      setSalesData(res.data || []);
      setSummary(res.summary || null);
      if (res.pagination) {
        setPagination((prev) => ({
          ...prev,
          totalRecords: res.pagination.totalRecords || 0,
          totalPages: res.pagination.totalPages || 1,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch sales transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, dateRange.startDate, dateRange.endDate, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // CSV Export handler
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      await exportSalesCsv({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });
    } catch (err) {
      console.error('CSV Export failed:', err);
      setExportError(err.message || 'CSV Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (e) => {
    const newLimit = parseInt(e.target.value, 10);
    setPagination((prev) => ({ ...prev, page: 1, limit: newLimit }));
  };

  const handleSortChange = (e) => {
    const val = e.target.value;
    if (val === 'date_desc') {
      setSortBy('sale_date');
      setSortOrder('DESC');
    } else if (val === 'date_asc') {
      setSortBy('sale_date');
      setSortOrder('ASC');
    } else if (val === 'amount_desc') {
      setSortBy('total_amount');
      setSortOrder('DESC');
    } else if (val === 'amount_asc') {
      setSortBy('total_amount');
      setSortOrder('ASC');
    } else if (val === 'id_desc') {
      setSortBy('sale_id');
      setSortOrder('DESC');
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const startRecord = pagination.totalRecords === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endRecord = Math.min(pagination.page * pagination.limit, pagination.totalRecords);

  return (
    <div className="card sales-transactions-card">
      <div className="card-header-row">
        <div>
          <div className="header-badge-row">
            <span className="summary-badge">SALES AUDIT & LEDGER</span>
          </div>
          <h3 className="card-title">Sales Ledger & Order Reports</h3>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn btn-primary export-btn"
            onClick={handleExportCsv}
            disabled={isExporting || pagination.totalRecords === 0}
            title="Download CSV spreadsheet of all matching sales"
          >
            <span className="btn-icon">{isExporting ? '⏳' : '📥'}</span>
            <span>{isExporting ? 'Exporting CSV...' : 'Export to CSV'}</span>
          </button>
        </div>
      </div>

      {exportError && (
        <div className="banner-alert banner-alert-danger" style={{ margin: '0 24px 16px' }}>
          <span>⚠️ {exportError}</span>
        </div>
      )}

      {/* Filtered Telemetry Summary Bar */}
      {summary && (
        <div className="sales-telemetry-ribbon">
          <div className="telemetry-item">
            <span className="telemetry-label">Completed Orders</span>
            <span className="telemetry-val text-primary">{formatNumber(summary.totalOrders)}</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-label">Total Revenue</span>
            <span className="telemetry-val text-success">{formatCurrencyINR(summary.totalRevenue)}</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-label">Units Sold</span>
            <span className="telemetry-val">{formatNumber(summary.totalUnits)} items</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-label">Retained Profit</span>
            <span className="telemetry-val text-success">{formatCurrencyINR(summary.totalProfit)}</span>
          </div>
          <div className="telemetry-item">
            <span className="telemetry-label">Reconciliation</span>
            {summary.discrepancyOrdersCount === 0 ? (
              <span className="telemetry-val text-success" title="Header amounts and line item calculations match 100%">
                &check; 100% Reconciled
              </span>
            ) : (
              <span className="telemetry-val text-danger">
                ⚠️ {summary.discrepancyOrdersCount} Discrepancies
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="sales-filters-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by Order ID or Product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search sales transactions"
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
            <label htmlFor="sales-sort-select" className="select-label">Sort:</label>
            <select
              id="sales-sort-select"
              className="filter-select"
              onChange={handleSortChange}
              value={
                sortBy === 'sale_date' && sortOrder === 'DESC'
                  ? 'date_desc'
                  : sortBy === 'sale_date' && sortOrder === 'ASC'
                  ? 'date_asc'
                  : sortBy === 'total_amount' && sortOrder === 'DESC'
                  ? 'amount_desc'
                  : sortBy === 'total_amount' && sortOrder === 'ASC'
                  ? 'amount_asc'
                  : 'id_desc'
              }
            >
              <option value="date_desc">Date: Newest First</option>
              <option value="date_asc">Date: Oldest First</option>
              <option value="amount_desc">Amount: Highest First</option>
              <option value="amount_asc">Amount: Lowest First</option>
              <option value="id_desc">Order ID: Highest</option>
            </select>
          </div>

          <div className="select-group">
            <label htmlFor="sales-limit-select" className="select-label">Rows:</label>
            <select
              id="sales-limit-select"
              className="filter-select"
              value={pagination.limit}
              onChange={handleLimitChange}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Transactions Table */}
      <div className="card-body">
        {isLoading ? (
          <LoadingSpinner message="Loading sales transactions ledger..." />
        ) : salesData.length === 0 ? (
          <EmptyState
            title="No Sales Transactions Found"
            message={
              debouncedSearch
                ? `No sales matched "${debouncedSearch}". Try searching for another product or order ID.`
                : 'No sales transactions were recorded for this selected time period.'
            }
            icon="🧾"
          />
        ) : (
          <div className="table-responsive">
            <table className="inventory-table sales-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date & Time</th>
                  <th>Items Included</th>
                  <th>Units</th>
                  <th>Order Revenue</th>
                  <th>Gross Profit</th>
                  <th>Margin</th>
                  <th>Reconciliation</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map((sale) => {
                  const margin = sale.calculatedTotal > 0 ? (sale.grossProfit / sale.calculatedTotal) * 100 : 0;
                  const productPreview = sale.items
                    .slice(0, 2)
                    .map((it) => `${it.productName} (${it.quantity}x)`)
                    .join(', ');
                  const remainingCount = sale.items.length - 2;

                  return (
                    <tr
                      key={sale.saleId}
                      className="row-clickable"
                      onClick={() => setSelectedSale(sale)}
                      title="Click to view detailed item breakdown"
                    >
                      <td className="font-bold text-primary">
                        #{sale.saleId}
                      </td>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                        {formatDateTime(sale.saleDate)}
                      </td>
                      <td className="product-name-cell">
                        <span className="items-preview-text">
                          {productPreview || '—'}
                          {remainingCount > 0 && (
                            <span className="remaining-badge">+{remainingCount} more</span>
                          )}
                        </span>
                      </td>
                      <td className="quantity-cell">
                        {formatNumber(sale.unitsCount)}
                      </td>
                      <td className="font-bold">
                        {formatCurrencyINR(sale.calculatedTotal)}
                      </td>
                      <td className="text-success font-bold">
                        {formatCurrencyINR(sale.grossProfit)}
                      </td>
                      <td>
                        <span className="margin-badge margin-high">
                          {formatPercent(margin)}
                        </span>
                      </td>
                      <td>
                        {sale.hasDiscrepancy ? (
                          <span className="status-pill status-pill-danger" title={`Difference: ₹${sale.discrepancyAmount}`}>
                            <span className="pill-dot"></span> Discrepancy
                          </span>
                        ) : (
                          <span className="status-pill status-pill-healthy" title="Header total matches line item sum">
                            <span className="pill-dot"></span> Reconciled
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(sale);
                          }}
                        >
                          View Details &rarr;
                        </button>
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
              <strong>{formatNumber(pagination.totalRecords)}</strong> transactions
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

      {/* Sale Detail Modal */}
      {selectedSale && (
        <SaleDetailModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </div>
  );
}
