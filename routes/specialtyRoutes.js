// ============================================
// server/routes/specialtyRoutes.js
// ============================================

const express = require('express');
const router = express.Router();
const specialtyController = require('../controllers/specialtyController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Routes công khai - Lấy danh sách chuyên khoa
router.get('/', specialtyController.getAllSpecialties);
router.get('/:id', specialtyController.getSpecialtyById);
router.get('/slug/:slug', specialtyController.getSpecialtyBySlug);
router.get('/:id/doctors', specialtyController.getDoctorsBySpecialty);

// Routes dành cho Admin
router.post('/', authenticateToken, authorize('admin'), specialtyController.createSpecialty);
router.put('/:id', authenticateToken, authorize('admin'), specialtyController.updateSpecialty);
router.delete('/:id', authenticateToken, authorize('admin'), specialtyController.deleteSpecialty);

module.exports = router;