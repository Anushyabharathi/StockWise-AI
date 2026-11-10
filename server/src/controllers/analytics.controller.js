const kpiService = require('../analytics/kpi.service');
const { parseDateRange, parsePositiveInt } = require('../middleware/validate');

/**
 * Helper to process period trend requests uniformly.
 * @param {'day'|'week'|'month'|'year'} period 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @param {import('express').NextFunction} next 
 */
async function handlePeriodTrends(period, req, res, next) {
  try {
    const { startDate, endDate } = parseDateRange(req.query.startDate, req.query.endDate);
    const limit = parsePositiveInt(req.query.limit, 100, 500);

    const trends = await kpiService.getTrendsByPeriod(period, {
      startDate,
      endDate,
      limit,
    });

    res.json({
      success: true,
      period,
      count: trends.length,
      appliedFilters: { startDate, endDate, limit },
      data: trends,
    });
  } catch (err) {
    next(err);
  }
}

async function getDailyTrends(req, res, next) {
  return handlePeriodTrends('day', req, res, next);
}

async function getWeeklyTrends(req, res, next) {
  return handlePeriodTrends('week', req, res, next);
}

async function getMonthlyTrends(req, res, next) {
  return handlePeriodTrends('month', req, res, next);
}

async function getYearlyTrends(req, res, next) {
  return handlePeriodTrends('year', req, res, next);
}

/**
 * Retrieves sales metrics grouped by product category.
 */
async function getCategories(req, res, next) {
  try {
    const { startDate, endDate } = parseDateRange(req.query.startDate, req.query.endDate);
    const limit = parsePositiveInt(req.query.limit, 20, 100);

    const categories = await kpiService.getCategoriesAnalytics({
      startDate,
      endDate,
      limit,
    });

    res.json({
      success: true,
      count: categories.length,
      appliedFilters: { startDate, endDate, limit },
      data: categories,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves sales distribution grouped by weekday.
 */
async function getDistribution(req, res, next) {
  try {
    const { startDate, endDate } = parseDateRange(req.query.startDate, req.query.endDate);
    const distribution = await kpiService.getSalesDistribution({
      startDate,
      endDate,
    });

    res.json({
      success: true,
      type: 'weekday',
      appliedFilters: { startDate, endDate },
      data: distribution,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDailyTrends,
  getWeeklyTrends,
  getMonthlyTrends,
  getYearlyTrends,
  getCategories,
  getDistribution,
};
