// server/routes/chatRoutes.js
// Routes cho chức năng chat real-time

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authMiddleware } = require('../middleware/authMiddleware');
const upload = require('../config/upload');

// ==================== UPLOAD FILE ====================

/**
 * Upload file đính kèm
 * POST /api/chat/upload
 * Auth: Required
 * Roles: patient, doctor
 */
router.post(
  '/upload',
  authMiddleware,
  upload.single('file'),
  chatController.uploadFile
);

// ==================== GỬI & NHẬN TIN NHẮN ====================

/**
 * Gửi tin nhắn
 * POST /api/chat/messages
 * Auth: Required
 * Roles: patient, doctor
 */
router.post(
  '/messages',
  authMiddleware,
  chatController.sendMessage
);

/**
 * Lấy lịch sử chat
 * GET /api/chat/:consultation_id/messages
 * Auth: Required
 * Roles: patient, doctor, admin, staff
 */
router.get(
  '/:consultation_id/messages',
  authMiddleware,
  chatController.getChatHistory
);

/**
 * Lấy tin nhắn chưa đọc
 * GET /api/chat/messages/:consultation_id/unread
 * Auth: Required
 * Roles: patient, doctor
 */
router.get(
  '/messages/:consultation_id/unread',
  authMiddleware,
  chatController.getUnreadMessages
);

/**
 * Đếm tin nhắn chưa đọc
 * GET /api/chat/messages/:consultation_id/unread-count
 * Auth: Required
 * Roles: patient, doctor
 */
router.get(
  '/messages/:consultation_id/unread-count',
  authMiddleware,
  chatController.getUnreadCount
);

// ==================== ĐÁNH DẤU ĐÃ ĐỌC ====================

/**
 * Đánh dấu tin nhắn đã đọc
 * PUT /api/chat/messages/:message_id/read
 * Auth: Required
 * Roles: patient, doctor
 */
router.put(
  '/messages/:message_id/read',
  authMiddleware,
  chatController.markMessageAsRead
);

/**
 * Đánh dấu tất cả tin nhắn đã đọc
 * PUT /api/chat/messages/:consultation_id/read-all
 * Auth: Required
 * Roles: patient, doctor
 */
router.put(
  '/messages/:consultation_id/read-all',
  authMiddleware,
  chatController.markAllMessagesAsRead
);

// ==================== XÓA TIN NHẮN ====================

/**
 * Xóa tin nhắn
 * DELETE /api/chat/messages/:message_id
 * Auth: Required
 * Roles: patient, doctor (chỉ xóa tin nhắn của mình)
 */
router.delete(
  '/messages/:message_id',
  authMiddleware,
  chatController.deleteMessage
);

// ==================== TYPING INDICATOR ====================

/**
 * Gửi trạng thái đang gõ
 * POST /api/chat/typing
 * Auth: Required
 * Roles: patient, doctor
 */
router.post(
  '/typing',
  authMiddleware,
  chatController.sendTypingStatus
);

// ==================== TÌM KIẾM & THỐNG KÊ ====================

/**
 * Tìm kiếm tin nhắn
 * GET /api/chat/messages/:consultation_id/search
 * Auth: Required
 * Roles: patient, doctor, admin, staff
 */
router.get(
  '/messages/:consultation_id/search',
  authMiddleware,
  chatController.searchMessages
);

/**
 * Thống kê tin nhắn
 * GET /api/chat/messages/:consultation_id/stats
 * Auth: Required
 * Roles: patient, doctor, admin, staff
 */
router.get(
  '/messages/:consultation_id/stats',
  authMiddleware,
  chatController.getMessageStats
);

// ==================== OTP VERIFICATION (MỚI) ====================

/**
 * Xác thực OTP vào phòng chat
 * POST /api/chat/:consultation_id/verify-otp
 * Auth: Required
 * Roles: patient
 */
router.post(
  '/:consultation_id/verify-otp',
  authMiddleware,
  chatController.verifyChatOTP
);

// ==================== AI CHATBOT PUBLIC ====================

/**
 * Xử lý tin nhắn public với Gemini AI (Không cần đăng nhập)
 * POST /api/chat/ai-chat
 */
router.post(
  '/ai-chat',
  chatController.handleAIChatbot
);


module.exports = router;