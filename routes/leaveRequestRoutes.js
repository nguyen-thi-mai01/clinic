// server/routes/leaveRequestRoutes.js
// SỬA: Bổ sung route GET /history/:userId

const express = require('express');
const router = express.Router();
const leaveRequestController = require('../controllers/leaveRequestController');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// ========== DOCTOR/STAFF ROUTES ==========
// ========== DOCTOR/STAFF ROUTES ==========
/**
 * Tạo đơn xin nghỉ
 * POST /api/leave-requests
 */
router.post('/',
  authenticateToken,
  // [SỬA] Đổi permission thành null để cho phép tất cả staff/doctor
  roleMiddleware(null, ['doctor', 'staff']),
  leaveRequestController.createLeaveRequest
);

/**
 * Lấy danh sách đơn xin nghỉ của tôi
 * GET /api/leave-requests/my-leaves
 */
router.get('/my-leaves',
  authenticateToken,
  // [SỬA] Đổi permission thành null để cho phép tất cả staff/doctor
  roleMiddleware(null, ['doctor', 'staff']),
  leaveRequestController.getMyLeaveRequests
);

/**
 * Hủy đơn xin nghỉ (chỉ pending)
 * DELETE /api/leave-requests/:id
 */
router.delete('/:id',
  authenticateToken,
  // [SỬA] Đổi permission thành null để cho phép tất cả staff/doctor
  roleMiddleware(null, ['doctor', 'staff']),
  leaveRequestController.cancelLeaveRequest
);

// ========== ADMIN/STAFF ROUTES ==========
/**
 * Lấy danh sách đơn xin nghỉ (cho Admin/Staff)
 * GET /api/leave-requests/pending
 */
router.get('/pending',
  authenticateToken,
  roleMiddleware('work_shift:approve_leave'),
  leaveRequestController.getPendingLeaveRequests
);

/**
 * SỬA: BỔ SUNG ROUTE NÀY (Để fix lỗi 404 kẹt loading)
 * Lấy lịch sử nghỉ của 1 user (Admin/Staff xem)
 * GET /api/leave-requests/history/:userId
 */
router.get('/history/:userId',
  authenticateToken,
  roleMiddleware('work_shift:approve_leave'),
  leaveRequestController.getUserLeaveHistory
);

/**
 * Duyệt đơn xin nghỉ
 * PUT /api/leave-requests/:id/approve
 */
router.put('/:id/approve',
  authenticateToken,
  roleMiddleware('work_shift:approve_leave'),
  leaveRequestController.approveLeaveRequest
);

/**
 * Từ chối đơn xin nghỉ
 * PUT /api/leave-requests/:id/reject
 */
router.put('/:id/reject',
  authenticateToken,
  roleMiddleware('work_shift:approve_leave'),
  leaveRequestController.rejectLeaveRequest
);

module.exports = router;