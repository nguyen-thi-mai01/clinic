// server/routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../config/upload'); // Giữ nguyên multer config
const { authenticateToken } = require('../middleware/authMiddleware');
const uploadController = require('../controllers/uploadController'); // ✅ THÊM: Import controller
const path = require('path');
const fs = require('fs');

// ===================================================================
// ROUTE 1: Upload ảnh bìa/Ảnh thông thường (POST /api/upload/image)
// 
// Dùng cho ảnh bìa (ArticleManagementPage.js -> handleCoverImageUpload)
// Sử dụng config multer cục bộ: upload.single('image')
// ===================================================================
router.post('/image', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không có file nào được upload' 
      });
    }

    // Xóa ảnh cũ nếu có (logic giữ nguyên)
    if (req.body.oldImage) {
      // Logic xóa ảnh cũ
      const oldImagePath = path.join(__dirname, '..', req.body.oldImage);
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
          console.log('Đã xóa ảnh cũ:', req.body.oldImage);
        } catch (err) {
          console.error('Lỗi khi xóa ảnh cũ:', err);
        }
      }
    }

    // ✅ QUAN TRỌNG: Trả về URL đầy đủ với protocol và host
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}`;
    
    console.log('Upload ảnh bìa thành công:', imageUrl);
    
    res.json({
      success: true,
      url: imageUrl, // ✅ URL đầy đủ: http://localhost:3001/uploads/images/article-123456.jpg
      file: {
        name: req.file.originalname,
        size: req.file.size,
        url: imageUrl
      }
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ===================================================================
// ROUTE 2: Upload ảnh CKEditor (POST /api/upload/ckeditor-image)
// 
// Dùng cho ảnh trong nội dung (ArticleManagementPage.js -> MyUploadAdapter)
// Trỏ đến hàm Controller đã được sửa để trả về format CKEditor 5
// ===================================================================
router.post('/ckeditor-image', authenticateToken, uploadController.uploadImage);


module.exports = router;