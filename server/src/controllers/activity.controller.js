const activityService = require('../services/activity.service');
const { parsePagination, parseDateRange } = require('../middleware/validate');

/**
 * Controller for retrieving database audit logs.
 */
async function getActivityLogs(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query, 20, 100);
    const { startDate, endDate } = parseDateRange(req.query.startDate, req.query.endDate);
    const action = req.query.action ? String(req.query.action).trim() : null;
    const adminId = req.query.adminId ? parseInt(req.query.adminId, 10) : null;

    const result = await activityService.getLogs({
      page,
      limit,
      action,
      adminId,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      ...result,
      appliedFilters: {
        action,
        adminId,
        startDate,
        endDate,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getActivityLogs,
};
