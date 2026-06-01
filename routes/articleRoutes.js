const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// =====================================================
// ===== PUBLIC ROUTES - KHÔNG CẦN AUTH =====
router.get('/categories', articleController.getCategories);
router.get('/public', articleController.getPublicArticles);
router.get('/slug/:slug', articleController.getArticleBySlug);
router.get('/tags/all', articleController.getAllTags);
router.get('/related/:id', articleController.getRelatedArticles);
router.post('/:id/view', articleController.trackArticleView);
router.get('/search', articleController.searchArticles);
router.get('/search/global', articleController.globalSearch);

// Lấy danh sách bình luận công khai
router.get('/:id/public-comments', articleController.getPublicComments);

// ===== PROTECTED ROUTES - CẦN AUTH =====

// --- AI TRỢ LÝ & CÂN BẰNG TẢI BÁC SĨ (THÊM MỚI) ---
// AI summary/classify is used from the public article detail page, so keep this endpoint public.
router.post('/ai-analyze', articleController.analyzeArticleWithAI);
router.get('/suggest-doctor/:specialtyId', authenticateToken, articleController.getLeastBusyDoctor);

// --- TAGS & SAVED ARTICLES ---
router.get('/tags/suggest', authenticateToken, articleController.suggestTags);
router.get('/saved', authenticateToken, articleController.getSavedArticles);
router.get('/admin/statistics/overview', authenticateToken, roleMiddleware(null, ['admin', 'staff', 'doctor']), articleController.getAdminArticleStatistics);

// =====================================================
// ROUTES CHO THUỐC (MEDICINES) & BỆNH LÝ (DISEASES)
// =====================================================
// --- THUỐC ---
router.get('/medicines/export', authenticateToken, roleMiddleware('articles:view'), articleController.exportMedicines);
router.post('/medicines/import', authenticateToken, roleMiddleware('articles:create'), articleController.importMedicines);
router.get('/medicines/suggestions', authenticateToken, articleController.getMedicineSuggestions);
router.post('/medicines/suggestions', authenticateToken, articleController.createMedicineSuggestion);
router.get('/medicines/slug/:slug', articleController.getMedicineBySlug);
router.put('/medicines/:id/toggle-hide', authenticateToken, roleMiddleware('articles:edit'), articleController.toggleHideMedicine);
router.get('/medicines/:id', authenticateToken, articleController.getArticleById); 
router.put('/medicines/:id', authenticateToken, roleMiddleware('articles:edit'), articleController.updateMedicine);
router.delete('/medicines/:id', authenticateToken, roleMiddleware('articles:delete'), articleController.deleteMedicine);
router.get('/medicines', articleController.getMedicines);
router.post('/medicines', authenticateToken, roleMiddleware('articles:create_medicine'), articleController.createMedicine);
router.post('/medicines/bulk', authenticateToken, roleMiddleware('articles:edit'), articleController.bulkMedicineActions);

// --- BỆNH LÝ ---
router.get('/diseases/export', authenticateToken, roleMiddleware('articles:view'), articleController.exportDiseases);
router.post('/diseases/import', authenticateToken, roleMiddleware('articles:create'), articleController.importDiseases);
router.get('/diseases/suggestions', authenticateToken, articleController.getDiseaseSuggestions);
router.post('/diseases/suggestions', authenticateToken, articleController.createDiseaseSuggestion);
router.get('/diseases/slug/:slug', articleController.getDiseaseBySlug);
router.put('/diseases/:id/toggle-hide', authenticateToken, roleMiddleware('articles:edit'), articleController.toggleHideDisease);
router.get('/diseases/:id', authenticateToken, articleController.getArticleById);
router.put('/diseases/:id', authenticateToken, roleMiddleware('articles:edit'), articleController.updateDisease);
router.delete('/diseases/:id', authenticateToken, roleMiddleware('articles:delete'), articleController.deleteDisease);
router.get('/diseases', articleController.getDiseases);
router.post('/diseases', authenticateToken, roleMiddleware('articles:create_disease'), articleController.createDisease);
router.post('/diseases/bulk', authenticateToken, roleMiddleware('articles:edit'), articleController.bulkDiseaseActions);

// =====================================================
// ROUTES CHO ĐỀ XUẤT BÀI VIẾT (SUGGESTIONS)
// =====================================================
router.get('/suggestions', authenticateToken, roleMiddleware('articles:view'), articleController.getSuggestions);
router.post('/suggestions', authenticateToken, roleMiddleware('articles:create_draft'), articleController.createSuggestion);
router.put('/suggestions/:id/review', authenticateToken, roleMiddleware('articles:approve'), articleController.reviewSuggestion);
router.put('/medicines/suggestions/:id/review', authenticateToken, roleMiddleware('articles:approve_medicine'), articleController.reviewMedicineSuggestion);
router.put('/diseases/suggestions/:id/review', authenticateToken, roleMiddleware('articles:approve_disease'), articleController.reviewDiseaseSuggestion);

// =====================================================
// CÁC ROUTES CÓ THAM SỐ ID CHUNG (ARTICLE ID)
// =====================================================
router.get('/:id/review-history', authenticateToken, roleMiddleware('articles:view'), articleController.getArticleReviewHistory);
router.post('/:id/review', authenticateToken, roleMiddleware('articles:approve'), articleController.reviewArticle);
router.post('/:id/hide', authenticateToken, roleMiddleware('articles:edit'), articleController.hideArticle);
router.post('/:id/unhide', authenticateToken, roleMiddleware('articles:edit'), articleController.unhideArticle);
router.post('/:id/resubmit', authenticateToken, roleMiddleware('articles:edit'), articleController.resubmitArticle);
router.post('/:id/approve-edit-request', authenticateToken, roleMiddleware('articles:approve'), articleController.approveEditRequest);
router.post('/:id/reject-edit-request', authenticateToken, roleMiddleware('articles:approve'), articleController.rejectEditRequest);
router.post('/:id/request-rewrite', authenticateToken, roleMiddleware('articles:approve'), articleController.requestRewrite);
router.post('/:id/duplicate', authenticateToken, roleMiddleware('articles:create'), articleController.duplicateArticle);

// --- COMMENTS & INTERACTION ---
router.get('/:id/comments', authenticateToken, articleController.getArticleComments);
router.post('/:id/comments', authenticateToken, articleController.addCommentToArticle);
router.delete('/:id/comments/:commentId', authenticateToken, articleController.deleteComment);
router.post('/:id/public-comments', authenticateToken, articleController.addPublicComment);
router.get('/:id/reports', authenticateToken, roleMiddleware(['admin']), articleController.getArticleReports);
router.post('/:id/report', authenticateToken, articleController.reportArticle);
router.get('/:id/interactions', authenticateToken, articleController.getArticleInteractions);
router.post('/:id/interact', authenticateToken, articleController.interactArticle);

// --- CRUD OPERATIONS ---
router.get('/:id', authenticateToken, articleController.getArticleById);
router.put('/:id', authenticateToken, roleMiddleware('articles:edit'), articleController.updateArticle);
router.delete('/:id', authenticateToken, roleMiddleware('articles:delete'), articleController.deleteArticle);

// ===== ROUTE ĐỘNG /:categoryType/:slug - ĐẶT CUỐI CÙNG =====
router.get('/:categoryType/:slug', articleController.getByTypeAndSlug);

// ===== ROUTE MẶC ĐỊNH (LIST & CREATE) =====
router.get('/', authenticateToken, roleMiddleware(null, ['admin', 'staff', 'doctor']), articleController.getArticles);
router.post('/', authenticateToken, roleMiddleware('articles:create'), articleController.createArticle);

module.exports = router;