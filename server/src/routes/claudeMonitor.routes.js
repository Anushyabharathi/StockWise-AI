const express = require('express');
const router = express.Router();
const monitorController = require('../controllers/claudeMonitor.controller');

// All monitor endpoints are protected and require verified admin role
router.get('/budget', monitorController.getBudget);
router.get('/summary', monitorController.getSummary);
router.get('/requests', monitorController.getRequests);
router.get('/by-feature', monitorController.getByFeature);
router.get('/by-user', monitorController.getByUser);
router.get('/connection-status', monitorController.getConnectionStatus);
router.post('/test-connection', monitorController.testConnection);
router.get('/export', monitorController.exportUsage);

module.exports = router;
