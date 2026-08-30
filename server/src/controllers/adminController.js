const adminService = require('../services/adminService');
const { sendSuccess } = require('../utils/response');

const getDashboard = async (req, res, next) => {
  try {
    const stats = await adminService.getDashboardStats();
    return sendSuccess(res, { stats }, 200);
  } catch (err) {
    next(err);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const users = await adminService.getAllUsers();
    return sendSuccess(res, { users }, 200);
  } catch (err) {
    next(err);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getAnalytics();
    return sendSuccess(res, { analytics }, 200);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboard,
  getUsers,
  getAnalytics
};
