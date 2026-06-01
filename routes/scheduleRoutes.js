// server/routes/scheduleRoutes.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// ========== PUBLIC ROUTES ==========
router.get('/public', scheduleController.getPublicSchedules);

// ========== ADMIN/STAFF/DOCTOR ROUTES (Protected) ==========
router.get('/', 
  authenticateToken,
  scheduleController.getSchedules
);
router.get('/stats',
  authenticateToken,
  scheduleController.getWorkHoursStats
);

// ========== ADMIN ROUTES (Quản lý lịch cố định) ==========
router.post('/fixed',
  authenticateToken,
  roleMiddleware('system_settings:edit_home'),
  scheduleController.createSingleFixedSchedule
);
router.post('/fixed/batch',
  authenticateToken,
  roleMiddleware('system_settings:edit_home'),
  scheduleController.createFixedSchedule
);
router.get('/check-conflict',
  authenticateToken,
  roleMiddleware('system_settings:edit_home'),
  scheduleController.checkScheduleConflict
);
router.put('/:id',
  authenticateToken,
  roleMiddleware('system_settings:edit_home'),
  scheduleController.updateSchedule
);
router.get('/export',
  authenticateToken,
  roleMiddleware('system_settings:view_audit_logs'),
  scheduleController.exportSchedules
);

// ========== CHUNG (Admin, Doctor, Staff) ==========
router.delete('/:id',
  authenticateToken,
  scheduleController.deleteSchedule
);

// ============================================
// === (MỚI) ROUTES: LỊCH LINH HOẠT ===
// ============================================

/**
 * (User) Đăng ký hoặc cập nhật lịch linh hoạt
 * POST /api/schedules/register-flexible
 * Body: { schedule_type: 'fixed' | 'flexible', weekly_schedule_json: {...} }
 */
// server/routes/scheduleRoutes.js
router.post('/register-flexible',
  authenticateToken,
  roleMiddleware(null, ['doctor', 'staff']),
  scheduleController.registerOrUpdateFlexibleSchedule
);

// THÊM MỚI: Clinical staff đăng ký lịch hộ bác sĩ được gán
router.post('/register-flexible/for-doctor/:doctorId',
  authenticateToken,
  roleMiddleware('clinical:register_for_doctor'),
  scheduleController.registerOrUpdateFlexibleSchedule  // controller cần đọc req.params.doctorId thay req.user.id
);

/**
 * (User) Lấy bản ghi đăng ký duy nhất của mình (để edit)
 * GET /api/schedules/my-schedule-registration
 */
router.get('/my-schedule-registration',
  authenticateToken,
  roleMiddleware(null, ['doctor', 'staff']),
  scheduleController.getMyScheduleRegistration
);

/**
 * (Admin) Lấy danh sách đăng ký lịch đang chờ duyệt
 * GET /api/schedules/pending-registrations
 */
router.get('/pending-registrations',
  authenticateToken,
  roleMiddleware('work_shift:approve_shift'),
  scheduleController.getPendingRegistrations
);

/**
 * (Admin) Phê duyệt một đăng ký lịch
 * PUT /api/schedules/approve-registration/:id
 */
router.put('/approve-registration/:id',
  authenticateToken,
  roleMiddleware('work_shift:approve_shift'),
  scheduleController.approveScheduleRegistration
);

/**
 * (MỚI) (Admin) Từ chối một đăng ký lịch
 * PUT /api/schedules/reject-registration/:id
 * Body: { reason: "..." }
 */
router.put('/reject-registration/:id',
  authenticateToken,
  roleMiddleware('work_shift:approve_shift'),
  scheduleController.rejectScheduleRegistration
);


// ============================================
// === (MỚI) ROUTES: TĂNG CA (OVERTIME) ===
// ============================================

/**
 * (User/Admin) Đăng ký tăng ca (tạo mới)
 * POST /api/schedules/register-overtime
 * Body: { slots: {"date": ["start-end"]}, reason, user_id_for_admin? }
 */
router.post('/register-overtime',
  authenticateToken,
  roleMiddleware(null, ['doctor', 'staff']),
  scheduleController.registerOvertime
);

/**
 * (Admin) Lấy danh sách tăng ca chờ duyệt
 * GET /api/schedules/pending-overtimes
 */
router.get('/pending-overtimes',
  authenticateToken,
  roleMiddleware('work_shift:approve_overtime'),
  scheduleController.getPendingOvertimes
);

/**
 * (Admin) Phê duyệt / Từ chối tăng ca
 * PUT /api/schedules/review-overtime/:id
 * Body: { action: 'approve' | 'reject', reason? }
 */
router.put('/review-overtime/:id',
  authenticateToken,
  roleMiddleware('work_shift:approve_overtime'),
  scheduleController.reviewOvertime
);


module.exports = router;