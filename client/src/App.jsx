import React, { useState, useEffect, useCallback } from 'react';
import { BiSidebar } from './components/bi/BiSidebar';
import { Header } from './components/layout/Header';
import { BiKpiRibbon } from './components/bi/BiKpiRibbon';
import { BiRevenueTrendChart } from './components/bi/BiRevenueTrendChart';
import { BiMonthlyComparisonChart } from './components/bi/BiMonthlyComparisonChart';
import { BiCategoryDonutChart } from './components/bi/BiCategoryDonutChart';
import { BiProductPerformanceChart } from './components/bi/BiProductPerformanceChart';
import { BiInventoryChart } from './components/bi/BiInventoryChart';
import { BiWeekdayChart } from './components/bi/BiWeekdayChart';
import { BiProductOverviewGrid } from './components/bi/BiProductOverviewGrid';
import { BiVisualAlertsBar } from './components/bi/BiVisualAlertsBar';
import { TopSellingList } from './components/dashboard/TopSellingList';
import { ReportsView } from './components/dashboard/ReportsView';
import { BiProductDetailModal } from './components/bi/BiProductDetailModal';
import { BiAiAdvisorModal } from './components/bi/BiAiAdvisorModal';
import { BiApiUsageView } from './components/bi/BiApiUsageView';
import { ErrorBanner } from './components/common/ErrorBanner';
import { SalesTransactionsTable } from './components/sales/SalesTransactionsTable';
import { InventoryCatalogTable } from './components/inventory/InventoryCatalogTable';
import { LoginPage } from './components/auth/LoginPage';
import { ActivityLogsModal } from './components/auth/ActivityLogsModal';
import {
  getHealthStatus,
  getDashboardSummary,
  getTrends,
  getCategories,
  getDistribution,
  getTopSelling,
  getLowStock,
  getStoredAdmin,
  getCurrentAdmin,
  logoutAdmin,
} from './api/client';
import './App.css';

export function App() {
  const [currentTab, setCurrentTab] = useState('overview');
  const [activeTrendPeriod, setActiveTrendPeriod] = useState('monthly');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Shop Admin & Security State
  const [admin, setAdmin] = useState(getStoredAdmin());

  // Date range state
  const [dateRange, setDateRange] = useState({
    preset: 'all',
    startDate: null,
    endDate: null,
    label: 'All Time',
  });

  // Cross-filtering: selected category across charts and tables
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Dedicated inventory sub-filter (e.g. when jumping from an alert)
  const [inventoryInitialFilter, setInventoryInitialFilter] = useState('ALL');

  // Selected product for detail modal
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Data states
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [categories, setCategories] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [error, setError] = useState(null);

  // Listen for unauthorized events to trigger immediate logout and redirect to login page
  useEffect(() => {
    const handleUnauthorized = () => {
      setAdmin(null);
    };
    window.addEventListener('stockwise:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('stockwise:unauthorized', handleUnauthorized);
    };
  }, []);

  // Verify and refresh current admin session on mount
  useEffect(() => {
    let ignore = false;
    async function verifyAuth() {
      // Check backend health
      try {
        const h = await getHealthStatus();
        if (!ignore) setHealth(h);
      } catch {
        // Handled silently
      }

      const verified = await getCurrentAdmin();
      if (!ignore) {
        setAdmin(verified);
        if (!verified) {
          setIsInitialLoading(false);
        }
      }
    }
    verifyAuth();
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch all dashboard data concurrently
  const loadDashboardData = useCallback(async (isManualRefresh = false, overrideRange = null) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const activeRange = overrideRange || dateRange;
      const { startDate, endDate } = activeRange;

      const [
        healthRes,
        summaryResult,
        trendsResult,
        monthlyTrendsResult,
        categoriesResult,
        distributionResult,
        productsResult,
        inventoryResult,
      ] = await Promise.allSettled([
        getHealthStatus(),
        getDashboardSummary({ startDate, endDate }),
        getTrends(activeTrendPeriod, { startDate, endDate, limit: 60 }),
        getTrends('monthly', { startDate, endDate, limit: 36 }),
        getCategories({ startDate, endDate, limit: 20 }),
        getDistribution({ startDate, endDate }),
        getTopSelling({ startDate, endDate, limit: 60, category: selectedCategory }),
        getLowStock({ limit: 100 }),
      ]);

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      }

      let firstError = null;

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
      } else {
        firstError = firstError || summaryResult.reason;
      }

      if (trendsResult.status === 'fulfilled') {
        setTrends(trendsResult.value || []);
      } else {
        firstError = firstError || trendsResult.reason;
      }

      if (monthlyTrendsResult.status === 'fulfilled') {
        setMonthlyTrends(monthlyTrendsResult.value || []);
      }

      if (categoriesResult.status === 'fulfilled') {
        setCategories(categoriesResult.value || []);
      }

      if (distributionResult.status === 'fulfilled') {
        setDistribution(distributionResult.value || []);
      }

      if (productsResult.status === 'fulfilled') {
        setTopProducts(productsResult.value || []);
      } else {
        firstError = firstError || productsResult.reason;
      }

      if (inventoryResult.status === 'fulfilled') {
        setLowStock(inventoryResult.value || []);
      } else {
        firstError = firstError || inventoryResult.reason;
      }

      if (firstError) {
        setError(firstError);
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(err);
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  }, [activeTrendPeriod, dateRange, selectedCategory]);

  // Initial load when admin is authenticated
  useEffect(() => {
    if (!admin) return;
    loadDashboardData(false);
  }, [admin, loadDashboardData]);

  // When date range changes, re-fetch immediately with the new range
  const handleChangeDateRange = (newRange) => {
    setDateRange(newRange);
    loadDashboardData(true, newRange);
  };

  // Handle individual trend period changes smoothly
  const handlePeriodChange = async (newPeriod) => {
    setActiveTrendPeriod(newPeriod);
    try {
      const data = await getTrends(newPeriod, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: 60,
      });
      setTrends(data || []);
    } catch (err) {
      console.error('Failed to update trend period:', err);
    }
  };

  // Navigation handler from KPI cards or alerts
  const handleNavigateTab = (tabName, filterValue = 'ALL') => {
    if (tabName === 'audit') {
      setIsLogsModalOpen(true);
      return;
    }
    if (tabName === 'ai') {
      setIsAiModalOpen(true);
      return;
    }
    setCurrentTab(tabName);
    if (tabName === 'inventory' && filterValue) {
      setInventoryInitialFilter(filterValue);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Admin Logout handler
  const handleLogout = async () => {
    await logoutAdmin();
    setAdmin(null);
  };

  const getPageMeta = () => {
    switch (currentTab) {
      case 'sales':
        return {
          title: 'Sales & Revenue Analytics',
        };
      case 'products':
        return {
          title: 'Product Performance Intelligence',
        };
      case 'inventory':
        return {
          title: 'Warehouse & Stock Buffers',
        };
      case 'reports':
        return {
          title: 'Financial Statements & P&L',
        };
      case 'audit':
        return {
          title: 'Database Security & Audit Logs',
        };
      case 'ai':
        return {
          title: 'AI Business Advisor',
        };
      case 'api-usage':
        return {
          title: 'API Usage & Budget Monitor',
        };
      case 'overview':
      default:
        return {
          title: 'Executive BI Dashboard',
        };
    }
  };

  // Gate the application: if not logged in as admin, show the Shop Admin Login Page
  if (!admin) {
    return (
      <LoginPage
        onLoginSuccess={(newAdmin) => {
          setAdmin(newAdmin);
          loadDashboardData(true);
        }}
        health={health}
      />
    );
  }

  const meta = getPageMeta();

  return (
    <div className={`app-layout ${isSidebarCollapsed ? 'app-sidebar-collapsed' : ''}`}>
      <BiSidebar
        currentTab={currentTab}
        onSelectTab={handleNavigateTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isOpenMobile={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
        lowStockCount={lowStock.length}
        admin={admin}
      />

      <div className="main-wrapper">
        <Header
          title={meta.title}
          health={health}
          admin={admin}
          onOpenLogin={() => {}}
          onOpenLogs={() => setIsLogsModalOpen(true)}
          onOpenAiAdvisor={() => setIsAiModalOpen(true)}
          onLogout={handleLogout}
          onRefresh={() => loadDashboardData(true)}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          activeDatePreset={dateRange.preset}
          onChangeDateRange={handleChangeDateRange}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        <main className="dashboard-content">
          {error && <ErrorBanner error={error} onRetry={() => loadDashboardData(true)} />}

          {/* Active Category Filter Pill if Cross-Filtering */}
          {selectedCategory && (
            <div className="bi-active-cross-filter-bar">
              <span className="cross-filter-label">🔍 Cross-Filtering Dashboard by Category:</span>
              <span className="cross-filter-tag">{selectedCategory}</span>
              <button
                type="button"
                className="btn-clear-cross-filter"
                onClick={() => setSelectedCategory(null)}
                title="Reset category cross-filter to All Products"
              >
                Clear Filter &times;
              </button>
            </div>
          )}

          {/* OVERVIEW TAB: Full-Screen Visual Business Intelligence */}
          {currentTab === 'overview' && (
            <div className="tab-pane bi-tab-pane bi-fullscreen-canvas">
              {/* 1. Visual Stock Shortage & Restock Alert Bar */}
              <BiVisualAlertsBar
                lowStock={lowStock}
                onNavigate={handleNavigateTab}
                onOpenAi={() => setIsAiModalOpen(true)}
              />

              {/* 2. Power BI Executive KPI Ribbon */}
              <section className="dashboard-section bi-kpi-section">
                <BiKpiRibbon
                  summary={summary}
                  isLoading={isInitialLoading}
                  onNavigate={handleNavigateTab}
                />
              </section>

              {/* 3. Top Visual Analytics: Sales Trend Area + Category Donut */}
              <section className="dashboard-grid-2col bi-charts-grid">
                <BiRevenueTrendChart
                  data={trends}
                  activePeriod={activeTrendPeriod}
                  onPeriodChange={handlePeriodChange}
                  onSelectPoint={(pt) => {
                    if (pt?.period) {
                      handleNavigateTab('sales');
                    }
                  }}
                  isLoading={isRefreshing && trends.length === 0}
                />

                <BiCategoryDonutChart
                  data={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={(cat) => setSelectedCategory(cat)}
                  isLoading={isRefreshing && categories.length === 0}
                />
              </section>

              {/* 4. Second Visual Analytics: Product Leaderboard + Inventory Safety Buffers */}
              <section className="dashboard-grid-2col bi-charts-grid">
                <BiProductPerformanceChart
                  dateRange={dateRange}
                  selectedCategory={selectedCategory}
                  onSelectProduct={(p) => setSelectedProduct(p)}
                />

                <BiInventoryChart
                  data={lowStock}
                  onSelectProduct={(p) => setSelectedProduct(p)}
                  isLoading={isInitialLoading}
                />
              </section>

              {/* 5. Product Overview & Searchable Catalog Visual Grid */}
              <section className="dashboard-section">
                <BiProductOverviewGrid
                  products={topProducts}
                  selectedCategory={selectedCategory}
                  onSelectCategory={(cat) => setSelectedCategory(cat)}
                  onSelectProduct={(p) => setSelectedProduct(p)}
                  isLoading={isInitialLoading}
                />
              </section>
            </div>
          )}

          {/* SALES & TRENDS BI TAB */}
          {currentTab === 'sales' && (
            <div className="tab-pane bi-tab-pane">
              {/* Primary Time-Series Trend Area Chart */}
              <section className="dashboard-section">
                <BiRevenueTrendChart
                  data={trends}
                  activePeriod={activeTrendPeriod}
                  onPeriodChange={handlePeriodChange}
                  isLoading={isRefreshing && trends.length === 0}
                />
              </section>

              {/* 2-Column Split: Monthly Revenue vs Profit + 7-Day Shopping Patterns */}
              <section className="dashboard-grid-2col bi-charts-grid">
                <BiMonthlyComparisonChart
                  data={monthlyTrends}
                  isLoading={isRefreshing && monthlyTrends.length === 0}
                />
                <BiWeekdayChart
                  data={distribution}
                  isLoading={isRefreshing && distribution.length === 0}
                />
              </section>

              {/* Full Sales Ledger Transactions & CSV Export */}
              <section className="dashboard-section">
                <SalesTransactionsTable dateRange={dateRange} />
              </section>
            </div>
          )}

          {/* PRODUCT INTELLIGENCE TAB */}
          {currentTab === 'products' && (
            <div className="tab-pane bi-tab-pane">
              <section className="dashboard-section">
                <BiProductPerformanceChart
                  dateRange={dateRange}
                  selectedCategory={selectedCategory}
                  onSelectProduct={(p) => setSelectedProduct(p)}
                />
              </section>

              <section className="dashboard-section">
                <TopSellingList
                  products={topProducts}
                  isLoading={isInitialLoading}
                  compact={false}
                  onSelectProduct={(p) => setSelectedProduct(p)}
                />
              </section>
            </div>
          )}

          {/* WAREHOUSE & INVENTORY INTELLIGENCE TAB */}
          {currentTab === 'inventory' && (
            <div className="tab-pane bi-tab-pane">
              {/* Horizontal Stock vs Reorder Level Buffer Chart */}
              <section className="dashboard-section">
                <BiInventoryChart
                  data={lowStock}
                  onSelectProduct={(p) => setSelectedProduct(p)}
                  isLoading={isInitialLoading}
                />
              </section>

              {/* Full Warehouse Catalog Table */}
              <section className="dashboard-section">
                <InventoryCatalogTable
                  initialFilter={inventoryInitialFilter}
                  onSelectProduct={(p) => setSelectedProduct(p)}
                />
              </section>
            </div>
          )}

          {/* FINANCIAL STATEMENTS & P&L TAB */}
          {currentTab === 'reports' && (
            <div className="tab-pane bi-tab-pane">
              <section className="dashboard-section">
                <BiMonthlyComparisonChart
                  data={monthlyTrends}
                  isLoading={isRefreshing && monthlyTrends.length === 0}
                />
              </section>

              <ReportsView
                summary={summary}
                lowStock={lowStock}
                dateRange={dateRange}
              />
            </div>
          )}

          {/* API USAGE & BUDGET MONITOR TAB */}
          {currentTab === 'api-usage' && (
            <div className="tab-pane bi-tab-pane">
              <BiApiUsageView dateRange={dateRange} />
            </div>
          )}
        </main>
      </div>

      {/* Product Detail & Unit Economics Modal */}
      {selectedProduct && (
        <BiProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAskAi={(_q) => {
            setIsAiModalOpen(true);
          }}
        />
      )}

      {/* Database Activity Logs Modal */}
      <ActivityLogsModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
      />

      {/* AI Executive Advisor & Copilot Modal */}
      <BiAiAdvisorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        dateRange={dateRange}
        admin={admin}
      />
    </div>
  );
}

export default App;
