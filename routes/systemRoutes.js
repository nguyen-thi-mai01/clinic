// server/routes/systemRoutes.js
const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Routes cho System Settings

// Test endpoint để kiểm tra DB (không cần auth)
router.get('/test/db', systemController.testDB);

// ========== AUDIT LOGS ROUTES ==========
// GET audit logs - Admin hoặc IT staff có quyền system_settings:view_audit_logs
router.get('/audit-logs', authenticateToken, roleMiddleware('SYSTEM_VIEW_AUDIT_LOGS', ['admin']), systemController.getAuditLogs);

// GET audit stats - Admin hoặc IT staff
router.get('/audit-logs/stats', authenticateToken, roleMiddleware('SYSTEM_VIEW_AUDIT_LOGS', ['admin']), systemController.getAuditStats);

// GET không yêu cầu auth (cho public view trang tĩnh như home, about)
router.get('/:page', systemController.getSettings);

// PUT yêu cầu admin HOẶC staff (IT)
// SỬA LỖI: Mở quyền cho staff IT lưu cấu hình hệ thống
router.put('/:page', authenticateToken, roleMiddleware(null, ['admin', 'staff']), systemController.updateSettings);

console.log('SUCCESS: System routes đã được mount với prefix /api/settings');
console.log('  - GET  /api/settings/test/db (test DB connection)');
console.log('  - GET  /api/settings/audit-logs (admin only)');
console.log('  - GET  /api/settings/audit-logs/stats (admin only)');
console.log('  - GET  /api/settings/:page');
console.log('  - PUT  /api/settings/:page (requires admin)');

module.exports = router;