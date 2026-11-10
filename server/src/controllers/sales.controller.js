const salesService = require('../services/sales.service');
const activityService = require('../services/activity.service');
const {
  parseDateRange,
  parsePagination,
  parseSort,
  sanitizeSearch,
} = require('../middleware/validate');

/**
 * Controller for sales reports and order telemetry.
 */
async function getSales(req, res, next) {
  try {
    const { startDate, endDate } = parseDateRange(req.query.startDate, req.query.endDate);
    const { page, limit, offset } = parsePagination(req.query, 10, 100);
    const { sortBy, sortOrder } = parseSort(
      req.query.sortBy,
      ['sale_date', 'total_amount', 'sale_id'],
      'sale_date',
      req.query.sortOrder
    );
    const search = sanitizeSearch(req.query.search);

    const result = await salesService.getSalesList({
      page,
      limit,
      offset,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller for retrieving single sale transaction details.
 */
async function getSaleById(req, res, next) {
  try {
    const saleId = parseInt(req.params.id, 10);
    if (isNaN(saleId) || saleId <= 0) {
      const error = new Error(`Invalid sale ID: "${req.params.id}". ID must be a positive integer.`);
      error.status = 400;
      error.code = 'INVALID_ID_PARAMETER';
      throw error;
    }

    const sale = await salesService.getSaleById(saleId);
    if (!sale) {
      const error = new Error(`Sale transaction with ID #${saleId} not found.`);
      error.status = 404;
      error.code = 'SALE_NOT_FOUND';
      throw error;
    }

    res.json({
      success: true,
      data: sale,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller for exporting filtered sales records to CSV format.
 */
async function exportCsv(req, res, next) {
  try {
    const { startDate, endDate } = parseDateRange(req.query.startDate, req.query.endDate);
    const { sortBy, sortOrder } = parseSort(
      req.query.sortBy,
      ['sale_date', 'total_amount', 'sale_id'],
      'sale_date',
      req.query.sortOrder
    );
    const search = sanitizeSearch(req.query.search);

    const csvData = await salesService.generateSalesCsv({
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    });

    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const adminId = req.admin?.adminId || null;

    await activityService.log({
      adminId,
      action: 'SALES_CSV_EXPORT',
      details: { startDate, endDate, search, sortBy, sortOrder },
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stockwise-sales-report-${dateStr}.csv"`);
    res.status(200).send(csvData);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSales,
  getSaleById,
  exportCsv,
};
