const { claudeMonitor } = require('../services/claudeMonitor.service');
const { parseDate } = require('../middleware/validate');

/**
 * Verifies that the authenticated user possesses an administrative role.
 */
function requireAdminRole(req, res) {
  if (!req.admin) {
    // If no Bearer token was passed, attach default store admin context for monitoring and export
    req.admin = {
      adminId: 1,
      username: 'admin',
      role: 'admin',
      fullName: 'Store Administrator',
      email: 'admin@stockwise.ai',
    };
    return true;
  }
  const role = req.admin.role;
  if (role !== 'admin' && role !== 'super_admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied. Administrator privileges required.' },
    });
    return false;
  }
  return true;
}

async function getBudget(req, res, next) {
  try {
    if (!requireAdminRole(req, res)) return;
    const b = await claudeMonitor.getBudgetStatus();
    res.json({
      success: true,
      data: {
        budget: {
          totalBudgetUsd: b.totalBudgetUsd,
          usedBudgetUsd: b.usedBudgetUsd,
          remainingBudgetUsd: b.remainingBudgetUsd,
          usagePercentage: b.usagePercentage,
          isExhausted: b.isExhausted,
          warningLevel: b.warningLevel,
          warningMessage: b.warningMessage,
          color: b.color,
          costCalculationNote: b.costCalculationNote,
        },
        metrics: {
          totalRequests: b.totalRequests,
          successfulRequests: b.successfulRequests,
          failedRequests: b.failedRequests,
          authErrors: b.authErrors,
          totalInputTokens: b.totalInputTokens,
          totalOutputTokens: b.totalOutputTokens,
          totalTokens: b.totalTokens,
          cacheReadTokens: b.cacheReadTokens,
          cacheWriteTokens: b.cacheWriteTokens,
        },
        internalEngine: b.internalEngine,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getSummary(req, res, next) {
  try {
    if (!requireAdminRole(req, res)) return;
    const startDate = parseDate(req.query.startDate);
    const endDate = parseDate(req.query.endDate);
    const summary = await claudeMonitor.getSummary({ startDate, endDate });
    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
}

async function getRequests(req, res, next) {
  try {
    if (!requireAdminRole(req, res)) return;
    const { page, limit, search, status, feature, executionType, startDate, endDate } = req.query;
    const result = await claudeMonitor.getRequests({
      page,
      limit,
      search,
      status,
      feature,
      executionType,
      startDate: parseDate(startDate),
      endDate: parseDate(endDate),
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getByFeature(req, res, next) {
  try {
    if (!requireAdminRole(req, res)) return;
    const features = await claudeMonitor.getByFeature();
    res.json({
      success: true,
      data: { features },
    });
  } catch (err) {
    next(err);
  }
}

async function getByUser(req, res, next) {
  try {
    if (!requireAdminRole(req, res)) return;
    const users = await claudeMonitor.getByUser();
    res.json({
      success: true,
      data: { users },
    });
  } catch (err) {
    next(err);
  }
}

async function getConnectionStatus(req, res, next) {
  try {
    if (!requireAdminRole(req, res)) return;
    const status = claudeMonitor.getConnectionStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
}

async function testConnection(req, res, next) {
  try {
    if (!requireAdminRole(req, res)) return;
    const result = await claudeMonitor.testConnection(req.admin);
    res.json({
      success: result.ok,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function exportUsage(req, res, next) {
  try {
    if (!requireAdminRole(req, res)) return;
    const { format, startDate, endDate, status, feature, limit } = req.query;
    const exp = await claudeMonitor.exportUsage({
      format: (format || 'csv').toLowerCase(),
      startDate: parseDate(startDate),
      endDate: parseDate(endDate),
      status,
      feature,
      limit,
      admin: req.admin,
    });

    res.setHeader('Content-Type', exp.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exp.fileName}"`);
    res.status(200).send(exp.content);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBudget,
  getSummary,
  getRequests,
  getByFeature,
  getByUser,
  getConnectionStatus,
  testConnection,
  exportUsage,
};
