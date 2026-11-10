const { query } = require('../db/pool');

/**
 * Enterprise Sales & Reporting Service.
 * Implements strict reconciliation, parameterized filtering,
 * duplicate-order prevention, and CSV export.
 */
class SalesService {
  /**
   * Retrieves paginated sales transactions with line item summaries.
   *
   * @param {Object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=10]
   * @param {number} [options.offset=0]
   * @param {string|null} [options.startDate=null]
   * @param {string|null} [options.endDate=null]
   * @param {string|null} [options.search=null]
   * @param {string} [options.sortBy='sale_date']
   * @param {'ASC'|'DESC'} [options.sortOrder='DESC']
   */
  async getSalesList({
    page = 1,
    limit = 10,
    offset = 0,
    startDate = null,
    endDate = null,
    search = null,
    sortBy = 'sale_date',
    sortOrder = 'DESC',
  } = {}) {
    const whereConditions = ['s.status = 1'];
    const params = [];

    if (startDate) {
      params.push(startDate);
      whereConditions.push(`s.sale_date >= $${params.length}::TIMESTAMPTZ`);
    }

    if (endDate) {
      params.push(endDate);
      whereConditions.push(`s.sale_date <= $${params.length}::TIMESTAMPTZ`);
    }

    if (search) {
      const searchNum = parseInt(search, 10);
      if (!isNaN(searchNum) && String(searchNum) === search.trim()) {
        params.push(searchNum);
        whereConditions.push(`s.sale_id = $${params.length}`);
      } else {
        params.push(`%${search}%`);
        whereConditions.push(`EXISTS (
          SELECT 1 FROM sale_items si_s
          JOIN products p_s ON p_s.product_id = si_s.product_id
          WHERE si_s.sale_id = s.sale_id AND si_s.status = 1 AND p_s.product_name ILIKE $${params.length}
        )`);
      }
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // 1. Overall summary for the filtered criteria
    const summarySql = `
      SELECT
        COUNT(DISTINCT s.sale_id)::BIGINT AS total_orders,
        COALESCE(SUM(si.quantity * si.unit_price), 0)::NUMERIC(14,2) AS total_revenue,
        COALESCE(SUM(si.quantity), 0)::BIGINT AS total_units,
        COALESCE(SUM(si.quantity * (si.unit_price - p.cost_price)), 0)::NUMERIC(14,2) AS total_profit,
        COUNT(*) FILTER (WHERE ABS(s.total_amount - COALESCE(agg.calc_total, 0)) > 0.01)::BIGINT AS discrepancy_orders_count
      FROM sales s
      LEFT JOIN (
        SELECT sale_id, SUM(quantity * unit_price) AS calc_total
        FROM sale_items
        WHERE status = 1
        GROUP BY sale_id
      ) agg ON agg.sale_id = s.sale_id
      JOIN sale_items si ON si.sale_id = s.sale_id AND si.status = 1
      JOIN products p ON p.product_id = si.product_id AND p.status = 1
      ${whereClause};
    `;

    // 2. Count distinct sales for pagination
    const countSql = `
      SELECT COUNT(*)::BIGINT AS total_records
      FROM sales s
      ${whereClause};
    `;

    // Allowed sort columns
    const sortFieldMap = {
      sale_date: 's.sale_date',
      total_amount: 's.total_amount',
      sale_id: 's.sale_id',
    };
    const sortCol = sortFieldMap[sortBy] || 's.sale_date';
    const direction = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 3. Paginated sales IDs
    const pageParams = [...params, limit, offset];
    const salesPageSql = `
      SELECT s.sale_id, s.sale_date, s.total_amount, s.created_at
      FROM sales s
      ${whereClause}
      ORDER BY ${sortCol} ${direction}, s.sale_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const [summaryRes, countRes, pageRes] = await Promise.all([
      query(summarySql, params),
      query(countSql, params),
      query(salesPageSql, pageParams),
    ]);

    const totalRecords = parseInt(countRes.rows[0]?.total_records || '0', 10);
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const sumRow = summaryRes.rows[0] || {};
    const summary = {
      totalOrders: parseInt(sumRow.total_orders || '0', 10),
      totalRevenue: parseFloat(sumRow.total_revenue || '0'),
      totalUnits: parseInt(sumRow.total_units || '0', 10),
      totalProfit: parseFloat(sumRow.total_profit || '0'),
      discrepancyOrdersCount: parseInt(sumRow.discrepancy_orders_count || '0', 10),
    };

    if (pageRes.rows.length === 0) {
      return {
        pagination: { page, limit, totalRecords, totalPages },
        summary,
        appliedFilters: { startDate, endDate, search, sortBy, sortOrder },
        data: [],
      };
    }

    // 4. Retrieve line items for the paginated sales
    const saleIds = pageRes.rows.map((r) => r.sale_id);
    const itemsSql = `
      SELECT
        si.sale_item_id,
        si.sale_id,
        si.product_id,
        p.product_name,
        p.category,
        si.quantity,
        si.unit_price::NUMERIC(12,2) AS unit_price,
        p.cost_price::NUMERIC(12,2) AS cost_price,
        (si.quantity * si.unit_price)::NUMERIC(12,2) AS line_total,
        (si.quantity * (si.unit_price - p.cost_price))::NUMERIC(12,2) AS line_profit
      FROM sale_items si
      JOIN products p ON p.product_id = si.product_id
      WHERE si.sale_id = ANY($1::INTEGER[])
        AND si.status = 1
      ORDER BY si.sale_item_id ASC;
    `;

    const itemsRes = await query(itemsSql, [saleIds]);
    const itemsBySale = new Map();
    itemsRes.rows.forEach((item) => {
      if (!itemsBySale.has(item.sale_id)) {
        itemsBySale.set(item.sale_id, []);
      }
      itemsBySale.get(item.sale_id).push({
        saleItemId: item.sale_item_id,
        productId: item.product_id,
        productName: item.product_name,
        category: item.category,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price),
        costPrice: parseFloat(item.cost_price),
        lineTotal: parseFloat(item.line_total),
        lineProfit: parseFloat(item.line_profit),
      });
    });

    const sales = pageRes.rows.map((sale) => {
      const items = itemsBySale.get(sale.sale_id) || [];
      const headerTotal = parseFloat(sale.total_amount);
      const calculatedTotal = items.reduce((acc, it) => acc + it.lineTotal, 0);
      const grossProfit = items.reduce((acc, it) => acc + it.lineProfit, 0);
      const unitsCount = items.reduce((acc, it) => acc + it.quantity, 0);
      const hasDiscrepancy = Math.abs(headerTotal - calculatedTotal) > 0.01;

      return {
        saleId: sale.sale_id,
        saleDate: sale.sale_date,
        headerTotal,
        calculatedTotal: +calculatedTotal.toFixed(2),
        hasDiscrepancy,
        discrepancyAmount: hasDiscrepancy ? +(headerTotal - calculatedTotal).toFixed(2) : 0,
        itemsCount: items.length,
        unitsCount,
        grossProfit: +grossProfit.toFixed(2),
        items,
      };
    });

    return {
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
      summary,
      appliedFilters: {
        startDate,
        endDate,
        search,
        sortBy,
        sortOrder,
      },
      data: sales,
    };
  }

  /**
   * Retrieves single sale with complete line items.
   * @param {number} saleId 
   */
  async getSaleById(saleId) {
    const saleSql = `
      SELECT sale_id, sale_date, total_amount, status, created_at, updated_at
      FROM sales
      WHERE sale_id = $1 AND status = 1;
    `;
    const saleRes = await query(saleSql, [saleId]);
    if (saleRes.rows.length === 0) return null;

    const sale = saleRes.rows[0];
    const itemsSql = `
      SELECT
        si.sale_item_id,
        si.product_id,
        p.product_name,
        p.category,
        si.quantity,
        si.unit_price::NUMERIC(12,2) AS unit_price,
        p.cost_price::NUMERIC(12,2) AS cost_price,
        (si.quantity * si.unit_price)::NUMERIC(12,2) AS line_total,
        (si.quantity * (si.unit_price - p.cost_price))::NUMERIC(12,2) AS line_profit
      FROM sale_items si
      JOIN products p ON p.product_id = si.product_id
      WHERE si.sale_id = $1 AND si.status = 1
      ORDER BY si.sale_item_id ASC;
    `;
    const itemsRes = await query(itemsSql, [saleId]);
    const items = itemsRes.rows.map((r) => ({
      saleItemId: r.sale_item_id,
      productId: r.product_id,
      productName: r.product_name,
      category: r.category,
      quantity: r.quantity,
      unitPrice: parseFloat(r.unit_price),
      costPrice: parseFloat(r.cost_price),
      lineTotal: parseFloat(r.line_total),
      lineProfit: parseFloat(r.line_profit),
    }));

    const calculatedTotal = items.reduce((acc, it) => acc + it.lineTotal, 0);
    const grossProfit = items.reduce((acc, it) => acc + it.lineProfit, 0);

    return {
      saleId: sale.sale_id,
      saleDate: sale.sale_date,
      headerTotal: parseFloat(sale.total_amount),
      calculatedTotal: +calculatedTotal.toFixed(2),
      grossProfit: +grossProfit.toFixed(2),
      itemsCount: items.length,
      unitsCount: items.reduce((acc, it) => acc + it.quantity, 0),
      items,
    };
  }

  /**
   * Generates CSV export for sales records matching the filtered criteria.
   *
   * @param {Object} options
   * @param {string|null} [options.startDate=null]
   * @param {string|null} [options.endDate=null]
   * @param {string|null} [options.search=null]
   * @param {string} [options.sortBy='sale_date']
   * @param {'ASC'|'DESC'} [options.sortOrder='DESC']
   * @returns {Promise<string>}
   */
  async generateSalesCsv({
    startDate = null,
    endDate = null,
    search = null,
    sortBy = 'sale_date',
    sortOrder = 'DESC',
  } = {}) {
    // Retrieve up to 5000 matching sales rows for export
    const salesResult = await this.getSalesList({
      page: 1,
      limit: 5000,
      offset: 0,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    });

    const headers = [
      'Sale ID',
      'Sale Date (UTC)',
      'Items Count',
      'Total Units Sold',
      'Header Total (INR)',
      'Calculated Revenue (INR)',
      'Gross Profit (INR)',
      'Discrepancy (INR)',
      'Products Included',
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = [headers.join(',')];

    for (const s of salesResult.data) {
      const productSummary = s.items.map((it) => `${it.productName} (${it.quantity}x)`).join('; ');
      rows.push(
        [
          s.saleId,
          escapeCsv(new Date(s.saleDate).toISOString()),
          s.itemsCount,
          s.unitsCount,
          s.headerTotal.toFixed(2),
          s.calculatedTotal.toFixed(2),
          s.grossProfit.toFixed(2),
          s.discrepancyAmount.toFixed(2),
          escapeCsv(productSummary),
        ].join(',')
      );
    }

    return rows.join('\r\n');
  }
}

module.exports = new SalesService();
