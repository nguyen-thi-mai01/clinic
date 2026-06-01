// server/routes/medicalRecordRoutes.js
// PHIÊN BẢN ĐÃ SỬA LỖI THỨ TỰ ROUTE

const express = require('express');
const router = express.Router();
const medicalRecordController = require('../controllers/medicalRecordController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Import middleware upload MỚI
const medicalUploadMiddleware = require('../middleware/medicalUploadMiddleware');

// === Bác sĩ / Admin ===

// Tạo Hồ sơ y tế (POST /api/medical-records)
router.post(
  '/',
  authenticateToken,
  authorize('doctor', 'admin'),
  medicalUploadMiddleware,
  medicalRecordController.createMedicalRecord
);

// Staff vận hành lâm sàng nhập vital signs trước khi khám
// POST /api/medical-records/staff/vitals
router.post(
  '/staff/vitals',
  authenticateToken,
  authorize('admin', 'staff'),
  medicalRecordController.inputVitalsByStaff
);

// Staff cập nhật vitals đã nhập
// PUT /api/medical-records/staff/vitals/:appointmentId
router.put(
  '/staff/vitals/:appointmentId',
  authenticateToken,
  authorize('admin', 'staff'),
  medicalRecordController.updateVitalsByStaff
);

// Cập nhật Hồ sơ y tế (PUT /api/medical-records/:id)
router.put(
  '/:id', // id ở đây là ID của MedicalRecord
  authenticateToken,
  authorize('doctor', 'admin'),
  medicalUploadMiddleware,
  medicalRecordController.updateMedicalRecord
);

// === Bệnh nhân (Đã đăng nhập) ===

// SỬA LỖI: Route này PHẢI được định nghĩa TRƯỚC route '/:id'
// Lấy tất cả hồ sơ của tôi (GET /api/medical-records/my-records)
router.get(
  '/my-records',
  authenticateToken,
  authorize('patient', 'doctor', 'admin', 'staff'),
  medicalRecordController.getMyMedicalRecords
);
// KẾT THÚC SỬA LỖI

// Xác thực mật khẩu của Patient/Admin trước khi xem
router.post(
  '/verify-password',
  authenticateToken,
  authorize('patient', 'admin'),
  medicalRecordController.verifyUserPassword
);

// === Khách (Guest) / Public ===

// Tra cứu công khai (Public)
router.post(
  '/lookup',
  medicalRecordController.lookupMedicalRecord
);

// Gửi lại mã tra cứu (Public)
router.post(
  '/resend-code',
  medicalRecordController.resendLookupCode
);

// === Admin ===

// SỬA LỖI: Route này PHẢI được định nghĩa TRƯỚC route '/:id'
// Lấy danh sách (cho Admin)
router.get(
  '/admin/all',
  authenticateToken,
  authorize('admin', 'staff'),
  medicalRecordController.getAdminMedicalRecords
);
// KẾT THÚC SỬA LỖI

// // Tiết lộ mã tra cứu (Admin)
// router.post(
//   '/admin/reveal-code',
//   authenticateToken,
//   authorize('admin'),
//   medicalRecordController.revealLookupCode
// );

router.post(
  '/admin/reset-code', // Đổi tên route
  authenticateToken,
  authorize('admin', 'staff'), // Cho phép cả Staff reset
  medicalRecordController.resetLookupCodeByAdmin // Gọi hàm mới
);

// === ROUTE ĐỘNG (PHẢI Ở CUỐI CÙNG) ===

// Lấy chi tiết Hồ sơ y tế (cho Bác sĩ/Admin/Patient xem)
// Dùng ID của MedicalRecord
// Route này sẽ bắt 'GET /:id' (ví dụ: /123, /456)
router.get(
  '/:id',
  authenticateToken,
  authorize('patient', 'doctor', 'admin', 'staff'),
  medicalRecordController.getMedicalRecordById
);


module.exports = router;