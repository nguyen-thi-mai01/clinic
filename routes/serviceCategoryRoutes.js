// server/routes/serviceCategoryRoutes.js
const express = require('express');
const router = express.Router();
const serviceCategoryController = require('../controllers/serviceCategoryController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// =================================================================
// ⚠️ QUAN TRỌNG: PUBLIC ROUTES PHẢI ĐẶT TRƯỚC ADMIN ROUTES
// Để tránh conflict với các routes có pattern tương tự
// =================================================================

// =================================================================
// ========================= PUBLIC ROUTES =========================
// =================================================================

// @route   GET /api/service-categories/slug/:slug
// @desc    Lấy chi tiết danh mục và các dịch vụ con theo slug
// ⚠️ PHẢI ĐẶT TRƯỚC các routes có pattern /:id
router.get('/slug/:slug', serviceCategoryController.getPublicCategoryBySlug);

// @route   GET /api/service-categories
// @desc    Lấy tất cả danh mục dịch vụ công khai (active)
router.get('/', serviceCategoryController.getPublicServiceCategories);


// =================================================================
// ========================== ADMIN ROUTES =========================
// =================================================================

// @route   GET /api/service-categories/admin/all
// @desc    Lấy tất cả danh mục cho trang quản trị (Admin hoặc Staff có quyền services)
router.get(
    '/admin/all',
    authenticateToken,
    authorize('admin', 'staff'),
    serviceCategoryController.getServiceCategoriesForAdmin
);

// @route   GET /api/service-categories/:id
// @desc    Lấy chi tiết 1 danh mục theo ID (để edit)
router.get(
    '/:id',
    authenticateToken,
    authorize('admin', 'staff'),
    serviceCategoryController.getServiceCategoryById
);

// @route   POST /api/service-categories
// @desc    Tạo danh mục mới
router.post(
    '/',
    authenticateToken,
    authorize('admin', 'staff'),
    serviceCategoryController.createServiceCategory
);

// @route   PUT /api/service-categories/:id
// @desc    Cập nhật danh mục
router.put(
    '/:id',
    authenticateToken,
    authorize('admin', 'staff'),
    serviceCategoryController.updateServiceCategory
);

// @route   DELETE /api/service-categories/:id
// @desc    Xóa danh mục
router.delete(
    '/:id',
    authenticateToken,
    authorize('admin', 'staff'),
    serviceCategoryController.deleteServiceCategory
);

module.exports = router;