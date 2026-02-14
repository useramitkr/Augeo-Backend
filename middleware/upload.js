const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'kycDocuments') {
      cb(null, 'uploads/documents');
    } else {
      cb(null, 'uploads/images');
    }
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedDocTypes = /pdf|jpeg|jpg|png/;

  if (file.fieldname === 'kycDocuments') {
    const extname = allowedDocTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedDocTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
  } else {
    const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    if (extname || mimetype) {
      return cb(null, true);
    }
  }

  cb(new Error('Invalid file type'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
});

module.exports = upload;
