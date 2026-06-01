// server/routes/userRoutes.js - CẬP NHẬT: Thêm OAuth routes
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const passport = require('../config/passportConfig');

// ============================================
//  OAUTH ROUTES - GOOGLE (PUBLIC)
// ============================================
router.get('/auth/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false  // Không dùng session, dùng JWT
  })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=google_auth_failed`,
    session: false
  }),
  userController.handleOAuthCallback  //  Xử lý trong controller
);

// ============================================
//  OAUTH ROUTES - FACEBOOK (PUBLIC)
// ============================================
router.get('/auth/facebook',
  passport.authenticate('facebook', { 
    scope: ['email'],
    session: false
  })
);

router.get('/auth/facebook/callback',
  passport.authenticate('facebook', { 
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=facebook_auth_failed`,
    session: false
  }),
  userController.handleOAuthCallback  //  Xử lý trong controller
);

// ============================================
// ROUTES CÔNG KHAI - Không cần đăng nhập
// ============================================

// Đăng ký, đăng nhập, xác thực email
router.post('/register', userController.register);
router.get('/verify-email', userController.verifyEmail);
router.post('/login', userController.login);
router.post('/resend-verification', userController.resendVerification);
router.post('/request-manual-verification', userController.requestManualVerification);

// Reset password routes
router.post('/request-password-reset', userController.requestPasswordReset);
router.get('/verify-reset-token', userController.verifyResetToken);
router.post('/reset-password-with-token', userController.resetPasswordWithToken);

// Routes công khai cho bác sĩ
router.get('/doctors/public', userController.getAllDoctorsPublic);
router.get('/doctors/:code', userController.getDoctorByCode);
router.get('/doctors', userController.getDoctors);
router.put('/doctors/:userId/public-profile', authenticateToken, authorize('doctors:edit', 'admin', 'staff'), userController.updateDoctorPublicProfile);

// ============================================
// ROUTES CẦN ĐĂNG NHẬP - Authenticated users
// ============================================

// Quản lý profile của chính mình
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);
router.put('/change-password', authenticateToken, userController.changePassword);

// Lấy thông tin role của chính mình
//  THÊM MỚI: Lấy thông tin role & check thiếu hồ sơ (Thay thế route cũ nếu trùng tên)
router.get(
  '/profile/role-info',
  authenticateToken,
  userController.getMyRoleInfo
);

//  THÊM MỚI: Cập nhật hồ sơ sức khỏe (Patient)
router.put(
  '/patient/health-info',
  authenticateToken,
  authorize('patient'),
  userController.updatePatientHealthInfo
);

// ============================================
// ROUTES DÀNH CHO ADMIN - Admin only
// ============================================

// Thống kê và tìm kiếm (Thêm staff)
router.get('/stats', authenticateToken, authorize('admin', 'staff'), userController.getUserStats);
router.get('/search', authenticateToken, authorize('admin', 'staff'), userController.searchUsers);
router.get('/all', authenticateToken, authorize('admin', 'staff'), userController.getAllUsers);

// Lấy users theo role (Thêm staff)
router.get('/by-role', 
  authenticateToken, 
  authorize('admin', 'staff'),
  userController.getUsersByRole
);

// Quản lý user cụ thể (Cho phép Staff IT)
router.put('/:userId/reset-password-admin', 
  authenticateToken, 
  authorize('admin', 'staff'), 
  userController.resetPasswordByAdmin
);

router.put('/:userId/toggle-verification', 
  authenticateToken, 
  authorize('admin', 'staff'), 
  userController.toggleUserVerification
);

router.put('/:userId/toggle-status', 
  authenticateToken, 
  authorize('admin', 'staff'), 
  userController.toggleUserStatus
);

// Routes động với /:userId - PHẢI ĐẶT CUỐI CÙNG
router.get('/:userId', authenticateToken, userController.getUserById);
router.put('/:userId', authenticateToken, authorize('admin'), userController.updateUser);
router.delete('/:userId', authenticateToken, authorize('admin'), userController.deleteUser);

// ============================================
// Debug log - Hiển thị các routes đã đăng ký
// ============================================
console.log('\n========== USER ROUTES REGISTERED ==========');
console.log('OAUTH ROUTES:');
console.log('  GET    /api/users/auth/google');
console.log('  GET    /api/users/auth/google/callback');
console.log('  GET    /api/users/auth/facebook');
console.log('  GET    /api/users/auth/facebook/callback');
console.log('\nPUBLIC ROUTES:');
console.log('  POST   /api/users/register');
console.log('  GET    /api/users/verify-email');
console.log('  POST   /api/users/login');
console.log('  POST   /api/users/resend-verification');
console.log('  POST   /api/users/request-manual-verification');
console.log('  POST   /api/users/request-password-reset');
console.log('  GET    /api/users/verify-reset-token');
console.log('  POST   /api/users/reset-password-with-token');
console.log('  GET    /api/users/doctors');
console.log('  GET    /api/users/doctors/public');
console.log('  GET    /api/users/doctors/:code');
console.log('\nAUTHENTICATED ROUTES:');
console.log('  GET    /api/users/profile');
console.log('  PUT    /api/users/profile');
console.log('  PUT    /api/users/change-password');
console.log('  GET    /api/users/my-role-info');
console.log('\nADMIN ROUTES:');
console.log('  GET    /api/users/stats');
console.log('  GET    /api/users/search');
console.log('  GET    /api/users/all');
console.log('  GET    /api/users/by-role');
console.log('  PUT    /api/users/:userId/reset-password-admin');
console.log('  PUT    /api/users/:userId/toggle-verification');
console.log('  PUT    /api/users/:userId/toggle-status');
console.log('  GET    /api/users/:userId');
console.log('  PUT    /api/users/:userId');
console.log('  DELETE /api/users/:userId');
console.log('============================================\n');

module.exports = router;