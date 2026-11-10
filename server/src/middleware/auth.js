const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'stockwise-ai-shop-admin-jwt-key-secure-2026';
}

/**
 * Authentication middleware that verifies JWT tokens on protected admin routes.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    const error = new Error('Authentication required. Missing Bearer token in Authorization header.');
    error.status = 401;
    error.code = 'AUTH_TOKEN_MISSING';
    return next(error);
  }

  jwt.verify(token, getJwtSecret(), (err, admin) => {
    if (err) {
      const error = new Error(
        err.name === 'TokenExpiredError'
          ? 'Admin session expired. Please log in again.'
          : 'Invalid authentication token.'
      );
      error.status = 401;
      error.code = 'AUTH_TOKEN_INVALID';
      return next(error);
    }

    req.admin = admin;
    next();
  });
}

/**
 * Optional authentication middleware: attaches admin if token is provided, proceeds anyway if not.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    req.admin = null;
    return next();
  }

  jwt.verify(token, getJwtSecret(), (err, admin) => {
    if (!err && admin) {
      req.admin = admin;
    } else {
      req.admin = null;
    }
    next();
  });
}

module.exports = {
  authenticateToken,
  optionalAuth,
  getJwtSecret,
};
