// server/middleware/medicalUploadMiddleware.js
// File MỚI, không đụng đến file upload.js cũ

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Đường dẫn lưu file
const uploadDir = path.join(__dirname, '../uploads/medical-files');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình lưu trữ
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Chúng ta có thể tạo thư mục con dựa trên appointment code
    // Nhưng req.body có thể chưa có ở middleware. Tạm thời lưu chung.
    // Logic trong controller sẽ di chuyển file nếu cần.
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Tạo tên file unique để tránh trùng lặp
    const uniqueSuffix = uuidv4();
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Hàm lọc file (logic phức tạp)
const fileFilter = (req, file, cb) => {
  
  // Lọc Ảnh xét nghiệm (Tối đa 5MB)
  if (file.fieldname === 'test_images') {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true); // Chấp nhận file
    } else {
      cb(new Error('Chỉ chấp nhận ảnh (JPG, PNG, WEBP) cho ảnh xét nghiệm'), false);
    }
  } 
  // Lọc File báo cáo (Tối đa 10MB)
  else if (file.fieldname === 'report_files') {
    const allowedTypes = /pdf|doc|docx|application\/pdf|application\/msword|application\/vnd.openxmlformats-officedocument.wordprocessingml.document/;
    const extname = /\.(pdf|doc|docx)$/i.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true); // Chấp nhận file
    } else {
      cb(new Error('Chỉ chấp nhận file (PDF, DOC, DOCX) cho báo cáo'), false);
    }
  } 
  // Loại file không xác định
  else {
    cb(new Error('Trường upload file không hợp lệ'), false);
  }
};

// Cấu hình Multer
const medicalUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Giới hạn chung 10MB (sẽ check kỹ hơn ở controller nếu cần)
  }
});

// Export middleware xử lý 2 trường
module.exports = medicalUpload.fields([
  { name: 'test_images', maxCount: 10 }, // Tối đa 10 ảnh XN
  { name: 'report_files', maxCount: 20 }  // Tối đa 20 file báo cáo
]);