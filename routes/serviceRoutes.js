// server/routes/serviceRoutes.js
const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// =================================================================
// ⚠️ CRITICAL: ROUTE ORDER MATTERS!
// Specific routes MUST come before generic patterns
// =================================================================

// =================================================================
// ======================== ADMIN ROUTES ===========================
// =================================================================

/**
 * @route   GET /api/services/admin/all
 * @desc    Lấy tất cả dịch vụ cho admin
 * @access  Private (Admin or Staff with any SERVICE permission)
 */
router.get(
  '/admin/all',
  authenticateToken,
  async (req, res, next) => {
    // Admin có toàn quyền
    if (req.user.role === 'admin') return next();
    
    // Staff phải có ít nhất 1 quyền về services
    if (req.user.role === 'staff') {
      const { models } = require('../config/db');
      const staffProfile = await models.Staff.findOne({ where: { user_id: req.user.id } });
      
      if (!staffProfile) {
        return res.status(403).json({ success: false, message: 'Không tìm thấy hồ sơ nhân viên.' });
      }
      
      const { permissions } = staffProfile;
      
      // [ĐÃ SỬA] Bỏ check department === 'system', chỉ check có quyền services hay không
      const hasServicePermission = permissions && permissions.services && (
        (Array.isArray(permissions.services) && permissions.services.length > 0) || 
        permissions.services === true
      );

      if (hasServicePermission) {
        return next();
      }
      
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền xem dịch vụ. Cần ít nhất 1 quyền về module Services.',
        yourPermissions: permissions?.services
      });
    }
    
    return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });
  },
  serviceController.getServicesForAdmin
);

/**
 * @route   POST /api/services
 * @desc    Tạo dịch vụ mới
 * @access  Private (Admin or Staff with services:create permission)
 */
router.post(
  '/',
  authenticateToken,
  (req, res, next) => {
    if (req.user.role === 'admin') return next();
    // [ĐÃ SỬA] Đổi SERVICE_CREATE -> services:create
    return roleMiddleware('services:create')(req, res, next);
  },
  serviceController.createService
);

/**
 * @route   PUT /api/services/:id
 * @desc    Cập nhật dịch vụ
 * @access  Private (Admin or Staff with services:edit permission)
 */
router.put(
  '/:id',
  authenticateToken,
  (req, res, next) => {
    if (req.user.role === 'admin') return next();
    // [ĐÃ SỬA] Đổi SERVICE_EDIT -> services:edit
    return roleMiddleware('services:edit')(req, res, next);
  },
  serviceController.updateService
);

/**
 * @route   DELETE /api/services/:id
 * @desc    Xóa dịch vụ
 * @access  Private (Admin or Staff with services:delete permission)
 */
router.delete(
  '/:id',
  authenticateToken,
  (req, res, next) => {
    if (req.user.role === 'admin') return next();
    // [ĐÃ SỬA] Đổi SERVICE_DELETE -> services:delete
    return roleMiddleware('services:delete')(req, res, next);
  },
  serviceController.deleteService
);

/**
 * @route   GET /api/services/:id/pause-stats
 * @desc    Lấy thống kê lịch hẹn để chuẩn bị tạm dừng dịch vụ
 */
router.get(
  '/:id/pause-stats',
  authenticateToken,
  (req, res, next) => {
    if (req.user.role === 'admin') return next();
    return roleMiddleware('services:edit')(req, res, next);
  },
  serviceController.getServicePauseStats
);

/**
 * @route   POST /api/services/:id/pause
 * @desc    Thực hiện tạm dừng dịch vụ (Đóng cứng / Đóng mềm)
 */
router.post(
  '/:id/pause',
  authenticateToken,
  (req, res, next) => {
    if (req.user.role === 'admin') return next();
    return roleMiddleware('services:edit')(req, res, next);
  },
  serviceController.pauseService
);

// =================================================================
// ======================= PUBLIC ROUTES ===========================
// =================================================================

/**
 * @route   GET /api/services/:id/doctors
 * @desc    Lấy danh sách bác sĩ của dịch vụ
 * @access  Public
 */
router.get('/:id/doctors', serviceController.getServiceDoctors);

/**
 * @route   GET /api/services/:id
 * @desc    Lấy chi tiết dịch vụ công khai (bao gồm doctors)
 * @access  Public
 */
router.get('/:id', serviceController.getServiceByIdPublic);

/**
 * @route   GET /api/services
 * @desc    Lấy danh sách dịch vụ công khai
 * @access  Public
 */
router.get('/', serviceController.getPublicServices);

module.exports = router;