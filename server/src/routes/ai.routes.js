const express = require('express');
const { getStatus, getExecutiveBriefing, askQuestion } = require('../controllers/ai.controller');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/ai/status
router.get('/status', getStatus);

// GET /api/ai/briefing?startDate=...&endDate=...
router.get('/briefing', optionalAuth, getExecutiveBriefing);

// POST /api/ai/ask
router.post('/ask', optionalAuth, askQuestion);

module.exports = router;
