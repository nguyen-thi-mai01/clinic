// server/routes/consultationRoutes.js
// ✅ HOÀN CHỈNH: Routes cho chức năng tư vấn trực tuyến + ADMIN REALTIME

const express = require('express');
const router = express.Router();

const consultationController = require('../controllers/consultationController');
const consultationAdminController = require('../controllers/consultationAdminController');

const { authMiddleware, authorize } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware'); // ✅ THÊM: Middleware phân quyền chi tiết

// ==================== PUBLIC ROUTES (Không cần auth) ====================

/**
 * Lấy bảng giá tư vấn của bác sĩ (Public)
 * GET /api/consultations/pricing/:doctor_id
 */
router.get(
  '/pricing/:doctor_id',
  consultationController.getDoctorPricing
);

/**
 * Tính phí tư vấn ước lượng (Public)
 * POST /api/consultations/calculate-fee
 */
router.post(
  '/calculate-fee',
  consultationController.calculateConsultationFee
);

/**
 * Lấy danh sách bác sĩ để đặt lịch tư vấn
 * GET /api/consultations/chon-bac-si
 * Auth: Optional (public)
 */
router.get('/chon-bac-si', consultationController.getAvailableDoctors);

/**
 * Lấy danh sách gói dịch vụ tư vấn trực tuyến (Public)
 * GET /api/consultations/packages
 * Auth: None (public)
 */
router.get('/packages', consultationController.getAllPublicPackages);

// ==================== PATIENT ROUTES ====================

/**
 * Tạo tư vấn mới (đặt lịch)
 * POST /api/consultations
 * Auth: Required
 * Role: patient, staff, admin (quầy tiếp đón cần tạo giúp)
 */
router.post(
  '/',
  authMiddleware,
  authorize('patient', 'staff', 'admin'),
  consultationController.createConsultation
);

/**
 * Lấy danh sách tư vấn của bệnh nhân
 * GET /api/consultations/my-consultations
 * Auth: Required
 * Role: patient
 */
router.get(
  '/my-consultations',
  authMiddleware,
  authorize('patient'),
  consultationController.getMyConsultations
);

/**
 * Đánh giá buổi tư vấn
 * PUT /api/consultations/:id/rate
 * Auth: Required
 * Role: patient
 */
router.put(
  '/:id/rate',
  authMiddleware,
  authorize('patient'),
  consultationController.rateConsultation
);

/**
 * Thống kê tư vấn của bệnh nhân
 * GET /api/consultations/patient/stats
 * Auth: Required
 * Role: patient
 */
router.get(
  '/patient/stats',
  authMiddleware,
  authorize('patient'),
  consultationController.getPatientStats
);

/**
 * LẤY KHUNG GIỜ KHẢ DỤNG (CHO TRANG ĐẶT LỊCH)
 * GET /api/consultations/available-slots
 * Auth: Required
 * Role: patient, staff, admin (quầy tiếp đón cần xem slot)
 */
router.get(
  '/available-slots',
  authMiddleware,
  authorize('patient', 'staff', 'admin'),
  consultationController.getAvailableSlots
);

/**
 * Gửi đánh giá (Feedback) MỚI
 * POST /api/consultations/feedback
 */
router.post(
  '/feedback',
  authMiddleware,
  authorize('patient'),
  consultationController.submitConsultationFeedback
);

// ==================== DOCTOR ROUTES ====================

/**
 * Lấy danh sách tư vấn của bác sĩ
 * GET /api/consultations/doctor/my-consultations
 * Auth: Required
 * Role: doctor
 */
router.get(
  '/doctor/my-consultations',
  authMiddleware,
  authorize('doctor'),
  consultationController.getDoctorConsultations
);

/**
 * Xác nhận tư vấn (Bác sĩ chấp nhận)
 * PUT /api/consultations/:id/confirm
 * Auth: Required
 * Role: doctor
 */
router.put(
  '/:id/confirm',
  authMiddleware,
  authorize('doctor'),
  consultationController.confirmConsultation
);

/**
 * Kết thúc tư vấn và điền kết quả
 * PUT /api/consultations/:id/complete
 * Auth: Required
 * Role: doctor
 */
router.put(
  '/:id/complete',
  authMiddleware,
  authorize('doctor'),
  consultationController.completeConsultation
);

/**
 * Lưu nháp kết quả tư vấn
 * PUT /api/consultations/:id/draft
 */
router.put(
  '/:id/draft',
  authMiddleware,
  authorize('doctor'),
  consultationController.saveConsultationDraft
);

/**
 * Thống kê tư vấn của bác sĩ
 * GET /api/consultations/doctor/stats
 * Auth: Required
 * Role: doctor
 */
router.get(
  '/doctor/stats',
  authMiddleware,
  authorize('doctor'),
  consultationController.getDoctorStats
);

/**
 * Báo cáo doanh thu của bác sĩ
 * GET /api/consultations/doctor/revenue
 * Auth: Required
 * Role: doctor
 */
router.get(
  '/doctor/revenue',
  authMiddleware,
  authorize('doctor'),
  consultationController.getDoctorRevenue
);

// ==================== COMMON ROUTES (Patient + Doctor) ====================

// ==================== COMMON ROUTES (Patient + Doctor) ====================

// ==================================================================
// ⚠️ QUAN TRỌNG: PHÂN QUYỀN CHI TIẾT CHO TƯ VẤN
// Staff Support có quyền consultations:view, consultations:assign
// Staff từ phòng ban khác KHÔNG được truy cập
// ==================================================================

// 💰 DANH SÁCH YÊU CẦU HOÀN TIỀN - Yêu cầu quyền 'consultations:view'
// Staff Support xem các yêu cầu hoàn tiền từ tư vấn
router.get(
  '/refunds',
  authMiddleware,
  roleMiddleware('consultations:view'),
  consultationAdminController.getRefundList
);

/**
 * 🚨 DANH SÁCH SỰ CỐ (Incidents)
 * GET /api/consultations/admin/realtime/incidents
 */

router.get(
  '/my-reports',
  authMiddleware,
  consultationController.getConsultationReports
);

// Bệnh nhân xem tin nhắn hệ thống của phiên tư vấn
router.get(
  '/:id/messages',
  authMiddleware,
  authorize('patient', 'doctor'),
  consultationAdminController.getConsultationMessages
);

// Bệnh nhân gửi phản hồi sự cố
router.post(
  '/:id/report-reply',
  authMiddleware,
  authorize('patient', 'doctor'),
  consultationController.replyToReport
);

router.get(
  '/:id',
  authMiddleware,
  authorize('patient', 'doctor', 'admin', 'staff'),
  consultationController.getConsultationById
);
/**
 * Bắt đầu tư vấn (Vào phòng chat)
 * PUT /api/consultations/:id/start
 * Auth: Required
 * Role: patient, doctor
 */
router.put(
  '/:id/start',
  authMiddleware,
  authorize('patient', 'doctor'),
  consultationController.startConsultation
);

/**
 * Hủy tư vấn
 * PUT /api/consultations/:id/cancel
 * Auth: Required
 * Role: patient, doctor
 */
router.put(
  '/:id/cancel',
  authMiddleware,
  authorize('patient', 'doctor'),
  consultationController.cancelConsultation
);

/**
 * Đổi lịch tư vấn (1 lần, trước 24h, slot rảnh tự xác nhận)
 * PUT /api/consultations/:id/reschedule
 */
router.put(
  '/:id/reschedule',
  authMiddleware,
  authorize('patient'),
  consultationController.rescheduleConsultation
);

/**
 * 💳 CẬP NHẬT THÔNG TIN THANH TOÁN
 * PUT /api/consultations/:id/payment
 * Yêu cầu quyền 'consultations:assign' (Staff Support có thể cập nhật payment)
 */
router.put(
  '/:id/payment',
  authMiddleware,
  roleMiddleware('consultations:assign'),
  consultationAdminController.updatePaymentInfo
);

/**
 * 🔄 CẬP NHẬT TRẠNG THÁI TƯ VẤN
 * PUT /api/consultations/:id/status
 * Yêu cầu quyền 'consultations:assign' (Phân công, thay đổi trạng thái)
 * Body: { status: 'pending'|'confirmed'|'upcoming'|'in_progress'|'completed'|'passed'|'cancelled'|'rejected'|'expired' }
 */
router.put(
  '/:id/status',
  authMiddleware,
  roleMiddleware('consultations:assign'),
  consultationAdminController.updateStatus
);

/**
 * ✅ MỚI: Lấy thông tin consultation cho Video Call
 * GET /api/consultations/video/:id
 * Auth: Required
 * Role: patient, doctor
 */
router.get(
  '/video/:id',
  authMiddleware,
  authorize('patient', 'doctor'),
  async (req, res) => {
    try {
      // Gọi lại hàm getConsultationById
      req.params.id = req.params.id; // Giữ nguyên param
      return consultationController.getConsultationById(req, res);
    } catch (error) {
      console.error('Error in video consultation route:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin phòng video',
        error: error.message
      });
    }
  }
);

router.post(
  '/:id/verify-video-otp',
  authMiddleware,
  authorize('patient'),
  consultationController.verifyVideoOtp // Hàm mới sẽ tạo ở bước 4.2
);

/**
 * MỚI: Gửi lại OTP (Video)
 * POST /api/consultations/:id/resend-video-otp
 */
router.post(
  '/:id/resend-video-otp',
  authMiddleware,
  authorize('patient'),
  consultationController.resendVideoOtp
);

/**
 * Gửi lại OTP (Chat)
 * POST /api/consultations/:id/resend-otp
 * Auth: Required
 * Role: patient, doctor, admin
 */
router.post(
  '/:id/resend-otp',
  authMiddleware,
  authorize('patient', 'doctor', 'admin'),
  consultationController.resendConsultationOtp
);

// MỚI: Xác thực mật khẩu để vào phòng chat
router.post(
  '/:id/verify-password',
  authMiddleware,
  authorize('patient', 'doctor'),
  consultationController.verifyRoomPassword
);

/**
 * Gửi Báo cáo Vấn đề (Từ phòng chat)
 * POST /api/consultations/:id/report
 */
router.post(
  '/:id/report',
  authMiddleware,
  authorize('patient', 'doctor'),
  consultationController.createConsultationReport
);

// ==================== ✅ ADMIN REALTIME MANAGEMENT ROUTES ====================
// ==================================================================
// ⚠️ PHÂN QUYỀN REALTIME CHO STAFF SUPPORT & IT
// Staff có quyền giám sát, gửi tin nhắn, xử lý sự cố
// ==================================================================

/**
 * 📋 DANH SÁCH TƯ VẤN REALTIME
 * GET /api/consultations/admin/realtime/all
 */
router.get(
  '/admin/realtime/all',
  authMiddleware,
  // SỬA: Đổi sang quyền consultation_realtime:monitor
  roleMiddleware('consultation_realtime:monitor', ['admin', 'doctor', 'staff']),
  consultationAdminController.getAllConsultationsRealtime
);

/**
 * 📡 GIÁM SÁT PHIÊN ĐANG HOẠT ĐỘNG
 * GET /api/consultations/admin/realtime/active
 */
router.get(
  '/admin/realtime/active',
  authMiddleware,
  // SỬA: Đổi sang quyền consultation_realtime:monitor
  roleMiddleware('consultation_realtime:monitor', ['admin', 'doctor', 'staff']),
  consultationAdminController.getActiveConsultations
);

/**
 * 💬 XEM NỘI DUNG CHAT (Read-only)
 * GET /api/consultations/admin/realtime/:id/messages
 */
router.get(
  '/admin/realtime/:id/messages',
  authMiddleware,
  // SỬA: Đổi sang quyền consultation_realtime:monitor
  roleMiddleware('consultation_realtime:monitor', ['admin', 'doctor', 'staff']),
  consultationAdminController.getConsultationMessages
);

/**
 * 📢 GỬI TIN NHẮN HỆ THỐNG
 * POST /api/consultations/admin/realtime/:id/system-message
 */
router.post(
  '/admin/realtime/:id/system-message',
  authMiddleware,
  // Cho phép staff có quyền reply (CSKH) HOẶC admin
  roleMiddleware('consultations:reply', ['admin', 'staff']),
  consultationAdminController.sendSystemMessage
);

/**
 * 🛑 KẾT THÚC PHIÊN THỦ CÔNG
 * PUT /api/consultations/admin/realtime/:id/force-end
 */
router.put(
  '/admin/realtime/:id/force-end',
  authMiddleware,
  // SỬA: Đổi sang quyền consultation_realtime:resolve_errors
  roleMiddleware('consultation_realtime:resolve_errors', ['admin', 'staff']),
  consultationAdminController.forceEndConsultation
);



// Admin xem lịch sử chat của phiên
router.get(
  '/admin/realtime/:id/messages',
  authMiddleware,
  roleMiddleware(['admin', 'staff']),
  consultationAdminController.getConsultationMessages
);
router.get(
  '/admin/realtime/incidents',
  authMiddleware,
  // SỬA: Đổi sang quyền consultation_realtime:monitor
  roleMiddleware('consultation_realtime:monitor', ['admin', 'staff']),
  consultationAdminController.getPendingIncidents
);

/**
 * ✅ XỬ LÝ (ĐÓNG) SỰ CỐ
 * PUT /api/consultations/admin/realtime/incidents/:id/resolve
 */
router.put(
  '/admin/realtime/incidents/:id/resolve',
  authMiddleware,
  // SỬA: Đổi sang quyền consultation_realtime:resolve_errors
  roleMiddleware('consultation_realtime:resolve_errors', ['admin', 'staff']),
  consultationAdminController.resolveIncident
);

/**
 * Duyệt lịch tư vấn (Admin/Manager)
 * PUT /api/consultations/admin/realtime/:id/approve
 */
router.put(
  '/admin/realtime/:id/approve',
  authMiddleware,
  // Đã thêm 'doctor' vào danh sách cho phép
  roleMiddleware('consultations:approve', ['admin', 'staff', 'doctor']), 
  consultationAdminController.approveConsultation
);

/**
 * Từ chối lịch tư vấn (Admin/Manager)
 * PUT /api/consultations/admin/realtime/:id/reject
 */
router.put(
  '/admin/realtime/:id/reject',
  authMiddleware,
  // Đã thêm 'doctor' vào danh sách cho phép
  roleMiddleware('consultations:approve', ['admin', 'staff', 'doctor']),
  consultationAdminController.rejectConsultation
);
/**
 * 🚫 HỦY LỊCH ĐÃ XÁC NHẬN - Yêu cầu quyền 'consultations:close'
 * PUT /api/consultations/admin/realtime/:id/cancel-confirmed
 */
router.put(
  '/admin/realtime/:id/cancel-confirmed',
  authMiddleware,
  roleMiddleware('consultations:close', ['admin', 'staff', 'patient', 'doctor']),
  consultationAdminController.cancelConfirmedConsultation
);

/**
 * 3. QUẢN LÝ GÓI DỊCH VỤ
 * GET /api/consultations/admin/packages
 */
router.get(
  '/admin/packages',
  authMiddleware,
  async (req, res, next) => {
    // Admin có toàn quyền
    if (req.user.role === 'admin') return next();
    
    // Staff phải có ít nhất 1 quyền về consultation_pricing
    if (req.user.role === 'staff') {
      const { models } = require('../config/db');
      const staffProfile = await models.Staff.findOne({ where: { user_id: req.user.id } });
      
      if (!staffProfile) {
        return res.status(403).json({ success: false, message: 'Không tìm thấy hồ sơ nhân viên.' });
      }
      
      const { department, permissions } = staffProfile;
      
      // Phải thuộc phòng system hoặc support và có ít nhất 1 quyền về consultation_pricing
      if ((department === 'system' || department === 'support') && 
          permissions && 
          permissions.consultation_pricing && 
          Array.isArray(permissions.consultation_pricing) && 
          permissions.consultation_pricing.length > 0) {
        return next();
      }
      
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền xem gói tư vấn. Cần ít nhất 1 quyền về module Consultation Pricing.',
        yourDepartment: department,
        yourPermissions: permissions?.consultation_pricing
      });
    }
    
    return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });
  },
  consultationAdminController.getAllPackages
);

/**
 * Tạo gói dịch vụ mới (Admin or Staff with permission)
 * POST /api/consultations/admin/packages
 */
router.post(
  '/admin/packages',
  authMiddleware,
  (req, res, next) => {
    if (req.user.role === 'admin') return next();
    return roleMiddleware('CONSULTATION_PRICING_CREATE')(req, res, next);
  },
  consultationAdminController.createPackage
);

/**
 * Cập nhật gói dịch vụ (Admin or Staff with permission)
 * PUT /api/consultations/admin/packages/:id
 */
router.put(
  '/admin/packages/:id',
  authMiddleware,
  (req, res, next) => {
    if (req.user.role === 'admin') return next();
    return roleMiddleware('CONSULTATION_PRICING_EDIT')(req, res, next);
  },
  consultationAdminController.updatePackage
);

/**
 * Xóa gói dịch vụ (Admin or Staff with permission)
 * DELETE /api/consultations/admin/packages/:id
 */
router.delete(
  '/admin/packages/:id',
  authMiddleware,
  (req, res, next) => {
    if (req.user.role === 'admin') return next();
    return roleMiddleware('CONSULTATION_PRICING_DELETE')(req, res, next);
  },
  consultationAdminController.deletePackage
);

/**
 * Cập nhật gói dịch vụ
 * PUT /api/consultations/admin/packages/:doctorId
 */
router.put(
  '/admin/packages/:doctorId',
  authMiddleware,
  authorize('admin'),
  consultationAdminController.updateDoctorPackage
);

/**
 * 4. QUẢN LÝ HOÀN TIỀN
 */

// ✅ SỬA: Thêm route này để khớp với Frontend gọi /api/consultations/refunds
// Cho phép cả Admin và Staff truy cập
router.get(
  '/refunds',
  authMiddleware,
  authorize('admin', 'staff'),
  consultationAdminController.getRefundList
);

// Giữ lại route cũ nếu cần, nhưng mở quyền cho Staff
router.get(
  '/admin/refunds',
  authMiddleware,
  authorize('admin', 'staff'),
  consultationAdminController.getRefundList
);

/**
 * Xử lý hoàn tiền (Admin + Staff)
 */
router.post(
  '/admin/refunds/:id/process',
  authMiddleware,
  authorize('admin', 'staff'),
  consultationAdminController.processRefund
);



/**
 * 5. QUẢN LÝ PHẢN HỒI & ĐÁNH GIÁ
 * GET /api/consultations/admin/feedbacks
 */
router.get(
  '/admin/feedbacks',
  authMiddleware,
  // ✅ SỬA: Thêm 'doctor' vào danh sách cho phép
  authorize('admin', 'staff', 'doctor'), 
  consultationAdminController.getAllFeedbacks
);



/**
 * 6. BÁO CÁO & THỐNG KÊ
 * Thống kê tổng quan
 * GET /api/consultations/admin/statistics/overview
 */
router.get(
  '/admin/statistics/overview',
  authMiddleware,
  // ✅ SỬA: Thêm 'doctor' vào đây
  authorize('admin', 'staff', 'doctor'), 
  consultationAdminController.getSystemStatistics
);

/**
 * Thống kê theo bác sĩ
 * GET /api/consultations/admin/statistics/by-doctor
 */
router.get(
  '/admin/statistics/by-doctor',
  authMiddleware,
  // ✅ SỬA: Thêm 'doctor' vào đây
  authorize('admin', 'staff', 'doctor'),
  consultationAdminController.getDoctorStatistics
);

/**
 * Thống kê theo bệnh nhân
 * GET /api/consultations/admin/statistics/by-patient
 */
router.get(
  '/admin/statistics/by-patient',
  authMiddleware,
  // ✅ SỬA: Thêm 'doctor' vào đây
  authorize('admin', 'staff', 'doctor'),
  consultationAdminController.getPatientStatistics
);

/**
 * 7. EXPORT
 * GET /api/consultations/admin/export
 */
router.get(
  '/admin/export',
  authMiddleware,
  authorize('admin', 'staff'),
  consultationAdminController.exportConsultations
);

// ==================== ADMIN ROUTES (CŨ - GIỮ LẠI) ====================

/**
 * Lấy tất cả tư vấn (Admin)
 * GET /api/consultations/admin/all
 * Auth: Required
 * Role: admin
 */
router.get(
  '/admin/all',
  authMiddleware,
  authorize('admin'),
  consultationController.getAllConsultations
);

/**
 * Xử lý hoàn tiền (Admin) - OLD
 * PUT /api/consultations/:id/refund
 * Auth: Required
 * Role: admin
 */
router.put(
  '/:id/refund',
  authMiddleware,
  authorize('admin'),
  consultationController.processRefund
);

/**
 * Thống kê tổng quan hệ thống (Admin) - OLD
 * GET /api/consultations/admin/stats
 * Auth: Required
 * Role: admin
 */
router.get(
  '/admin/stats',
  authMiddleware,
  authorize('admin'),
  consultationController.getSystemStats
);

/**
 * Cập nhật bảng giá tư vấn (Admin) - OLD
 * PUT /api/consultations/pricing/:doctor_id
 * Auth: Required
 * Role: admin
 */
router.put(
  '/pricing/:doctor_id',
  authMiddleware,
  authorize('admin'),
  consultationController.updateDoctorPricing
);

// ==================== STAFF ROUTES ====================

/**
 * Hỗ trợ đặt lịch cho bệnh nhân (Staff)
 * POST /api/consultations/staff/book-for-patient
 * Auth: Required
 * Role: staff
 */
router.post(
  '/staff/book-for-patient',
  authMiddleware,
  authorize('staff'),
  consultationController.bookConsultationForPatient
);

/**
 * MỚI: Staff lấy danh sách tư vấn của bác sĩ được phân công
 * GET /api/consultations/staff/managed
 */
router.get(
  '/staff/managed',
  authMiddleware,
  authorize('staff'),
  consultationController.getStaffManagedConsultations
);

/**
 * Xác nhận thanh toán tiền mặt (Staff)
 * PUT /api/consultations/:id/confirm-cash-payment
 * Auth: Required
 * Role: staff
 */
router.put(
  '/:id/confirm-cash-payment',
  authMiddleware,
  authorize('staff'),
  consultationController.confirmCashPayment
);

// ==================== SEARCH & FILTER ====================

/**
 * Tìm kiếm và lọc tư vấn
 * GET /api/consultations/search
 * Auth: Required
 * Role: admin, staff
 */
router.get(
  '/search',
  authMiddleware,
  authorize('admin', 'staff'),
  consultationController.searchConsultations
);



module.exports = router;