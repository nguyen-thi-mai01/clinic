// server/routes/permissionRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const { models } = require('../config/db');
const { Op } = require('sequelize');
const PERMISSION_MODULES = require('../config/permissionModules');
const { buildPermissionAuditDetails, getPermissionChanges } = require('../utils/permissionAudit');

/**
 * GET /api/permissions/me
 * Lấy permissions của user hiện tại
 * @access Authenticated
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Nếu là admin → toàn quyền
    if (userRole === 'admin') {
      return res.json({
        success: true,
        data: {
          permissions: 'admin',
          role: 'admin'
        }
      });
    }

    // Nếu là staff/doctor → lấy permissions từ database
    let userModel;
    if (userRole === 'staff') {
      userModel = models.Staff;
    } else if (userRole === 'doctor') {
      userModel = models.Doctor;
    } else {
      return res.json({ success: true, data: { permissions: {} } });
    }

    const staffOrDoctor = await userModel.findOne({ where: { user_id: userId } });
    if (!staffOrDoctor) {
      return res.json({ success: true, data: { permissions: {} } });
    }

    // For doctors, permissions may come from an associated Staff record
    // (either a Staff row with the same user_id, or the Staff referenced
    // by doctor.assigned_staff_id). Prefer explicit Staff.permissions when present.
    let permissionsResult = staffOrDoctor.permissions || {};
    if (userRole === 'doctor') {
      try {
        // 1) check if a Staff record exists for this user
        const staffByUser = await models.Staff.findOne({ where: { user_id: userId } });
        if (staffByUser && staffByUser.permissions && Object.keys(staffByUser.permissions || {}).length) {
          permissionsResult = staffByUser.permissions;
        } else if (staffOrDoctor.assigned_staff_id) {
          // 2) fallback: check assigned_staff_id on Doctor
          const assignedStaff = await models.Staff.findByPk(staffOrDoctor.assigned_staff_id);
          if (assignedStaff && assignedStaff.permissions && Object.keys(assignedStaff.permissions || {}).length) {
            permissionsResult = assignedStaff.permissions;
          }
        }
      } catch (innerErr) {
        console.warn('Warning while resolving doctor permissions via Staff:', innerErr);
      }
    }

    res.json({
      success: true,
      data: {
        userId,
        role: userRole,
        permissions: permissionsResult || {}
      }
    });
  } catch (error) {
    console.error('ERROR in GET /api/permissions/me:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * GET /api/permissions/staff/:staffId
 * Lấy permissions chi tiết của 1 staff
 * @access Admin hoặc manager cùng phòng ban
 */
router.get('/staff/:staffId', authenticateToken, async (req, res) => {
  try {
    const { staffId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Lấy thông tin staff
    const staff = await models.Staff.findByPk(staffId, {
      include: [{
        model: models.User,
        as: 'user',
        attributes: ['id', 'full_name', 'email']
      }]
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại' });
    }

    // Permission check: Chỉ admin hoặc manager cùng phòng ban mới xem được
    if (userRole === 'staff') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem' });
    }

    // Lấy permissions (nếu là object, convert thành array format)
    const permissions = staff.permissions || {};

    res.json({
      success: true,
      data: {
        staffId: staff.id,
        staffName: staff.user?.full_name,
        staffEmail: staff.user?.email,
        department: staff.department,
        permissions
      }
    });
  } catch (error) {
    console.error('ERROR in GET /api/permissions/staff/:staffId:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * PUT /api/permissions/staff/:staffId
 * Cập nhật permissions cho 1 staff
 * Body: {
 *   permissions: {
 *     "articles": { "view": true, "edit": true, "delete": false },
 *     "appointments": { "view": true }
 *   }
 * }
 * @access Chỉ admin
 */
router.put('/staff/:staffId', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { staffId } = req.params;
    const { permissions } = req.body;
    const adminId = req.user.id;

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'Dữ liệu permissions không hợp lệ' 
      });
    }

    // Lấy staff
    const staff = await models.Staff.findByPk(staffId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại' });
    }

    // Lưu permissions cũ để log
    const oldPermissions = staff.permissions || {};

    const changedPermissions = getPermissionChanges(oldPermissions, permissions);

    // Cập nhật permissions
    staff.permissions = permissions;
    await staff.save();

    // Tạo Audit Log
    try {
      const detailsPayload = buildPermissionAuditDetails(oldPermissions, permissions, { changed_at: new Date() });
      console.log('[AUDIT DEBUG] Creating AuditLog (permissionRoutes) payload:', JSON.stringify(detailsPayload, null, 2));
      await models.AuditLog.create({
        user_id: adminId,
        action_type: 'permission_change',
        target_type: 'staff',
        target_id: staff.id,
        target_name: staff.user?.full_name || `Staff ${staff.id}`,
        details: detailsPayload,
        ip_address: req.ip
      });
    } catch (auditError) {
      console.error('ERROR creating audit log:', auditError);
      // Không throw error, vẫn trả về thành công cho client
    }

    // Gọi refreshPermissions trên user để cập nhật permissions ngay lập tức
    const user = await models.User.findByPk(staff.user_id, {
      include: [{ model: models.Staff, as: 'staff' }]
    });

    res.json({
      success: true,
      message: 'Cập nhật quyền thành công',
      data: {
        staffId: staff.id,
        permissions: staff.permissions,
        updatedAt: staff.updated_at
      }
    });
  } catch (error) {
    console.error('ERROR in PUT /api/permissions/staff/:staffId:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * GET /api/permissions/modules
 * Lấy danh sách tất cả modules và permissions chi tiết
 * @access Public (hoặc authenticated)
 */
router.get('/modules', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: PERMISSION_MODULES
    });
  } catch (error) {
    console.error('ERROR in GET /api/permissions/modules:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

/**
 * GET /api/permissions/audit-logs?staffId=X&limit=50&offset=0
 * Lấy lịch sử thay đổi permissions
 * @access Admin hoặc manager cùng phòng ban
 */
router.get('/audit-logs', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { staffId, limit = 50, offset = 0 } = req.query;

    let where = { action_type: 'permission_change' };
    if (staffId) {
      where.target_id = staffId;
    }

    const logs = await models.AuditLog.findAll({
      where,
      include: [{
        model: models.User,
        as: 'user',
        attributes: ['id', 'full_name', 'email']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    const total = await models.AuditLog.count({ where });

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('ERROR in GET /api/permissions/audit-logs:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});

module.exports = router;
