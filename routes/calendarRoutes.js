// server/routes/calendarRoutes.js

const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

/**
 * @desc    API Hợp Nhất: Lấy tất cả dữ liệu (Lịch làm, Lịch nghỉ, Lịch hẹn)
 * @route   GET /api/calendar/view
 * @access  Private (Admin, Staff, Doctor)
 * @params
 * - user_ids (string, CSDL): "1,2,5" (Tối đa 5) (Nếu rỗng: Admin xem tất cả, User xem của mình)
 * - date_from (string): "YYYY-MM-DD"
 * - date_to (string): "YYYY-MM-DD"
 * - types (string, CSDL): "schedules,leaves,appointments" (Nếu rỗng, lấy tất cả)
 */
router.get(
  '/view',
  authenticateToken,
  authorize('admin', 'staff', 'doctor'), // Chỉ user có đăng nhập mới được xem
  calendarController.getCalendarData
);

module.exports = router;