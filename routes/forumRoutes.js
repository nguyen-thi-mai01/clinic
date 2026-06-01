// server/routes/forumRoutes.js
const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');
const { authenticateToken, authenticateTokenBasic } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// ========== PUBLIC ROUTES ==========
// Lấy danh sách câu hỏi đã duyệt (public)
router.get('/questions/public', forumController.getPublicQuestions);

// Lấy thống kê và bảng xếp hạng diễn đàn
router.get('/stats/overview', forumController.getForumOverview);

// ========== AUTHENTICATED USER ROUTES ==========
// ✅ Lấy câu hỏi đã lưu của user (PHẢI ĐẶT TRƯỚC /questions/:id)
router.get('/questions/saved', authenticateTokenBasic, forumController.getSavedQuestions);

// ✅ Lấy câu hỏi đã thích của user (PHẢI ĐẶT TRƯỚC /questions/:id)
router.get('/questions/liked', authenticateTokenBasic, forumController.getLikedQuestions);

// ✅ Lấy câu hỏi mà user đã trả lời (PHẢI ĐẶT TRƯỚC /questions/:id)
router.get('/questions/answered', authenticateTokenBasic, forumController.getMyAnsweredQuestions);

// Lấy chi tiết một câu hỏi và các câu trả lời
router.get('/questions/:id', forumController.getQuestionDetail);

// Người dùng đăng câu hỏi mới (cho phép user chưa verify/active)
router.post('/questions', authenticateTokenBasic, forumController.createQuestion);

// Người dùng trả lời câu hỏi
router.post('/questions/:id/answers', authenticateTokenBasic, forumController.createAnswer);

// Like/unlike câu hỏi
router.post('/questions/:id/like', authenticateTokenBasic, forumController.toggleLikeQuestion);

// Like/unlike câu trả lời
router.post('/answers/:id/like', authenticateTokenBasic, forumController.toggleLikeAnswer);

// ✅ Save/unsave câu hỏi (Bookmark)
router.post('/questions/:id/save', authenticateTokenBasic, forumController.toggleSaveQuestion);

// Báo cáo câu hỏi/câu trả lời
router.post('/reports', authenticateTokenBasic, forumController.createReport);

// ========== ADMIN ROUTES ==========
// ==================================================================
// HỆ THỐNG PHÂN QUYỀN FORUM - GIỐNG NHƯ ARTICLES:
// Có quyền forum:create_topic → Tạo topic
// Có quyền forum:edit_topic → Sửa topic
// Có quyền forum:toggle_topic → Ẩn/hiện topic
// Có quyền forum:delete_topic → Xóa topic
// Có quyền forum:assign_moderators → Phân công moderators
//
// ✅ Có ít nhất 1 quyền forum → Truy cập trang Quản lý diễn đàn
// ✅ Chỉ phòng Content và Support được cấp quyền forum
// ✅ roleMiddleware tự động check permissions.forum array
// ==================================================================

// 📋 XEM DANH SÁCH CÂU HỎI
// - Nếu query có authorId = user hiện tại → Cho phép (xem câu hỏi của chính mình)
// - Nếu không → Yêu cầu quyền SUPPORT_FORUM
router.get('/questions', authenticateToken, (req, res, next) => {
  const { authorId } = req.query;
  // Nếu user xem câu hỏi của chính mình, bỏ qua check quyền
  if (authorId && parseInt(authorId) === req.user.id) {
    return next();
  }
  // Nếu không, yêu cầu quyền SUPPORT_FORUM
  return roleMiddleware('SUPPORT_FORUM')(req, res, next);
}, forumController.getAllQuestions);

// ✅❌ DUYỆT/TỪ CHỐI CÂU HỎI
router.put('/questions/:id/status', authenticateToken, roleMiddleware('SUPPORT_FORUM'), forumController.updateQuestionStatus);

// 📦 CẬP NHẬT HÀNG LOẠT
router.post('/questions/bulk/status', authenticateToken, roleMiddleware('SUPPORT_FORUM'), forumController.bulkUpdateQuestionStatus);

// 🗑️ XÓA CÂU HỎI/CÂU TRẢ LỜI
router.delete('/questions/:id', authenticateToken, roleMiddleware('SUPPORT_FORUM'), forumController.deleteQuestion);
router.delete('/answers/:id', authenticateToken, roleMiddleware('SUPPORT_FORUM'), forumController.deleteAnswer);

// 📌 GHIM CÂU TRẢ LỜI
router.put('/answers/:id/pin', authenticateToken, roleMiddleware('SUPPORT_FORUM'), forumController.togglePinAnswer);

// ✓ XÁC NHẬN CÂU TRẢ LỜI CHẤT LƯỢNG
router.put('/answers/:id/verify', authenticateToken, roleMiddleware('SUPPORT_FORUM'), forumController.toggleVerifyAnswer);

// 🚩 DANH SÁCH BÁO CÁO
router.get('/reports', authenticateToken, roleMiddleware('SUPPORT_FORUM'), forumController.getReports);

// ✅ XỬ LÝ BÁO CÁO
router.put('/reports/:id', authenticateToken, roleMiddleware('SUPPORT_FORUM'), forumController.updateReport);

// 🆕 TOPIC MANAGEMENT
// Public: Lấy danh sách topics (chỉ active)
router.get('/topics', forumController.getAllTopics);

// Admin: Tạo topic mới
router.post('/topics', authenticateToken, roleMiddleware('forum:create_topic'), forumController.createTopic);

// Admin: Sửa topic
router.put('/topics/:id', authenticateToken, roleMiddleware('forum:edit_topic'), forumController.updateTopic);

// Admin: Toggle ẩn/hiện topic
router.patch('/topics/:id/toggle', authenticateToken, roleMiddleware('forum:toggle_topic'), forumController.toggleTopicStatus);

// Admin: Xóa topic (chỉ khi không có câu hỏi)
router.delete('/topics/:id', authenticateToken, roleMiddleware('forum:delete_topic'), forumController.deleteTopic);

// Phân công moderators - Cần quyền forum:assign_moderators
router.post('/topics/:id/moderators', authenticateToken, roleMiddleware('forum:assign_moderators'), forumController.assignModerators);

// ========== QUESTION APPROVAL ==========
router.put('/questions/:id/approve', authenticateToken, roleMiddleware('SUPPORT_FORUM'), forumController.approveQuestion);
router.put('/questions/:id/reject', authenticateToken, roleMiddleware('SUPPORT_FORUM'), forumController.rejectQuestion);

// ========== REPORT HANDLING ==========
router.put('/reports/:id/handle', authenticateToken, roleMiddleware('SUPPORT_FORUM'), forumController.handleReport);

module.exports = router;
