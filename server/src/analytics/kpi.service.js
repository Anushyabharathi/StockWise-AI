const { query } = require('../db/pool');

/**
 * Enterprise KPI & Analytics Service.
 * Implements authoritative revenue calculations, gross profit tracking,
 * date-boundary filtering, and consistent status filters (status = 1).
 */
class KpiService {
  /**
   * Retrieves dashboard summary metrics with optional date-range filtering.
   * Calculates revenue from valid sales and items without duplication.
   *
   * @param {Object} [filter]
   * @param {string|null} [filter.startDate]
   * @param {string|null} [filter.endDate]
   */
  async getDashboardSummary({ startDate = null, endDate = null } = {}) {
    const salesSql = `
      SELECT
        COALESCE(SUM(si.quantity * si.unit_price), 0)::NUMERIC(14,2) AS total_revenue,
        COUNT(DISTINCT s.sale_id)::BIGINT AS total_valid_sales,
        COALESCE(SUM(si.quantity), 0)::BIGINT AS units_sold,
        COALESCE(SUM(si.quantity * (si.unit_price - p.cost_price)), 0)::NUMERIC(14,2) AS gross_profit
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.sale_id AND si.status = 1
      JOIN products p ON p.product_id = si.product_id AND p.status = 1
      WHERE s.status = 1
        AND ($1::TIMESTAMPTZ IS NULL OR s.sale_date >= $1::TIMESTAMPTZ)
        AND ($2::TIMESTAMPTZ IS NULL OR s.sale_date <= $2::TIMESTAMPTZ);
    `;

    const inventoryStatsSql = `
      SELECT
        (SELECT COUNT(*)::BIGINT FROM products WHERE status = 1) AS active_products_count,
        (
          SELECT COUNT(*)::BIGINT
          FROM products p
          JOIN inventory i ON i.product_id = p.product_id AND i.status = 1
          WHERE p.status = 1 AND i.quantity <= p.reorder_level
        ) AS low_stock_products_count,
        (
          SELECT COUNT(*)::BIGINT
          FROM products p
          JOIN inventory i ON i.product_id = p.product_id AND i.status = 1
          WHERE p.status = 1 AND i.quantity = 0
        ) AS out_of_stock_products_count;
    `;

    const [salesResult, invResult] = await Promise.all([
      query(salesSql, [startDate, endDate]),
      query(inventoryStatsSql),
    ]);

    const salesRow = salesResult.rows[0] || {};
    const invRow = invResult.rows[0] || {};

    const totalRevenue = parseFloat(salesRow.total_revenue || '0');
    const validSalesCount = parseInt(salesRow.total_valid_sales || '0', 10);
    const unitsSold = parseInt(salesRow.units_sold || '0', 10);
    const grossProfit = parseFloat(salesRow.gross_profit || '0');
    const activeProductCount = parseInt(invRow.active_products_count || '0', 10);
    const lowStockCount = parseInt(invRow.low_stock_products_count || '0', 10);
    const outOfStockCount = parseInt(invRow.out_of_stock_products_count || '0', 10);

    const averageOrderValue = validSalesCount > 0 ? +(totalRevenue / validSalesCount).toFixed(2) : 0;
    const grossMargin = totalRevenue > 0 ? +((grossProfit / totalRevenue) * 100).toFixed(2) : 0;

    return {
      totalRevenue,
      validSalesCount,
      unitsSold,
      grossProfit,
      grossMargin,
      averageOrderValue,
      activeProductCount,
      lowStockProductCount: lowStockCount,
      outOfStockProductCount: outOfStockCount,
      appliedFilters: {
        startDate,
        endDate,
      },
    };
  }

  /**
   * Retrieves category-wise revenue, sales count, and volume metrics.
   *
   * @param {Object} [options]
   * @param {string|null} [options.startDate]
   * @param {string|null} [options.endDate]
   * @param {number} [options.limit=20]
   */
  async getCategoriesAnalytics({ startDate = null, endDate = null, limit = 20 } = {}) {
    const sql = `
      SELECT
        COALESCE(p.category, 'Uncategorized') AS category,
        COUNT(DISTINCT s.sale_id)::BIGINT AS order_count,
        COALESCE(SUM(si.quantity), 0)::BIGINT AS units_sold,
        COALESCE(SUM(si.quantity * si.unit_price), 0)::NUMERIC(14,2) AS total_revenue,
        COALESCE(SUM(si.quantity * (si.unit_price - p.cost_price)), 0)::NUMERIC(14,2) AS gross_profit
      FROM products p
      JOIN sale_items si ON si.product_id = p.product_id AND si.status = 1
      JOIN sales s ON s.sale_id = si.sale_id AND s.status = 1
      WHERE p.status = 1
        AND ($1::TIMESTAMPTZ IS NULL OR s.sale_date >= $1::TIMESTAMPTZ)
        AND ($2::TIMESTAMPTZ IS NULL OR s.sale_date <= $2::TIMESTAMPTZ)
      GROUP BY p.category
      ORDER BY total_revenue DESC
      LIMIT $3;
    `;

    const result = await query(sql, [startDate, endDate, limit]);

    // Calculate overall revenue across these categories to determine relative percentage share
    const totalAcrossCategories = result.rows.reduce(
      (acc, r) => acc + parseFloat(r.total_revenue || '0'),
      0
    );

    return result.rows.map((row) => {
      const revenue = parseFloat(row.total_revenue || '0');
      const profit = parseFloat(row.gross_profit || '0');
      const margin = revenue > 0 ? +((profit / revenue) * 100).toFixed(2) : 0;
      const share =
        totalAcrossCategories > 0 ? +((revenue / totalAcrossCategories) * 100).toFixed(2) : 0;

      return {
        category: row.category,
        orderCount: parseInt(row.order_count || '0', 10),
        unitsSold: parseInt(row.units_sold || '0', 10),
        totalRevenue: revenue,
        grossProfit: profit,
        marginPercentage: margin,
        percentageOfRevenue: share,
      };
    });
  }

  /**
   * Retrieves sales distribution grouped by day of the week.
   *
   * @param {Object} [options]
   * @param {string|null} [options.startDate]
   * @param {string|null} [options.endDate]
   */
  async getSalesDistribution({ startDate = null, endDate = null } = {}) {
    const sql = `
      SELECT
        EXTRACT(DOW FROM s.sale_date)::INTEGER AS day_of_week,
        TRIM(TO_CHAR(s.sale_date, 'Day')) AS day_name,
        COUNT(DISTINCT s.sale_id)::BIGINT AS total_sales,
        COALESCE(SUM(si.quantity * si.unit_price), 0)::NUMERIC(14,2) AS total_revenue,
        COALESCE(SUM(si.quantity), 0)::BIGINT AS units_sold
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.sale_id AND si.status = 1
      WHERE s.status = 1
        AND ($1::TIMESTAMPTZ IS NULL OR s.sale_date >= $1::TIMESTAMPTZ)
        AND ($2::TIMESTAMPTZ IS NULL OR s.sale_date <= $2::TIMESTAMPTZ)
      GROUP BY EXTRACT(DOW FROM s.sale_date), TO_CHAR(s.sale_date, 'Day')
      ORDER BY day_of_week ASC;
    `;

    const result = await query(sql, [startDate, endDate]);
    const dayMap = new Map();
    result.rows.forEach((r) => {
      dayMap.set(r.day_of_week, r);
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Ensure all 7 days are represented in output even if a day has 0 sales
    return dayNames.map((name, index) => {
      const row = dayMap.get(index);
      const totalSales = row ? parseInt(row.total_sales || '0', 10) : 0;
      const totalRevenue = row ? parseFloat(row.total_revenue || '0') : 0;
      const unitsSold = row ? parseInt(row.units_sold || '0', 10) : 0;
      const aov = totalSales > 0 ? +(totalRevenue / totalSales).toFixed(2) : 0;

      return {
        dayOfWeek: index,
        dayName: name,
        dayShort: name.slice(0, 3),
        totalSales,
        totalRevenue,
        unitsSold,
        averageOrderValue: aov,
      };
    });
  }

  /**
   * Retrieves time-series sales and revenue trends grouped by period (day, week, month, year).
   * @param {'day'|'week'|'month'|'year'} period 
   * @param {Object} options 
   * @param {string|null} [options.startDate] 
   * @param {string|null} [options.endDate] 
   * @param {number} [options.limit] 
   */
  async getTrendsByPeriod(period, { startDate = null, endDate = null, limit = 50 } = {}) {
    const periodFormats = {
      day: 'YYYY-MM-DD',
      week: 'YYYY-"W"IW',
      month: 'YYYY-MM',
      year: 'YYYY',
    };

    const format = periodFormats[period] || 'YYYY-MM-DD';

    const sql = `
      SELECT
        TO_CHAR(DATE_TRUNC($1, s.sale_date), $2) AS period,
        DATE_TRUNC($1, s.sale_date)::DATE AS period_start_date,
        COUNT(DISTINCT s.sale_id)::BIGINT AS total_sales,
        COALESCE(SUM(si.quantity * si.unit_price), 0)::NUMERIC(14,2) AS total_revenue,
        COALESCE(SUM(si.quantity), 0)::BIGINT AS units_sold,
        COALESCE(SUM(si.quantity * (si.unit_price - p.cost_price)), 0)::NUMERIC(14,2) AS gross_profit
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.sale_id AND si.status = 1
      JOIN products p ON p.product_id = si.product_id AND p.status = 1
      WHERE s.status = 1
        AND ($3::TIMESTAMPTZ IS NULL OR s.sale_date >= $3::TIMESTAMPTZ)
        AND ($4::TIMESTAMPTZ IS NULL OR s.sale_date <= $4::TIMESTAMPTZ)
      GROUP BY DATE_TRUNC($1, s.sale_date)
      ORDER BY period_start_date ASC
      LIMIT $5;
    `;

    const result = await query(sql, [period, format, startDate, endDate, limit]);

    return result.rows.map((row) => {
      const revenue = parseFloat(row.total_revenue || '0');
      const sales = parseInt(row.total_sales || '0', 10);
      const units = parseInt(row.units_sold || '0', 10);
      const profit = parseFloat(row.gross_profit || '0');
      const margin = revenue > 0 ? +((profit / revenue) * 100).toFixed(2) : 0;

      return {
        period: row.period,
        periodStartDate: row.period_start_date,
        totalSales: sales,
        totalRevenue: revenue,
        unitsSold: units,
        grossProfit: profit,
        marginPercentage: margin,
        averageOrderValue: sales > 0 ? +(revenue / sales).toFixed(2) : 0,
      };
    });
  }

  /**
   * Retrieves top-selling products ranked by units sold and revenue.
   * @param {Object} options 
   * @param {number} [options.limit=10] 
   * @param {string|null} [options.startDate] 
   * @param {string|null} [options.endDate] 
   * @param {string|null} [options.category] 
   */
  async getTopSellingProducts({
    limit = 10,
    startDate = null,
    endDate = null,
    category = null,
    sortBy = 'units_sold',
    sortOrder = 'DESC',
  } = {}) {
    const validSortCol = sortBy === 'total_revenue' ? 'total_revenue' : 'units_sold';
    const direction = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT
        p.product_id,
        p.product_name,
        p.category,
        p.cost_price::NUMERIC(12,2) AS cost_price,
        p.selling_price::NUMERIC(12,2) AS selling_price,
        p.reorder_level,
        COALESCE(i.quantity, 0)::INT AS current_stock,
        COALESCE(SUM(si.quantity), 0)::BIGINT AS units_sold,
        COALESCE(SUM(si.quantity * si.unit_price), 0)::NUMERIC(14,2) AS total_revenue,
        COALESCE(SUM(si.quantity * (si.unit_price - p.cost_price)), 0)::NUMERIC(14,2) AS total_profit
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.product_id AND i.status = 1
      JOIN sale_items si ON si.product_id = p.product_id AND si.status = 1
      JOIN sales s ON s.sale_id = si.sale_id AND s.status = 1
      WHERE p.status = 1
        AND ($1::TIMESTAMPTZ IS NULL OR s.sale_date >= $1::TIMESTAMPTZ)
        AND ($2::TIMESTAMPTZ IS NULL OR s.sale_date <= $2::TIMESTAMPTZ)
        AND ($3::TEXT IS NULL OR p.category = $3)
      GROUP BY p.product_id, p.product_name, p.category, p.cost_price, p.selling_price, p.reorder_level, i.quantity
      ORDER BY ${validSortCol} ${direction}
      LIMIT $4;
    `;

    const result = await query(sql, [startDate, endDate, category, limit]);

    return result.rows.map((row) => {
      const stock = parseInt(row.current_stock, 10);
      const reorder = parseInt(row.reorder_level, 10);
      let stockStatus = 'HEALTHY';
      if (stock === 0) stockStatus = 'OUT_OF_STOCK';
      else if (stock <= reorder * 0.5) stockStatus = 'CRITICAL';
      else if (stock <= reorder) stockStatus = 'LOW';

      return {
        productId: row.product_id,
        productName: row.product_name,
        category: row.category,
        costPrice: parseFloat(row.cost_price),
        sellingPrice: parseFloat(row.selling_price),
        reorderLevel: reorder,
        currentStock: stock,
        stockStatus,
        unitsSold: parseInt(row.units_sold, 10),
        totalRevenue: parseFloat(row.total_revenue),
        totalProfit: parseFloat(row.total_profit),
        marginPercentage:
          parseFloat(row.total_revenue) > 0
            ? +((parseFloat(row.total_profit) / parseFloat(row.total_revenue)) * 100).toFixed(2)
            : 0,
      };
    });
  }

  /**
   * Retrieves low-stock inventory items where current stock <= reorder level.
   * @param {Object} options 
   * @param {number} [options.limit=50] 
   * @param {string|null} [options.category] 
   */
  async getLowStockInventory({ limit = 50, category = null } = {}) {
    const sql = `
      SELECT
        p.product_id,
        p.product_name,
        p.category,
        p.cost_price::NUMERIC(12,2) AS cost_price,
        p.selling_price::NUMERIC(12,2) AS selling_price,
        p.reorder_level,
        i.quantity AS current_stock,
        (p.reorder_level - i.quantity) AS deficit,
        CASE
          WHEN i.quantity = 0 THEN 'OUT_OF_STOCK'
          WHEN i.quantity <= (p.reorder_level * 0.5) THEN 'CRITICAL'
          ELSE 'LOW'
        END AS stock_status
      FROM products p
      JOIN inventory i ON i.product_id = p.product_id AND i.status = 1
      WHERE p.status = 1
        AND i.quantity <= p.reorder_level
        AND ($1::TEXT IS NULL OR p.category = $1)
      ORDER BY (p.reorder_level - i.quantity) DESC, i.quantity ASC
      LIMIT $2;
    `;

    const result = await query(sql, [category, limit]);

    return result.rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      category: row.category,
      costPrice: parseFloat(row.cost_price),
      sellingPrice: parseFloat(row.selling_price),
      reorderLevel: row.reorder_level,
      currentStock: row.current_stock,
      deficit: row.deficit,
      stockStatus: row.stock_status,
    }));
  }

  /**
   * Retrieves full paginated inventory list with status counts and sorting.
   *
   * @param {Object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @param {number} [options.offset=0]
   * @param {string|null} [options.search=null]
   * @param {string|null} [options.category=null]
   * @param {'ALL'|'HEALTHY'|'LOW'|'CRITICAL'|'OUT_OF_STOCK'} [options.status='ALL']
   * @param {string} [options.sortBy='deficit']
   * @param {'ASC'|'DESC'} [options.sortOrder='DESC']
   */
  async getFullInventory({
    page = 1,
    limit = 20,
    offset = 0,
    search = null,
    category = null,
    status = 'ALL',
    sortBy = 'deficit',
    sortOrder = 'DESC',
  } = {}) {
    // 1. Overall status counts across entire warehouse
    const countsSql = `
      SELECT
        COUNT(*)::BIGINT AS total_count,
        COUNT(*) FILTER (WHERE i.quantity > p.reorder_level)::BIGINT AS healthy_count,
        COUNT(*) FILTER (WHERE i.quantity <= p.reorder_level AND i.quantity > (p.reorder_level * 0.5))::BIGINT AS low_count,
        COUNT(*) FILTER (WHERE i.quantity <= (p.reorder_level * 0.5) AND i.quantity > 0)::BIGINT AS critical_count,
        COUNT(*) FILTER (WHERE i.quantity = 0)::BIGINT AS out_of_stock_count
      FROM products p
      JOIN inventory i ON i.product_id = p.product_id AND i.status = 1
      WHERE p.status = 1;
    `;

    // 2. Filter condition building safely using parameters
    const whereConditions = ['p.status = 1', 'i.status = 1'];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      whereConditions.push(`p.product_name ILIKE $${params.length}`);
    }

    if (category && category !== 'ALL') {
      params.push(category);
      whereConditions.push(`p.category = $${params.length}`);
    }

    if (status === 'OUT_OF_STOCK') {
      whereConditions.push('i.quantity = 0');
    } else if (status === 'CRITICAL') {
      whereConditions.push('i.quantity <= (p.reorder_level * 0.5) AND i.quantity > 0');
    } else if (status === 'LOW') {
      whereConditions.push('i.quantity <= p.reorder_level');
    } else if (status === 'HEALTHY') {
      whereConditions.push('i.quantity > p.reorder_level');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Safe sorting map
    const sortFieldMap = {
      product_name: 'p.product_name',
      category: 'p.category',
      quantity: 'i.quantity',
      current_stock: 'i.quantity',
      reorder_level: 'p.reorder_level',
      deficit: 'deficit',
      cost_price: 'p.cost_price',
      selling_price: 'p.selling_price',
    };

    const sortColumn = sortFieldMap[sortBy] || 'deficit';
    const direction = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 3. Count matching records
    const countSql = `
      SELECT COUNT(*)::BIGINT AS filtered_total
      FROM products p
      JOIN inventory i ON i.product_id = p.product_id AND i.status = 1
      ${whereClause};
    `;

    // 4. Paginated records
    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const dataSql = `
      SELECT
        p.product_id,
        p.product_name,
        p.category,
        p.cost_price::NUMERIC(12,2) AS cost_price,
        p.selling_price::NUMERIC(12,2) AS selling_price,
        p.reorder_level,
        i.quantity AS current_stock,
        GREATEST(0, p.reorder_level - i.quantity) AS deficit,
        CASE
          WHEN i.quantity = 0 THEN 'OUT_OF_STOCK'
          WHEN i.quantity <= (p.reorder_level * 0.5) THEN 'CRITICAL'
          WHEN i.quantity <= p.reorder_level THEN 'LOW'
          ELSE 'HEALTHY'
        END AS stock_status,
        i.updated_at
      FROM products p
      JOIN inventory i ON i.product_id = p.product_id AND i.status = 1
      ${whereClause}
      ORDER BY ${sortColumn} ${direction}, p.product_id ASC
      LIMIT ${limitParam} OFFSET ${offsetParam};
    `;

    const [countsRes, filteredRes, dataRes] = await Promise.all([
      query(countsSql),
      query(countSql, params.slice(0, params.length - 2)),
      query(dataSql, params),
    ]);

    const totalRecords = parseInt(filteredRes.rows[0]?.filtered_total || '0', 10);
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const cRow = countsRes.rows[0] || {};
    const statusCounts = {
      total: parseInt(cRow.total_count || '0', 10),
      healthy: parseInt(cRow.healthy_count || '0', 10),
      low: parseInt(cRow.low_count || '0', 10),
      critical: parseInt(cRow.critical_count || '0', 10),
      outOfStock: parseInt(cRow.out_of_stock_count || '0', 10),
    };

    const items = dataRes.rows.map((row) => {
      const deficit = parseInt(row.deficit, 10);
      let recommendation = 'Stock level is healthy.';
      if (row.stock_status === 'OUT_OF_STOCK') {
        recommendation = `Out of stock! Place purchase order for at least ${row.reorder_level} units immediately.`;
      } else if (row.stock_status === 'CRITICAL') {
        recommendation = `Critically low! Order ${deficit} units urgently to avoid stockout.`;
      } else if (row.stock_status === 'LOW') {
        recommendation = `Reorder threshold reached. Order ${deficit} units.`;
      }

      return {
        productId: row.product_id,
        productName: row.product_name,
        category: row.category,
        costPrice: parseFloat(row.cost_price),
        sellingPrice: parseFloat(row.selling_price),
        reorderLevel: row.reorder_level,
        currentStock: row.current_stock,
        deficit,
        stockStatus: row.stock_status,
        reorderRecommendation: recommendation,
        updatedAt: row.updated_at,
      };
    });

    return {
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
      statusCounts,
      data: items,
    };
  }
}

module.exports = new KpiService();
