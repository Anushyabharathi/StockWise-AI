const authService = require('../services/auth.service');

/**
 * Controller handling shop admin authentication.
 */
async function login(req, res, next) {
  try {
    const { username, email, password } = req.body;
    const usernameOrEmail = username || email;

    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const result = await authService.login({
      usernameOrEmail,
      password,
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      message: 'Login successful.',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const adminId = req.admin?.adminId || null;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    await authService.logout({
      adminId,
      ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      message: 'Signed out successfully.',
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    if (!req.admin?.adminId) {
      const error = new Error('Not authenticated.');
      error.status = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    const admin = await authService.getMe(req.admin.adminId);
    if (!admin) {
      const error = new Error('Admin user not found.');
      error.status = 404;
      error.code = 'ADMIN_NOT_FOUND';
      throw error;
    }

    res.json({
      success: true,
      data: admin,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  logout,
  getMe,
};
