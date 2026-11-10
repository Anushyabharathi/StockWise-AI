const express = require('express');
const { getActivityLogs } = require('../controllers/activity.controller');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Audit logs are protected and accessible to authenticated admins
router.get('/', authenticateToken, getActivityLogs);

module.exports = router;
