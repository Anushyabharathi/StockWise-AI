const kpiService = require('../analytics/kpi.service');
const { parseDateRange } = require('../middleware/validate');

/**
 * Controller for dashboard summary metrics with date-range filtering.
 */
async function getSummary(req, res, next) {
  try {
    const { startDate, endDate } = parseDateRange(req.query.startDate, req.query.endDate);
    const summary = await kpiService.getDashboardSummary({ startDate, endDate });

    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSummary,
};
