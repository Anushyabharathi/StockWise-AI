const kpiService = require('../analytics/kpi.service');
const { parseDate, parsePositiveInt } = require('../middleware/validate');

/**
 * Controller for product-related analytics.
 */
async function getTopSelling(req, res, next) {
  try {
    const limit = parsePositiveInt(req.query.limit, 10, 100);
    const startDate = parseDate(req.query.startDate);
    const endDate = parseDate(req.query.endDate);
    const category = req.query.category ? String(req.query.category).trim() : null;
    const sortBy = req.query.sortBy === 'total_revenue' ? 'total_revenue' : 'units_sold';
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const topProducts = await kpiService.getTopSellingProducts({
      limit,
      startDate,
      endDate,
      category,
      sortBy,
      sortOrder,
    });

    res.json({
      success: true,
      count: topProducts.length,
      data: topProducts,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTopSelling,
};
