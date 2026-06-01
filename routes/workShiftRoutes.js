// server/routes/workShiftRoutes.js
const express = require('express');
const router = express.Router();
const workShiftController = require('../controllers/workShiftController');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// ========== PUBLIC ROUTES ==========
/**
 * Lấy cấu hình ca làm việc
 * GET /api/work-shifts/config
 * Response: Danh sách ca làm việc đang active
 */
router.get('/config', workShiftController.getWorkShiftConfig);

/**
 * Lấy slots trống của bác sĩ
 * GET /api/work-shifts/available-slots?doctor_id=1&date=2025-01-15&service_id=3
 * Response: { slots: [...], grouped: { morning: [...], afternoon: [...], evening: [...] } }
 */
router.get('/available-slots', workShiftController.getAvailableSlots);

// ========== ADMIN ROUTES ==========
/**
 * Cập nhật cấu hình ca làm việc
 * PUT /api/work-shifts/config
 * Body: { shifts: [{ shift_name, start_time, end_time, days_of_week, is_active }] }
 */
router.put('/config',
  authenticateToken,
  roleMiddleware('system_settings:edit_home'),
  workShiftController.updateWorkShiftConfig
);

// ================================================================
// CA THU NGÂN — CASHIER SHIFT ROUTES
// ================================================================
const { authorize } = require('../middleware/authMiddleware');

// Nhân viên: xem ca hiện tại của mình
router.get('/cashier/current',
  authenticateToken,
  authorize('staff', 'admin'),
  workShiftController.getCurrentCashierShift
);

// Nhân viên: mở ca
router.post('/cashier/start',
  authenticateToken,
  authorize('staff', 'admin'),
  workShiftController.startCashierShift
);

// Nhân viên: đóng ca
router.post('/cashier/end',
  authenticateToken,
  authorize('staff', 'admin'),
  workShiftController.endCashierShift
);

// Nhân viên: xem lịch sử ca của mình
router.get('/cashier/history',
  authenticateToken,
  authorize('staff', 'admin'),
  workShiftController.getMyCashierShiftHistory
);

// Admin: xem tất cả ca
router.get('/cashier/all',
  authenticateToken,
  authorize('admin'),
  workShiftController.getAllCashierShifts
);

// Admin: xét duyệt ca chênh lệch
router.put('/cashier/:id/review',
  authenticateToken,
  authorize('admin'),
  workShiftController.reviewCashierShift
);



module.exports = router;