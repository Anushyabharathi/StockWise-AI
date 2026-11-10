import React, { useState, useMemo } from 'react';
import { formatCurrencyINR, formatNumber } from '../../utils/formatters';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function LowStockTable({
  inventory = [],
  isLoading,
  initialFilter = 'ALL',
  onSelectProduct,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [prevFilter, setPrevFilter] = useState(initialFilter);
  const [selectedStatus, setSelectedStatus] = useState(initialFilter);

  // Sync if initialFilter prop changes externally (e.g. from Attention section click)
  if (prevFilter !== initialFilter) {
    setPrevFilter(initialFilter);
    setSelectedStatus(initialFilter);
  }

  // Filter inventory items
  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        searchTerm === '' ||
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        selectedStatus === 'ALL' ||
        item.stockStatus === selectedStatus ||
        (selectedStatus === 'LOW' && item.stockStatus !== 'OUT_OF_STOCK');

      return matchesSearch && matchesStatus;
    });
  }, [inventory, searchTerm, selectedStatus]);

  // Counts by status
  const { outCount, critCount, lowCount } = useMemo(() => {
    let outCount = 0;
    let critCount = 0;
    let lowCount = 0;
    inventory.forEach((i) => {
      if (i.currentStock === 0) outCount++;
      else if (i.stockStatus === 'CRITICAL') critCount++;
      else lowCount++;
    });
    return { outCount, critCount, lowCount };
  }, [inventory]);

  const statusBadge = (status, currentStock) => {
    if (currentStock === 0) {
      return (
        <span className="status-pill status-pill-danger">
          <span className="pill-dot"></span> Out of Stock (0)
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
    return (
      <span className="status-pill status-pill-caution">
        <span className="pill-dot"></span> Running Low
      </span>
    );
  };

  return (
    <div className="card low-stock-card">
      <div className="card-header-row">
        <div>
          <h3 className="card-title">Inventory Health & Reorder List</h3>
          <p className="card-subtitle plain-explanation">
            📋 Items at or below their safety reorder thresholds. Order items before stock reaches 0.
          </p>
        </div>

        <div className="table-controls">
          <input
            type="text"
            placeholder="Search product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            aria-label="Search low-stock products"
          />

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="filter-select"
            aria-label="Filter by stock status"
          >
            <option value="ALL">All Items ({inventory.length})</option>
            <option value="OUT_OF_STOCK">Out of Stock ({outCount})</option>
            <option value="CRITICAL">Critical Low ({critCount})</option>
            <option value="LOW">Running Low ({lowCount})</option>
          </select>
        </div>
      </div>

      {/* Plain-Language Deficit Explainer Bar */}
      <div className="deficit-explainer-bar">
        <span>💡 <strong>What is Deficit?</strong> Deficit is the exact number of extra units you need to purchase from suppliers to reach your safe target level.</span>
      </div>

      <div className="card-body">
        {isLoading ? (
          <LoadingSpinner message="Checking warehouse inventory levels..." />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            title={inventory.length === 0 ? 'All Inventory Safe & Sound' : 'No Matching Products'}
            message={
              inventory.length === 0
                ? 'Great news! All products in your store are currently stocked above their reorder safety thresholds.'
                : 'No inventory items match your current search or filter selection.'
            }
            icon={inventory.length === 0 ? '✅' : '🔍'}
          />
        ) : (
          <div className="table-responsive">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Safety Reorder Level</th>
                  <th>Deficit (Units Needed)</th>
                  <th>Wholesale Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.productId}
                    className={`row-status-${item.stockStatus?.toLowerCase()} ${onSelectProduct ? 'row-clickable' : ''}`}
                    onClick={() => onSelectProduct && onSelectProduct(item)}
                    title={onSelectProduct ? 'Click to view product economics' : undefined}
                  >
                    <td className="product-name-cell">
                      <strong>{item.productName}</strong>
                      {onSelectProduct && <span className="cell-click-hint">view details</span>}
                    </td>
                    <td>
                      <span className="category-pill">{item.category}</span>
                    </td>
                    <td className="quantity-cell">
                      <span className={`stock-number ${item.currentStock === 0 ? 'text-danger font-bold' : ''}`}>
                        {formatNumber(item.currentStock)} units
                      </span>
                    </td>
                    <td className="reorder-cell">{formatNumber(item.reorderLevel)} units</td>
                    <td className="deficit-cell">
                      <span className="deficit-tag">+{formatNumber(item.deficit)} needed</span>
                    </td>
                    <td className="price-cell">{formatCurrencyINR(item.costPrice)}</td>
                    <td>{statusBadge(item.stockStatus, item.currentStock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
