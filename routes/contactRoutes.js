// server/routes/contactRoutes.js
const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// PUBLIC - Gửi tin nhắn (không cần đăng nhập)
router.post('/send', contactController.sendMessage);

// PUBLIC - Webhook nhận email khách hàng reply (Từ SendGrid/Mailgun)
router.post('/webhook/receive', contactController.receiveWebhook);

// PROTECTED - Quản lý tin nhắn (admin + staff support/system)
router.get(
  '/messages',
  authenticateToken,
  roleMiddleware('contact:view', ['admin', 'staff']),
  contactController.getMessages
);

router.get(
  '/messages/:id',
  authenticateToken,
  roleMiddleware('contact:view', ['admin', 'staff']),
  contactController.getMessageById
);

// MỚI: TICKETING WORKFLOW (Nhận - Trả lời - Đóng)
router.post(
  '/messages/:id/claim',
  authenticateToken,
  roleMiddleware('contact:reply', ['admin', 'staff']),
  contactController.claimTicket
);

router.post(
  '/messages/:id/reply',
  authenticateToken,
  roleMiddleware('contact:reply', ['admin', 'staff']),
  contactController.replyMessage
);

router.put(
  '/messages/:id/close',
  authenticateToken,
  roleMiddleware('contact:reply', ['admin', 'staff']),
  contactController.closeTicket
);

// GIỮ NGUYÊN: Các hàm cập nhật/xóa cũ
router.put(
  '/messages/:id/status',
  authenticateToken,
  roleMiddleware('contact:mark_read', ['admin', 'staff']),
  contactController.updateStatus
);

router.delete(
  '/messages/:id',
  authenticateToken,
  roleMiddleware('contact:delete', ['admin']),
  contactController.deleteMessage
);

router.delete(
  '/messages/bulk',
  authenticateToken,
  roleMiddleware('contact:delete', ['admin']),
  contactController.bulkDelete
);

module.exports = router;