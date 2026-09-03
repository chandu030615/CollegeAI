const errorHandler = (err, req, res, next) => {
  console.error('[API Error]:', err);

  const statusCode = err.statusCode || 500;
  const isInternalError = statusCode >= 500;
  const code = isInternalError ? 'INTERNAL_SERVER_ERROR' : (err.code || 'INTERNAL_SERVER_ERROR');
  const message = isInternalError
    ? 'An unexpected internal server error occurred.'
    : (err.message || 'An unexpected error occurred.');

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message
    }
  });
};

module.exports = {
  errorHandler
};
