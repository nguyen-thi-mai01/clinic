// ============================================
// server/routes/searchRoutes.js
// Routes cho chức năng tìm kiếm
// ============================================

const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

/**
 * GET /api/search?q=keyword
 * Tìm kiếm toàn hệ thống
 */
router.get('/', searchController.search);

/**
 * GET /api/search/advanced?q=keyword&type=doctor,article&category=...
 * Tìm kiếm nâng cao với filters
 */
router.get('/advanced', searchController.advancedSearch);

module.exports = router;