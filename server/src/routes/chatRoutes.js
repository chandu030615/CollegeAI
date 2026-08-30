const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/', authenticateToken, chatController.sendMessage);
router.post('/stream', authenticateToken, chatController.streamMessage);
router.get('/history', authenticateToken, chatController.getHistory);
router.get('/:id', authenticateToken, chatController.getConversation);
router.delete('/:id', authenticateToken, chatController.deleteConversation);

module.exports = router;
