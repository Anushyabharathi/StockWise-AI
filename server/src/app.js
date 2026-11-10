const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome & info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'StockWise AI Backend API',
    version: '1.0.0',
    documentation: {
      health: 'GET /api/health',
      dashboardSummary: 'GET /api/dashboard/summary',
      analyticsDaily: 'GET /api/analytics/daily',
      analyticsWeekly: 'GET /api/analytics/weekly',
      analyticsMonthly: 'GET /api/analytics/monthly',
      analyticsYearly: 'GET /api/analytics/yearly',
      categoriesAnalytics: 'GET /api/analytics/categories',
      distributionAnalytics: 'GET /api/analytics/distribution',
      topSellingProducts: 'GET /api/products/top-selling',
      fullInventory: 'GET /api/inventory',
      lowStockInventory: 'GET /api/inventory/low-stock',
      salesList: 'GET /api/sales',
      salesExportCsv: 'GET /api/sales/export',
      salesDetail: 'GET /api/sales/:id',
      authLogin: 'POST /api/auth/login',
      authLogout: 'POST /api/auth/logout',
      authMe: 'GET /api/auth/me',
      activityLogs: 'GET /api/activity-logs',
      aiStatus: 'GET /api/ai/status',
      aiBriefing: 'GET /api/ai/briefing',
      aiAsk: 'POST /api/ai/ask',
      claudeMonitorBudget: 'GET /api/claude-monitor/budget',
      claudeMonitorSummary: 'GET /api/claude-monitor/summary',
      claudeMonitorRequests: 'GET /api/claude-monitor/requests',
      claudeMonitorExport: 'GET /api/claude-monitor/export',
      claudeMonitorTest: 'POST /api/claude-monitor/test-connection',
    },
  });
});

// Mount all API routes
app.use('/api', apiRoutes);

// Catch 404s
app.use(notFoundHandler);

// Centralized error handling
app.use(errorHandler);

module.exports = app;
