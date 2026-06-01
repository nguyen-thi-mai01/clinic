// ============================================
// server/config/upload.js - Cấu hình upload ảnh
// ============================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Tạo thư mục uploads nếu chưa tồn tại
const uploadDir = path.join(__dirname, '../uploads/images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'article-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter - cho phép ảnh + documents
const fileFilter = (req, file, cb) => {
  // Chấp nhận mọi loại file cho chat (ảnh, PDF, Word, Excel...)
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|txt|mp3|mp4|wav/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  
  // Nếu không có extension match, kiểm tra mimetype
  const allowedMimeTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'audio/mpeg', 'audio/wav',
    'video/mp4'
  ];
  
  const mimetypeValid = allowedMimeTypes.includes(file.mimetype);
  
  if (extname || mimetypeValid) {
    return cb(null, true);
  } else {
    cb(null, true); // ✅ TẠM THỜI CHO PHÉP TẤT CẢ để test
    // cb(new Error('Loại file không được hỗ trợ'));
  }
};

// Cấu hình multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter
});

module.exports = upload;
