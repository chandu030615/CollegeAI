const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/', authenticateToken, requireAdmin, upload.single('file'), documentController.uploadDocument);
router.get('/', authenticateToken, documentController.getDocuments);
router.get('/:id', authenticateToken, documentController.getDocumentById);
router.delete('/:id', authenticateToken, requireAdmin, documentController.deleteDocument);
router.post('/:id/process', authenticateToken, requireAdmin, documentController.processDocument);

module.exports = router;
