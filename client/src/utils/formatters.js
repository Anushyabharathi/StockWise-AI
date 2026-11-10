/**
 * Formats a numeric value into Indian Rupee (INR) currency representation.
 * @param {number|string|null|undefined} value
 * @param {boolean} [compact=false]
 * @returns {string}
 */
export function formatCurrencyINR(value, compact = false) {
  const num = typeof value === 'number' ? value : parseFloat(value || '0');
  if (isNaN(num)) return '₹0.00';

  if (compact && Math.abs(num) >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (compact && Math.abs(num) >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  if (compact && Math.abs(num) >= 1000) {
    return `₹${(num / 1000).toFixed(1)}k`;
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats a numeric value with standard Indian numbering commas.
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatNumber(value) {
  const num = typeof value === 'number' ? value : parseInt(value || '0', 10);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Formats a percentage value.
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatPercent(value) {
  const num = typeof value === 'number' ? value : parseFloat(value || '0');
  if (isNaN(num)) return '0.0%';
  return `${num.toFixed(1)}%`;
}

/**
 * Formats period date labels for display on charts and tables.
 * @param {string} periodStr 
 * @param {'day'|'week'|'month'|'year'} [periodType='day']
 * @returns {string}
 */
export function formatPeriodLabel(periodStr, periodType = 'day') {
  if (!periodStr) return '';

  try {
    if (periodType === 'day') {
      const date = new Date(periodStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
        });
      }
    }

    if (periodType === 'month') {
      const [year, month] = periodStr.split('-');
      if (year && month) {
        const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        return date.toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric',
        });
      }
    }

    if (periodType === 'week') {
      return periodStr.replace(/"W"/, ' Wk ');
    }

    return periodStr;
  } catch {
    return periodStr;
  }
}

/**
 * Computes ISO date strings for standard date presets.
 * @param {'all'|'today'|'last7'|'last30'} preset
 * @returns {{ startDate: string|null, endDate: string|null, label: string }}
 */
export function getDatePresetRange(preset) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (preset === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label: 'Today',
    };
  }

  if (preset === 'last7') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label: 'Last 7 Days',
    };
  }

  if (preset === 'last30') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label: 'Last 30 Days',
    };
  }

  if (preset === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label: 'This Month',
    };
  }

  if (preset === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return {
      startDate: start.toISOString(),
      endDate: lastMonthEnd.toISOString(),
      label: 'Last Month',
    };
  }

  return {
    startDate: null,
    endDate: null,
    label: 'All Time',
  };
}

/**
 * Formats ISO timestamp to human-friendly Indian locale date & time.
 * @param {string|Date|null|undefined} dateStr
 * @returns {string}
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

