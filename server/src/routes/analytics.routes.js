const express = require('express');
const {
  getDailyTrends,
  getWeeklyTrends,
  getMonthlyTrends,
  getYearlyTrends,
  getCategories,
  getDistribution,
} = require('../controllers/analytics.controller');

const router = express.Router();

router.get('/daily', getDailyTrends);
router.get('/weekly', getWeeklyTrends);
router.get('/monthly', getMonthlyTrends);
router.get('/yearly', getYearlyTrends);
router.get('/categories', getCategories);
router.get('/distribution', getDistribution);

module.exports = router;
