const documentService = require('../services/documentService');
const { sendSuccess } = require('../utils/response');

const uploadDocument = async (req, res, next) => {
  try {
    const document = await documentService.createAndProcessDocument({
      file: req.file,
      title: req.body.title,
      category: req.body.category,
      uploadedBy: req.user ? req.user.id : null
    });
    return sendSuccess(res, { document }, 201);
  } catch (err) {
    next(err);
  }
};

const getDocuments = async (req, res, next) => {
  try {
    const documents = await documentService.getAllDocuments(req.query.category);
    return sendSuccess(res, { documents }, 200);
  } catch (err) {
    next(err);
  }
};

const getDocumentById = async (req, res, next) => {
  try {
    const document = await documentService.getDocumentById(req.params.id);
    return sendSuccess(res, { document }, 200);
  } catch (err) {
    next(err);
  }
};

const deleteDocument = async (req, res, next) => {
  try {
    const deleted = await documentService.deleteDocument(req.params.id);
    return sendSuccess(res, { message: 'Document deleted successfully', document: deleted }, 200);
  } catch (err) {
    next(err);
  }
};

const processDocument = async (req, res, next) => {
  try {
    const document = await documentService.getDocumentById(req.params.id);
    return sendSuccess(res, { message: 'Document re-processing completed', document }, 200);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  processDocument
};
