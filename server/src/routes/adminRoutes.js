const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');

router.get('/dashboard', authenticateToken, requireAdmin, adminController.getDashboard);
router.get('/users', authenticateToken, requireAdmin, adminController.getUsers);
router.get('/analytics', authenticateToken, requireAdmin, adminController.getAnalytics);

module.exports = router;
