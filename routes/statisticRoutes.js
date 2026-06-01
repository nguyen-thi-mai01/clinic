// ===== [BƯỚC 4] DOCTOR STATISTICS ROUTES (2024-05-09) =====
// server/routes/statisticRoutes.js
//
// Public endpoints for doctor reviews and unified statistics
// No authentication required

const express = require('express');
const router = express.Router();
const statisticController = require('../controllers/statisticController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// ===== [BƯỚC 4] PUBLIC STATISTICS ENDPOINTS =====

/**
 * Get paginated doctor reviews (combined consultation + appointment)
 * GET /api/statistics/doctor/:id/reviews
 * Query: service_type, sort, page, limit, status
 * 
 * Auth: Public (no token required)
 * Response: { reviews[], pagination }
 */
router.get('/doctor/:id/reviews', statisticController.getDoctorReviews);

router.get('/doctor/:id/my-review', authenticateToken, authorize('patient', 'doctor', 'admin', 'staff'), statisticController.getMyDoctorReview);

router.post('/doctor/:id/reviews', authenticateToken, authorize('patient'), statisticController.submitDoctorReview);

router.put('/doctor/:id/reviews', authenticateToken, authorize('patient'), statisticController.updateDoctorReview);

router.delete('/doctor/:id/reviews', authenticateToken, authorize('patient'), statisticController.deleteDoctorReview);

router.get('/admin/doctor-reviews', authenticateToken, authorize('admin', 'staff'), statisticController.adminListDoctorReviews);

router.put('/admin/doctor-reviews/:review_id/status', authenticateToken, authorize('admin', 'staff'), statisticController.adminUpdateDoctorReviewStatus);

/**
 * Get unified statistics for doctor
 * GET /api/statistics/doctor/:id/unified
 * 
 * Auth: Public (no token required)
 * Response: { avg_rating, total_reviews, breakdown, by_type, rating_by_type }
 */
router.get('/doctor/:id/unified', statisticController.getDoctorUnifiedStats);

module.exports = router;
