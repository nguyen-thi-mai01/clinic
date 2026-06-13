// server/routes/appointmentRoutes.js

const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const appointmentOptimizer = require('../controllers/appointmentOptimizationController');
const { authenticateToken, authenticateTokenOptional, authorize } = require('../middleware/authMiddleware');

// ========== PUBLIC ROUTES ==========

/**
 * Lấy lịch trống của bác sĩ
 * Query params: doctor_id, date, service_id
 */
// ========== PUBLIC ROUTES ==========
router.get('/available-slots', appointmentController.getAvailableSlots);
router.post('/recover-codes', appointmentController.recoverAppointmentCodes);

// Public ratings — không cần auth, chỉ trả approved
router.get('/public-ratings', appointmentController.getPublicRatings);

/**
 * Lấy lịch hẹn theo guest token
 * GET /api/appointments/guest/:token
 */
router.get('/guest/:token', appointmentController.getAppointmentByToken);

// ========== PATIENT/GUEST ROUTES ==========
/**
 * Tạo lịch hẹn mới
 * POST /api/appointments
 * SỬA: Thêm authenticateToken (để lấy req.user nếu có)
 */
router.post('/', authenticateToken, appointmentController.createAppointment);

// Walk-in: Tạo lịch hẹn tại quầy (không cần online booking)
router.post('/walk-in',
  authenticateToken,
  authorize('admin', 'staff'),
  appointmentController.createWalkInAppointment
);

/**
 * Hoàn thành thanh toán
 * PUT /api/appointments/:id/complete-payment
 * SỬA: Thêm authenticateToken (để lấy req.user nếu có)
 */
router.put('/:id/complete-payment', authenticateToken, appointmentController.completePayment);

// ========== PATIENT ROUTES ==========
/**
 * Lấy danh sách lịch hẹn của bệnh nhân đăng nhập
 * GET /api/appointments/my-appointments
 */
router.get('/my-appointments',
  authenticateToken,
  authorize('patient'), // ✅ CHỈ CẦN GHI NHƯ THẾ NÀY
  appointmentController.getMyAppointments
);

// SỬA: THÊM ROUTE CHO BÁC SĨ
/**
 * Lấy danh sách lịch hẹn của bác sĩ đăng nhập
 * GET /api/appointments/doctor/my-appointments
 */
router.get('/doctor/my-appointments',
  authenticateToken,
  authorize('doctor'),
  appointmentController.getDoctorAppointments
);

/**
 * SỬA: THÊM ROUTE ĐỔI LỊCH (RESCHEDULE)
 * PUT /api/appointments/:id/reschedule
 * Body: { new_date, new_start_time, new_doctor_id, new_service_id }
 */
router.put('/:id/reschedule',
  authenticateToken,
  authorize('patient', 'admin', 'staff'), // Cho phép cả admin/staff đổi lịch
  appointmentController.rescheduleAppointment
);


// ========== ADMIN/STAFF ROUTES ==========
/**
 * Lấy tất cả lịch hẹn (Admin/Staff)
 * GET /api/appointments/admin/all
 */
router.get('/admin/all',
  authenticateToken,
  authorize('admin', 'staff'),
  appointmentController.getAllAppointments
);

/**
 * MỚI: Lấy lịch hẹn của bác sĩ được Staff quản lý
 * GET /api/appointments/staff/managed
 */
router.get('/staff/managed',
  authenticateToken,
  authorize('staff'),
  appointmentController.getStaffManagedAppointments
);

/**
 * Staff lâm sàng: Lấy lịch hẹn theo ngày để nhập hồ sơ y tế
 * GET /api/appointments/staff/clinical-queue
 * Query: date (default: hôm nay), doctor_id, status, search
 */
router.get('/staff/clinical-queue',
  authenticateToken,
  authorize('admin', 'staff'),
  appointmentController.getClinicalQueue
);

router.get('/call-logs',
  authenticateToken,
  authorize('admin', 'staff'),
  appointmentController.getCallLogs
);

/**
 * Thống kê tổng quan lịch hẹn cho dashboard admin/staff
 * GET /api/appointments/admin/statistics/overview?year=2026
 */
router.get('/admin/statistics/overview',
  authenticateToken,
  authorize('admin', 'staff'),
  appointmentController.getAppointmentStatistics
);

/**
 * Xác nhận lịch hẹn
 * PUT /api/appointments/:id/confirm
 */
router.put('/:id/confirm',
  authenticateToken,
  authorize('admin', 'staff', 'doctor'), // ✅ THÊM 'doctor'
  appointmentController.confirmAppointment
);

/**
 * CẬP NHẬT TRẠNG THÁI WORKFLOW (Admin/Staff/Doctor)
 * PUT /api/appointments/:id/status
 * Body: { status: 'pending'|'confirmed'|'upcoming'|'in_progress'|'completed'|'passed'|'cancelled' }
 */
router.put('/:id/status',
  authenticateToken,
  authorize('admin', 'staff', 'doctor'),
  appointmentController.updateStatus
);

/**
 * CẬP NHẬT THÔNG TIN THANH TOÁN (Admin/Staff): phương thức và thời gian
 * PUT /api/appointments/:id/payment
 */
router.put('/:id/payment',
  authenticateToken,
  authorize('admin', 'staff'),
  appointmentController.updatePaymentInfo
);

/**
 * Hoàn thành lịch hẹn
 * PUT /api/appointments/:id/complete
 */
router.put('/:id/complete',
  authenticateToken,
  authorize('admin', 'staff', 'doctor'),
  appointmentController.completeAppointment
);

router.put('/:id/details',
  authenticateToken,
  authorize('admin', 'staff', 'doctor'),
  appointmentController.updateAppointmentDetails
);

/**
 * Check-in tại quầy (Cấp STT)
 * PUT /api/appointments/:code/check-in
 */
router.put('/:code/check-in',
  authenticateToken,
  authorize('admin', 'staff'),
  appointmentController.checkIn
);

router.put('/:code/call-number',
  authenticateToken,
  authorize('admin', 'staff'),
  appointmentController.callQueueNumber
);

router.post('/:code/call-again',
  authenticateToken,
  authorize('admin', 'staff'),
  appointmentController.callAgain
);

// ========== COMMON ROUTES ==========
/**
 * Lấy chi tiết lịch hẹn
 * GET /api/appointments/:id
 */
router.get('/:id',
  authenticateToken,
  authorize('patient', 'doctor', 'staff', 'admin'),
  appointmentController.getAppointmentById
);

/**
 * Hủy lịch hẹn
 * PUT /api/appointments/:id/cancel
 */
router.put('/:id/cancel',
  authenticateToken,
  authorize('patient', 'admin', 'staff', 'doctor'),
  appointmentController.cancelAppointment
);

// ===== [BƯỚC 2: OPTIMIZE] RATING & FEEDBACK - REUSE ConsultationFeedback Table =====
// Thay vì tạo 6 columns mới trong appointments
// → Reuse bảng consultation_feedback (rating, review, status, admin_note)
// → Thêm appointment_id + service_type để phân loại
//
// Routes:
// 1. Patient gửi rating (1-5 sao + review)
// 2. Admin xem danh sách feedbacks (cả consultation + appointment)
// 3. Admin approve/hide feedback

/**
 * BƯỚC 2: Bệnh nhân gửi rating/review lịch hẹn (1-5 sao + text)
 * PUT /api/appointments/:id/submit-rating
 * Auth: Patient only
 * Body: { rating (1-5), review (text) }
 * 
 * Logic:
 * - Kiểm tra appointment completed + patient_id match
 * - Tạo record vào ConsultationFeedback (appointment_id != NULL, service_type='appointment')
 * - feedback_status = 'pending' (chờ admin duyệt)
 * 
 * BƯỚC 2: Rating submission for appointment
 */
router.put('/:id/submit-rating',
  authenticateToken,
  authorize('patient'),
  appointmentController.submitAppointmentRating
);

/**
 * BƯỚC 2: Admin/Staff xem danh sách feedbacks (appointment + consultation)
 * GET /api/appointments/admin/feedbacks
 * Auth: Admin/Staff
 * Query: { doctor_id?, rating?, status?, service_type?, page, limit }
 * 
 * Logic:
 * - Query ConsultationFeedback WHERE appointment_id IS NOT NULL
 * - Có thể filter theo service_type nếu muốn cả 2 loại
 * 
 * BƯỚC 2: List appointment feedbacks
 */
router.get('/admin/feedbacks',
  authenticateToken,
  authorize('admin', 'staff', 'doctor'),
  appointmentController.listAppointmentFeedbacks
);

/**
 * BƯỚC 2: Admin/Staff duyệt/ẩn feedback
 * PUT /api/appointments/admin/feedbacks/:feedback_id/toggle-status
 * Auth: Admin/Staff
 * Body: { status ('approved'|'hidden'), admin_note? }
 * 
 * Logic:
 * - Update ConsultationFeedback record (appointment)
 * - Set: status, admin_note, reviewed_by = req.user.id
 * 
 * BƯỚC 2: Toggle feedback status
 */
router.put('/admin/feedbacks/:feedback_id/toggle-status',
  authenticateToken,
  authorize('admin', 'staff'),
  appointmentController.toggleAppointmentFeedbackStatus  
);

// Patient can edit/delete their own feedback
router.put('/feedbacks/:feedback_id',
  authenticateToken,
  authorize('patient'),
  appointmentController.updatePatientFeedback
);

router.delete('/feedbacks/:feedback_id',
  authenticateToken,
  authorize('patient'),
  appointmentController.deletePatientFeedback
);

// Reply to feedback (admin/staff/doctor)
router.put('/admin/feedbacks/:feedback_id/reply',
  authenticateToken,
  authorize('admin', 'staff', 'doctor'),
  appointmentController.replyAppointmentFeedback
);

// ===== KẾT THÚC RATING & FEEDBACK - OPTIMIZED =====

/**
 * Review lịch hẹn
 * POST /api/appointments/:id/review
 */
router.post('/:id/review',
  authenticateToken,
  authorize('patient'),
  appointmentController.reviewAppointment
);

router.get('/by-user', 
  authenticateToken,
  authorize('doctor', 'admin', 'staff'),  
  appointmentController.getAppointmentsForCalendar
);

// ===== [MỚI] APPOINTMENT OPTIMIZATION: SERVICE INDICATIONS & EDGE CASES =====

/**
 * Check-in lịch hẹn tại phòng khám (cấp STT động)
 * PUT /api/appointments/:id/check-in
 * Body: {}
 */
router.put('/:id/check-in',
  authenticateToken,
  authorize('admin', 'staff'),
  appointmentOptimizer.checkInAppointment
);

/**
 * Bác sĩ chỉ định dịch vụ phụ (Siêu âm, Lấy máu...)
 * POST /api/appointments/:id/service-indications
 * Body: { indications: [{ service_name, service_code, order_sequence, dependencies }] }
 */
router.post('/:id/service-indications',
  authenticateToken,
  authorize('doctor', 'staff'),
  appointmentOptimizer.addServiceIndications
);

/**
 * Bệnh nhân quẹt mã tại phòng dịch vụ (check-in động)
 * PUT /api/appointments/:id/service-indications/:indication_id
 * Body: {}
 */
router.put('/:id/service-indications/:indication_id/check-in',
  authenticateToken,
  appointmentOptimizer.checkInServiceRoom
);

/**
 * Hoàn thành dịch vụ cận lâm sàng
 * PATCH /api/appointments/:id/service-indications/:indication_id/complete
 * Body: { result: '...' }
 */
router.patch('/:id/service-indications/:indication_id/complete',
  authenticateToken,
  authorize('doctor', 'staff'),
  appointmentOptimizer.completeServiceIndication
);

/**
 * Bác sĩ đánh dấu vắng mặt (no-show) cho lịch Online
 * PATCH /api/appointments/:id/no-show
 * Body: { reason: '...' }
 */
router.patch('/:id/no-show',
  authenticateToken,
  authorize('doctor', 'staff', 'admin'),
  appointmentOptimizer.handleNoShow
);

/**
 * Lấy danh sách xếp hàng của bác sĩ (gọi số tiếp theo)
 * GET /api/appointments/doctor/:doctor_id/queue
 */
router.get('/doctor/:doctor_id/queue',
  authenticateToken,
  authorize('doctor', 'staff', 'admin'),
  appointmentOptimizer.getQueueForDoctor
);

/**
 * Ưu tiên khám của bệnh nhân chờ quá lâu
 * PUT /api/appointments/:id/prioritize-now
 * Body: {}
 */
router.put('/:id/prioritize-now',
  authenticateToken,
  authorize('staff'),
  appointmentOptimizer.prioritizeNow
);

/**
 * PUT /api/appointments/:code/change-payment-method
 * Đổi phương thức thanh toán (chỉ nếu pending + unpaid)
 * Body: { payment_method: 'cash' | 'vnpay' | 'momo' | 'bank_transfer' }
 */
router.put('/:code/change-payment-method',
  authenticateTokenOptional,
  appointmentController.changePaymentMethod
);

/**
 * GET /api/appointments/service/:serviceId/slots-stats-today
 * Lấy thống kê slot hôm nay theo từng ca cho 1 dịch vụ
 */
router.get('/service/:serviceId/slots-stats-today',
  authenticateToken,
  authorize('admin', 'manager', 'staff'),
  appointmentController.getSlotsStatsToday
);

/**
 * POST /api/appointments/:parent_code/sub-service
 * Tạo lịch hẹn phụ (sub-service appointment)
 * Doctor chỉ định dịch vụ phụ cho bệnh nhân
 * Body: { service_id, service_name, mode, appointment_date, appointment_start_time }
 * mode: 'immediate' (làm ngay) | 'schedule' (đặt lịch)
 */
router.post('/:parent_code/sub-service',
  authenticateToken,
  authorize('doctor', 'staff', 'admin'),
  appointmentController.createSubServiceAppointment
);

module.exports = router;