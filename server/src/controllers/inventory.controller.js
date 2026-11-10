const kpiService = require('../analytics/kpi.service');
const {
  parsePositiveInt,
  parsePagination,
  parseSort,
  sanitizeSearch,
} = require('../middleware/validate');

/**
 * Controller for full warehouse inventory catalog with pagination, search, and status filtering.
 */
async function getInventory(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query, 20, 100);
    const { sortBy, sortOrder } = parseSort(
      req.query.sortBy,
      [
        'product_name',
        'category',
        'quantity',
        'current_stock',
        'reorder_level',
        'deficit',
        'cost_price',
        'selling_price',
      ],
      'deficit',
      req.query.sortOrder
    );

    const search = sanitizeSearch(req.query.search);
    const category = req.query.category ? String(req.query.category).trim() : null;

    let status = 'ALL';
    if (req.query.status) {
      const allowedStatuses = ['ALL', 'HEALTHY', 'LOW', 'CRITICAL', 'OUT_OF_STOCK'];
      const normalizedStatus = String(req.query.status).trim().toUpperCase();
      if (!allowedStatuses.includes(normalizedStatus)) {
        const error = new Error(
          `Invalid inventory status: "${req.query.status}". Allowed values: [${allowedStatuses.join(', ')}]`
        );
        error.status = 400;
        error.code = 'INVALID_STATUS_FILTER';
        throw error;
      }
      status = normalizedStatus;
    }

    const result = await kpiService.getFullInventory({
      page,
      limit,
      offset,
      search,
      category,
      status,
      sortBy,
      sortOrder,
    });

    res.json({
      success: true,
      ...result,
      appliedFilters: {
        search,
        category,
        status,
        sortBy,
        sortOrder,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Legacy controller for low-stock threshold items (preserved for backwards compatibility).
 */
async function getLowStock(req, res, next) {
  try {
    const limit = parsePositiveInt(req.query.limit, 50, 200);
    const category = req.query.category ? String(req.query.category).trim() : null;

    const lowStockItems = await kpiService.getLowStockInventory({
      limit,
      category,
    });

    res.json({
      success: true,
      count: lowStockItems.length,
      data: lowStockItems,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInventory,
  getLowStock,
};
