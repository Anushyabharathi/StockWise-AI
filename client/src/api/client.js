const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Returns stored JWT token from localStorage.
 */
export function getStoredToken() {
  try {
    return localStorage.getItem('stockwise_token') || null;
  } catch {
    return null;
  }
}

/**
 * Returns stored admin profile from localStorage.
 */
export function getStoredAdmin() {
  try {
    const raw = localStorage.getItem('stockwise_admin');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Generic fetch wrapper with standardized error handling and token injection.
 * @param {string} endpoint
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getStoredToken();

  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401 && endpoint !== '/auth/login') {
        localStorage.removeItem('stockwise_token');
        localStorage.removeItem('stockwise_admin');
        window.dispatchEvent(new CustomEvent('stockwise:unauthorized'));
      }

      const err = new Error(data?.error?.message || `Request failed with status ${res.status}`);
      err.status = res.status;
      err.code = data?.error?.code || 'API_ERROR';
      err.details = data?.error?.details;
      err.response = data;
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const netErr = new Error('Backend server is unreachable. Please ensure the Express server is running on port 5000.');
      netErr.code = 'SERVER_OFFLINE';
      netErr.status = 0;
      throw netErr;
    }
    throw err;
  }
}

/**
 * Checks server health and database connection status.
 */
export async function getHealthStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    const data = await res.json().catch(() => null);
    return {
      isOnline: true,
      status: data?.status || (res.ok ? 'ok' : 'degraded'),
      database: data?.database || { connected: false, message: 'No status returned' },
    };
  } catch (err) {
    return {
      isOnline: false,
      status: 'offline',
      database: { connected: false, message: 'Backend server is not reachable' },
      error: err.message,
    };
  }
}

/**
 * Shop Admin Authentication: Login
 * @param {{ username: string, password: string }} credentials
 */
export async function loginAdmin({ username, password }) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  if (res?.token) {
    localStorage.setItem('stockwise_token', res.token);
    localStorage.setItem('stockwise_admin', JSON.stringify(res.admin));
  }
  return res;
}

/**
 * Shop Admin Authentication: Logout
 */
export async function logoutAdmin() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch (err) {
    console.warn('Logout API notification warning:', err);
  } finally {
    localStorage.removeItem('stockwise_token');
    localStorage.removeItem('stockwise_admin');
  }
}

/**
 * Shop Admin Authentication: Verify Session
 */
export async function getCurrentAdmin() {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await request('/auth/me');
    return res?.data || null;
  } catch {
    localStorage.removeItem('stockwise_token');
    localStorage.removeItem('stockwise_admin');
    return null;
  }
}

/**
 * Fetches database activity and audit logs.
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string|null} [options.action]
 * @param {number|null} [options.adminId]
 * @param {string|null} [options.startDate]
 * @param {string|null} [options.endDate]
 */
export async function getActivityLogs(options = {}) {
  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page);
  if (options.limit) params.append('limit', options.limit);
  if (options.action) params.append('action', options.action);
  if (options.adminId) params.append('adminId', options.adminId);
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await request(`/activity-logs${qs}`);
  return res || { data: [], pagination: {} };
}

/**
 * Fetches dashboard summary KPI metrics with optional date-range filtering.
 * @param {Object} [options]
 * @param {string|null} [options.startDate]
 * @param {string|null} [options.endDate]
 */
export async function getDashboardSummary(options = {}) {
  const params = new URLSearchParams();
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await request(`/dashboard/summary${qs}`);
  return res?.data || null;
}

/**
 * Fetches revenue and sales trends for a given period.
 * @param {'daily'|'weekly'|'monthly'|'yearly'} period
 * @param {Object} [options]
 * @param {number} [options.limit]
 * @param {string|null} [options.startDate]
 * @param {string|null} [options.endDate]
 */
export async function getTrends(period = 'monthly', options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit);
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await request(`/analytics/${period}${qs}`);
  return res?.data || [];
}

/**
 * Fetches category performance analytics.
 * @param {Object} [options]
 * @param {string|null} [options.startDate]
 * @param {string|null} [options.endDate]
 * @param {number} [options.limit]
 */
export async function getCategories(options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit);
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await request(`/analytics/categories${qs}`);
  return res?.data || [];
}

/**
 * Fetches weekday sales distribution analytics.
 * @param {Object} [options]
 * @param {string|null} [options.startDate]
 * @param {string|null} [options.endDate]
 */
export async function getDistribution(options = {}) {
  const params = new URLSearchParams();
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await request(`/analytics/distribution${qs}`);
  return res?.data || [];
}

/**
 * Fetches top-selling products based on actual sales data.
 * @param {Object} [options]
 * @param {number} [options.limit=10]
 * @param {string} [options.category]
 * @param {string|null} [options.startDate]
 * @param {string|null} [options.endDate]
 */
export async function getTopSelling(options = {}) {
  const params = new URLSearchParams();
  params.append('limit', options.limit || 10);
  if (options.category) params.append('category', options.category);
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);
  if (options.sortBy) params.append('sortBy', options.sortBy);
  if (options.sortOrder) params.append('sortOrder', options.sortOrder);

  const res = await request(`/products/top-selling?${params.toString()}`);
  return res?.data || [];
}

/**
 * Fetches full warehouse inventory catalog with pagination, filters, and status counts.
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 * @param {string|null} [options.search]
 * @param {string|null} [options.category]
 * @param {'ALL'|'HEALTHY'|'LOW'|'CRITICAL'|'OUT_OF_STOCK'} [options.status='ALL']
 * @param {string} [options.sortBy='deficit']
 * @param {'ASC'|'DESC'} [options.sortOrder='DESC']
 */
export async function getFullInventory(options = {}) {
  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page);
  if (options.limit) params.append('limit', options.limit);
  if (options.search) params.append('search', options.search);
  if (options.category) params.append('category', options.category);
  if (options.status) params.append('status', options.status);
  if (options.sortBy) params.append('sortBy', options.sortBy);
  if (options.sortOrder) params.append('sortOrder', options.sortOrder);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await request(`/inventory${qs}`);
  return res || { data: [], pagination: {}, statusCounts: {} };
}

/**
 * Legacy low-stock threshold fetcher.
 * @param {Object} [options]
 * @param {number} [options.limit=50]
 * @param {string} [options.category]
 */
export async function getLowStock(options = {}) {
  const params = new URLSearchParams();
  params.append('limit', options.limit || 50);
  if (options.category) params.append('category', options.category);

  const res = await request(`/inventory/low-stock?${params.toString()}`);
  return res?.data || [];
}

/**
 * Fetches paginated sales ledger transactions with item counts, revenue, and gross profit.
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @param {string|null} [options.startDate]
 * @param {string|null} [options.endDate]
 * @param {string|null} [options.search]
 * @param {string} [options.sortBy='sale_date']
 * @param {'ASC'|'DESC'} [options.sortOrder='DESC']
 */
export async function getSales(options = {}) {
  const params = new URLSearchParams();
  if (options.page) params.append('page', options.page);
  if (options.limit) params.append('limit', options.limit);
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);
  if (options.search) params.append('search', options.search);
  if (options.sortBy) params.append('sortBy', options.sortBy);
  if (options.sortOrder) params.append('sortOrder', options.sortOrder);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await request(`/sales${qs}`);
  return res || { data: [], pagination: {}, summary: {} };
}

/**
 * Fetches single sale transaction details including line items.
 * @param {number} saleId
 */
export async function getSaleById(saleId) {
  const res = await request(`/sales/${saleId}`);
  return res?.data || null;
}

/**
 * Triggers browser download of CSV sales report matching active filters.
 * @param {Object} [options]
 * @param {string|null} [options.startDate]
 * @param {string|null} [options.endDate]
 * @param {string|null} [options.search]
 * @param {string} [options.sortBy]
 * @param {'ASC'|'DESC'} [options.sortOrder]
 */
export async function exportSalesCsv(options = {}) {
  const params = new URLSearchParams();
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);
  if (options.search) params.append('search', options.search);
  if (options.sortBy) params.append('sortBy', options.sortBy);
  if (options.sortOrder) params.append('sortOrder', options.sortOrder);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const url = `${API_BASE_URL}/sales/export${qs}`;

  const token = getStoredToken();
  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error?.message || `CSV export failed with status ${res.status}`);
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `stockwise-sales-report-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
  return true;
}

/**
 * Checks AI integration status.
 */
export async function getAiStatus() {
  const res = await request('/ai/status');
  return res?.data || { configured: false };
}

/**
 * Generates an Executive AI Business Intelligence Briefing based on real database records.
 * @param {Object} [options]
 * @param {string|null} [options.startDate]
 * @param {string|null} [options.endDate]
 */
export async function getAiExecutiveBriefing(options = {}) {
  const params = new URLSearchParams();
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await request(`/ai/briefing${qs}`);
  return res?.data || null;
}

/**
 * Queries the AI Assistant with natural language business questions.
 * @param {Object} payload
 * @param {string} payload.question
 * @param {Array} [payload.conversationHistory]
 * @param {string|null} [payload.startDate]
 * @param {string|null} [payload.endDate]
 */
export async function askAiAssistant({ question, conversationHistory = [], startDate = null, endDate = null }) {
  const res = await request('/ai/ask', {
    method: 'POST',
    body: JSON.stringify({ question, conversationHistory, startDate, endDate }),
  });
  return res?.data || null;
}

// ===========================================================================
// CLAUDE AI USAGE & BUDGET MONITOR APIs
// ===========================================================================

export async function getClaudeBudget() {
  const res = await request('/claude-monitor/budget');
  return res?.data || null;
}

export async function getClaudeSummary(options = {}) {
  const params = new URLSearchParams();
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await request(`/claude-monitor/summary${qs}`);
  return res?.data || null;
}

export async function getClaudeRequests({
  page = 1,
  limit = 20,
  search = '',
  status = '',
  executionType = '',
  feature = '',
  startDate = null,
  endDate = null,
} = {}) {
  const params = new URLSearchParams();
  if (page) params.append('page', String(page));
  if (limit) params.append('limit', String(limit));
  if (search) params.append('search', search);
  if (status && status !== 'all') params.append('status', status);
  if (executionType && executionType !== 'all') params.append('executionType', executionType);
  if (feature && feature !== 'all') params.append('feature', feature);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await request(`/claude-monitor/requests${qs}`);
  return res?.data || { requests: [], pagination: { page: 1, limit, total: 0, pages: 1 } };
}

export async function getClaudeByFeature() {
  const res = await request('/claude-monitor/by-feature');
  return res?.data?.features || [];
}

export async function getClaudeByUser() {
  const res = await request('/claude-monitor/by-user');
  return res?.data?.users || [];
}

export async function getClaudeConnectionStatus() {
  const res = await request('/claude-monitor/connection-status');
  return res?.data || null;
}

export async function testClaudeConnection() {
  const res = await request('/claude-monitor/test-connection', {
    method: 'POST',
  });
  return res?.data || null;
}

export async function downloadClaudeUsageExport(format = 'csv', options = {}) {
  const params = new URLSearchParams({ format });
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);
  if (options.status && options.status !== 'all') params.append('status', options.status);
  if (options.executionType && options.executionType !== 'all') params.append('executionType', options.executionType);
  if (options.feature && options.feature !== 'all') params.append('feature', options.feature);
  if (options.limit) params.append('limit', String(options.limit));

  const token = getStoredToken();
  const url = `${API_BASE_URL}/claude-monitor/export?${params.toString()}`;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || 'Export failed');
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `stockwise-claude-ai-usage-${dateStr}.${format === 'json' ? 'json' : 'csv'}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
  return true;
}


