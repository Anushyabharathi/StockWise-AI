const aiService = require('../services/ai.service');
const activityService = require('../services/activity.service');
const { parseDate } = require('../middleware/validate');

/**
 * Controller for AI Business Intelligence endpoints.
 */
async function getStatus(req, res, next) {
  try {
    const status = aiService.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
}

async function getExecutiveBriefing(req, res, next) {
  try {
    const startDate = parseDate(req.query.startDate);
    const endDate = parseDate(req.query.endDate);

    const briefing = await aiService.generateExecutiveBriefing({
      startDate,
      endDate,
      admin: req.admin,
    });

    // Audit log
    await activityService.log({
      adminId: req.admin?.adminId || req.admin?.admin_id || null,
      action: 'AI_EXECUTIVE_BRIEFING',
      details: {
        engine: briefing.engine,
        model: briefing.model,
        startDate,
        endDate,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'SUCCESS',
    });

    res.json({
      success: true,
      data: briefing,
    });
  } catch (err) {
    next(err);
  }
}

async function askQuestion(req, res, next) {
  try {
    const { question, conversationHistory, startDate, endDate } = req.body || {};

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUESTION',
          message: 'Please provide a non-empty question string.',
        },
      });
    }

    const parsedStart = parseDate(startDate);
    const parsedEnd = parseDate(endDate);

    const result = await aiService.askQuestion({
      question: question.trim(),
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
      startDate: parsedStart,
      endDate: parsedEnd,
      admin: req.admin,
    });

    // Audit log
    await activityService.log({
      adminId: req.admin?.adminId || req.admin?.admin_id || null,
      action: 'AI_QUESTION_ASKED',
      details: {
        question: question.trim().slice(0, 200),
        engine: result.engine,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'SUCCESS',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatus,
  getExecutiveBriefing,
  askQuestion,
};
