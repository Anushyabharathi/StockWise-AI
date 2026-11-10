/**
 * Advanced validation and sanitization helpers for enterprise API endpoints.
 */

/**
 * Validates date strings to ensure valid date format or ISO string.
 * @param {string|undefined} dateStr 
 * @returns {string|null} ISO String or null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    const error = new Error(`Invalid date format provided: "${dateStr}". Use YYYY-MM-DD or ISO 8601.`);
    error.status = 400;
    error.code = 'INVALID_DATE_FORMAT';
    throw error;
  }
  return parsed.toISOString();
}

/**
 * Validates a start and end date range.
 * Ensures startDate <= endDate and adjusts end of day boundary when necessary.
 * @param {string|undefined} startDateStr 
 * @param {string|undefined} endDateStr 
 * @returns {{ startDate: string|null, endDate: string|null }}
 */
function parseDateRange(startDateStr, endDateStr) {
  const startDate = parseDate(startDateStr);
  let endDate = null;

  if (endDateStr) {
    const parsedEnd = new Date(endDateStr);
    if (isNaN(parsedEnd.getTime())) {
      const error = new Error(`Invalid end date format provided: "${endDateStr}". Use YYYY-MM-DD or ISO 8601.`);
      error.status = 400;
      error.code = 'INVALID_DATE_FORMAT';
      throw error;
    }

    // If only YYYY-MM-DD was provided (10 chars), set time to end of day 23:59:59.999
    if (endDateStr.trim().length === 10) {
      parsedEnd.setUTCHours(23, 59, 59, 999);
    }
    endDate = parsedEnd.toISOString();
  }

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    const error = new Error(
      `Invalid date range: startDate (${startDateStr}) cannot be chronologically after endDate (${endDateStr}).`
    );
    error.status = 400;
    error.code = 'INVALID_DATE_RANGE';
    throw error;
  }

  return { startDate, endDate };
}

/**
 * Validates integer limit parameter with bounds.
 * @param {string|undefined} val 
 * @param {number} defaultVal 
 * @param {number} maxVal 
 * @returns {number}
 */
function parsePositiveInt(val, defaultVal = 10, maxVal = 100) {
  if (val === undefined || val === null || val === '') return defaultVal;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed <= 0) {
    const error = new Error(`Limit must be a positive integer, got "${val}"`);
    error.status = 400;
    error.code = 'INVALID_INTEGER_PARAMETER';
    throw error;
  }
  return Math.min(parsed, maxVal);
}

/**
 * Validates pagination parameters: page and limit.
 * @param {Object} query 
 * @param {number} defaultLimit 
 * @param {number} maxLimit 
 * @returns {{ page: number, limit: number, offset: number }}
 */
function parsePagination(query = {}, defaultLimit = 10, maxLimit = 100) {
  let page = 1;
  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const parsedPage = parseInt(query.page, 10);
    if (isNaN(parsedPage) || parsedPage <= 0) {
      const error = new Error(`Page must be a positive integer greater than or equal to 1, got "${query.page}"`);
      error.status = 400;
      error.code = 'INVALID_PAGE_PARAMETER';
      throw error;
    }
    page = parsedPage;
  }

  const limit = parsePositiveInt(query.limit, defaultLimit, maxLimit);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Validates sorting parameters against an explicit allowlist to prevent SQL injection.
 * @param {string|undefined} sortBy 
 * @param {string[]} allowedFields 
 * @param {string} defaultField 
 * @param {string|undefined} sortOrder 
 * @returns {{ sortBy: string, sortOrder: 'ASC'|'DESC' }}
 */
function parseSort(sortBy, allowedFields = [], defaultField = 'created_at', sortOrder = 'DESC') {
  let validatedSortBy = defaultField;
  if (sortBy) {
    const normalized = String(sortBy).trim().toLowerCase();
    if (!allowedFields.includes(normalized)) {
      const error = new Error(
        `Invalid sortBy field: "${sortBy}". Allowed fields: [${allowedFields.join(', ')}]`
      );
      error.status = 400;
      error.code = 'INVALID_SORT_FIELD';
      throw error;
    }
    validatedSortBy = normalized;
  }

  let validatedOrder = 'DESC';
  if (sortOrder) {
    const normalizedOrder = String(sortOrder).trim().toUpperCase();
    if (normalizedOrder !== 'ASC' && normalizedOrder !== 'DESC') {
      const error = new Error(`Invalid sortOrder: "${sortOrder}". Allowed values are ASC or DESC.`);
      error.status = 400;
      error.code = 'INVALID_SORT_ORDER';
      throw error;
    }
    validatedOrder = normalizedOrder;
  }

  return { sortBy: validatedSortBy, sortOrder: validatedOrder };
}

/**
 * Sanitizes search input string.
 * @param {string|undefined} searchStr 
 * @param {number} maxLength 
 * @returns {string|null}
 */
function sanitizeSearch(searchStr, maxLength = 100) {
  if (!searchStr) return null;
  const trimmed = String(searchStr).trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}

module.exports = {
  parseDate,
  parseDateRange,
  parsePositiveInt,
  parsePagination,
  parseSort,
  sanitizeSearch,
};
