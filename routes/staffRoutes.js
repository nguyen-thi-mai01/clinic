// server/routes/staffRoutes.js
const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// ==========================================
// DEPARTMENT & PERMISSIONS ROUTES (MỚI)
// ==========================================

// Lấy danh sách phòng ban
router.get('/departments', 
  authenticateToken, 
  authorize('admin', 'staff'), 
  staffController.getDepartments
);

// Lấy thống kê theo phòng ban (admin & staff có quyền)
router.get('/statistics/by-department',
  authenticateToken,
  authorize('admin', 'staff'),
  staffController.getDepartmentStatistics
);

// Lấy permissions template theo phòng ban
router.get('/permissions-template/:departmentCode',
  authenticateToken,
  authorize('admin', 'staff'),
  staffController.getPermissionsTemplate
);

// Lấy role profiles theo phòng ban
router.get('/role-profiles/:departmentCode',
  authenticateToken,
  authorize('admin', 'staff'),
  staffController.getRoleProfiles
);

// Lấy danh sách nhân viên theo phòng ban
router.get('/by-department/:departmentCode',
  authenticateToken,
  authorize('admin', 'staff'),
  staffController.getStaffByDepartment
);

// MỚI: Phân chia nhân viên vào phòng ban (Admin only)
router.post('/assign-department',
  authenticateToken,
  authorize('admin'),
  staffController.assignUserToDepartment
);

// MỚI: Cập nhật hàng loạt (bulk update) nhiều nhân viên cùng lúc
router.post('/bulk-update',
  authenticateToken,
  authorize('admin'),
  staffController.bulkUpdateStaff
);

// ==========================================
// EXISTING ROUTES
// ==========================================

// 1. Lấy danh sách nhỏ (cho dropdown/modal) - PHẢI ĐẶT ĐẦU TIÊN
router.get('/list', 
  authenticateToken, 
  authorize('admin'), 
  staffController.getStaffList 
);

// MỚI: Lấy TẤT CẢ staff (cho overview dashboard)
router.get('/all',
  authenticateToken,
  authorize('admin'),
  staffController.getAllStaffForOverview
);

// MỚI: Lấy profile của staff đang đăng nhập
router.get('/my-profile',
  authenticateToken,
  authorize('staff'),
  staffController.getMyProfile
);

// ==========================================
// AUDIT LOGS ROUTES (Staff Management History)
// PHẢI ĐẶT TRƯỚC /:id ĐỂ TRÁNH CONFLICT
// ==========================================

// Lấy audit logs của staff management (permissions, department changes, etc.)
router.get('/audit-logs',
  authenticateToken,
  authorize('admin'),
  staffController.getStaffAuditLogs
);

// Lấy thống kê audit logs
router.get('/audit-logs/stats',
  authenticateToken,
  authorize('admin'),
  staffController.getStaffAuditStats
);

// 2. Lấy danh sách đầy đủ (trang quản lý)
router.get('/',
  authenticateToken,
  authorize('admin', 'staff'),
  staffController.getAllStaff
);

// 3. Lấy chi tiết nhân viên
router.get('/:id', 
  authenticateToken, 
  authorize('admin', 'staff'),
  staffController.getStaffById
);

// 4. Cập nhật thông tin nhân viên (department, rank, job_description)
//    Admin or Department Manager may update (manager limited to their department)
router.put('/:id',
  authenticateToken,
  authorize('admin', 'staff'),
  staffController.updateStaff
);

// 5. Cập nhật permissions cho nhân viên
router.put('/:id/permissions',
  authenticateToken,
  authorize('admin', 'staff'),
  staffController.updateStaffPermissions
);

// 6. Phân công / Cập nhật role
router.put('/:id/assign', // Dùng assign cho tổng quát (đổi dept/rank)
  authenticateToken,
  authorize('admin', 'staff'),
  staffController.assignDoctorsToStaff
);

// (Giữ lại route cũ cho tương thích ngược nếu cần)
router.put('/:id/assign-doctors',
  authenticateToken,
  authorize('admin', 'staff'),
  staffController.assignDoctorsToStaff
);

// 7. Lấy bác sĩ phụ trách
router.get('/:id/doctors',
  authenticateToken,
  authorize('admin', 'staff'),
  staffController.getAssignedDoctors
);

module.exports = router;