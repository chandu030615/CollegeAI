const { sendError } = require('../utils/response');

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return sendError(res, 'FORBIDDEN', 'Administrator access required.', 403);
  }
  next();
};

module.exports = {
  requireAdmin
};
