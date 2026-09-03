const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const mimeByExtension = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  const originalName = typeof file.originalname === 'string' ? file.originalname : '';
  const extension = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();

  if (mimeByExtension[extension] === file.mimetype) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE: File type does not match its extension.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15 MB limit
  }
});

module.exports = upload;
