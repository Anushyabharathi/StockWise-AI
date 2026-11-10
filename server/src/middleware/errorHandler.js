/**
 * Centralized Express Error Handling Middleware.
 * Catches all errors from async controllers and standard Express errors,
 * formatting responses uniformly and masking sensitive internal errors.
 */
function errorHandler(err, req, res, next) {
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  // Handle PostgreSQL specific errors
  if (err.code === 'DATABASE_UNCONFIGURED') {
    statusCode = 503;
    message = err.message;
    errorCode = 'DATABASE_UNCONFIGURED';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Unable to connect to database host. Ensure PostgreSQL service is running.';
    errorCode = 'DATABASE_CONNECTION_REFUSED';
  } else if (err.code === '28P01') {
    statusCode = 500;
    message = 'Database authentication failed. Please verify your DB_USER and DB_PASSWORD credentials.';
    errorCode = 'DATABASE_AUTH_FAILED';
  } else if (err.code === '3D000') {
    statusCode = 500;
    message = 'Specified database name does not exist. Please check DB_NAME.';
    errorCode = 'DATABASE_NOT_FOUND';
  } else if (err.code === '42P01') {
    statusCode = 500;
    message = `Database table missing: ${err.message}`;
    errorCode = 'DATABASE_TABLE_MISSING';
  } else if (err.name === 'ZodError') {
    statusCode = 400;
    message = 'Validation Error';
    errorCode = 'VALIDATION_ERROR';
    return res.status(400).json({
      success: false,
      error: {
        message,
        code: errorCode,
        details: err.errors ? err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })) : err.message,
      },
    });
  }

  console.error(`[Error] [${req.method} ${req.url}] ${errorCode}: ${err.message}`);

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: errorCode,
      status: statusCode,
    },
  });
}

/**
 * 404 Not Found Middleware for unmatched routes.
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      code: 'ROUTE_NOT_FOUND',
      status: 404,
    },
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
