const express = require('express');
const healthRoutes = require('./health.routes');
const dashboardRoutes = require('./dashboard.routes');
const analyticsRoutes = require('./analytics.routes');
const productsRoutes = require('./products.routes');
const inventoryRoutes = require('./inventory.routes');
const salesRoutes = require('./sales.routes');
const authRoutes = require('./auth.routes');
const activityRoutes = require('./activity.routes');
const aiRoutes = require('./ai.routes');
const claudeMonitorRoutes = require('./claudeMonitor.routes');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public health check and authentication endpoints
router.use('/', healthRoutes);
router.use('/auth', authRoutes);

// Protected business intelligence and store analytics APIs
router.use('/dashboard', authenticateToken, dashboardRoutes);
router.use('/analytics', authenticateToken, analyticsRoutes);
router.use('/products', authenticateToken, productsRoutes);
router.use('/inventory', authenticateToken, inventoryRoutes);
router.use('/sales', authenticateToken, salesRoutes);
router.use('/activity-logs', authenticateToken, activityRoutes);
router.use('/ai', aiRoutes);
router.use('/claude-monitor', optionalAuth, claudeMonitorRoutes);
router.use('/ai-monitor', optionalAuth, claudeMonitorRoutes);

module.exports = router;

