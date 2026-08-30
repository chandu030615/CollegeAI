const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { sendError } = require('../utils/response');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return sendError(res, 'AUTHENTICATION_REQUIRED', 'Authentication token is required.', 401);
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return sendError(res, 'AUTHENTICATION_REQUIRED', 'Invalid or expired authentication token.', 401);
  }
};

module.exports = {
  authenticateToken
};
