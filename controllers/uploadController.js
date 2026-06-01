// server/controllers/uploadController.js
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

// File filter - chỉ cho phép ảnh
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WEBP)'));
  }
};

// Cấu hình multer - Tăng giới hạn lên 10MB
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: fileFilter
});

// Upload single image cho CKEditor
exports.uploadImage = (req, res) => {
  upload.single('upload')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          uploaded: false,
          error: { message: 'File quá lớn! Giới hạn 10MB.' }
        });
      }
      return res.status(400).json({
        uploaded: false,
        error: { message: err.message }
      });
    } else if (err) {
      return res.status(400).json({
        uploaded: false,
        error: { message: err.message }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        uploaded: false,
        error: { message: 'Không có file nào được upload' }
      });
    }

    // Trả về relative URL
const imageUrl = `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}`;    
    // Response format cho CKEditor 5
    res.json({
      uploaded: true,
      url: imageUrl
    });
  });
};

// Upload multiple images
exports.uploadMultipleImages = (req, res) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có file nào được upload'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      name: file.originalname,
      size: file.size,
      // Đảm bảo đường dẫn này khớp với cấu hình static ở index.js
      url: `/uploads/images/${file.filename}` 
    }));

    res.json({
      success: true,
      files: uploadedFiles
    });
  });
};

// Delete image
exports.deleteImage = (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({
        success: true,
        message: 'Đã xóa ảnh thành công'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy file'
      });
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};