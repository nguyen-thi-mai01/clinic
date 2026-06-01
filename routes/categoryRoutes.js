// ============================================
// server/routes/categoryRoutes.js
// Routes cho quản lý danh mục với category_type
// ============================================

const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// ============================================
// PUBLIC ROUTES - Không cần authentication
// ============================================

router.get('/', categoryController.getAllCategories);
router.get('/types', categoryController.getCategoryTypes);
router.get('/by-type/:type', categoryController.getCategoriesByType);
router.get('/slug/:slug', categoryController.getCategoryBySlug);
router.get('/:id', categoryController.getCategoryById);

// ============================================
// PROTECTED ROUTES - Chỉ dành cho Admin
// ============================================

router.post(
  '/', 
  authenticateToken,
  authorize('admin'),
  categoryController.createCategory
);

router.put(
  '/bulk/bulk-ads', 
  authenticateToken,
  authorize('admin'),
  categoryController.bulkUpdateAds
);

router.put(
  '/:id', 
  authenticateToken,
  authorize('admin'),
  categoryController.updateCategory
);

router.delete(
  '/:id', 
  authenticateToken,
  authorize('admin'),
  categoryController.deleteCategory
);

module.exports = router;