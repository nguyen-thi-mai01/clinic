// server/routes/communityRoutes.js
const express = require('express');
const router  = express.Router();
const communityController = require('../controllers/communityController');
const { authenticateToken, authenticateTokenBasic, authenticateTokenOptional } = require('../middleware/authMiddleware');

const allowDoctorStaffAdmin = (req, res, next) => {
  const role = req.user?.role?.name?.toLowerCase() || req.user?.role?.toLowerCase();
  if (['admin', 'staff', 'doctor'].includes(role)) return next();
  return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin / Staff / Doctor.' });
};

const allowAdminOnly = (req, res, next) => {
  const role = req.user?.role?.name?.toLowerCase() || req.user?.role?.toLowerCase();
  if (role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền này.' });
};

// ════════════════════════════════════════════════════════════════════
// PUBLIC & CÀI ĐẶT
// ════════════════════════════════════════════════════════════════════
router.get('/groups', authenticateTokenOptional, communityController.getGroups); 
router.get('/groups/managed', authenticateToken, communityController.getManagedGroups);
router.get('/groups/:slug', authenticateTokenOptional, communityController.getGroupBySlug);
router.get('/groups/:id/posts', authenticateTokenOptional, communityController.getGroupPosts);
router.get('/settings/group-creation', communityController.getGroupSettings);
router.put('/settings/group-creation/toggle', authenticateToken, allowAdminOnly, communityController.toggleGroupSettings);

// ════════════════════════════════════════════════════════════════════
// AUTHENTICATED (USER)
// ════════════════════════════════════════════════════════════════════
router.get('/my-groups', authenticateToken, communityController.getMyGroups);
router.post('/groups', authenticateToken, communityController.createGroup);
router.put ('/groups/:id', authenticateToken, communityController.updateGroup);
router.delete('/groups/:id', authenticateToken, communityController.deleteGroup);

router.post  ('/groups/:id/join',  authenticateToken, communityController.joinGroup);
router.delete('/groups/:id/leave', authenticateToken, communityController.leaveGroup);
router.post('/groups/:id/invite', authenticateToken, communityController.inviteMember);

router.get ('/groups/:id/members',                       authenticateToken, communityController.getGroupMembers);
router.put ('/groups/:id/members/:userId/mute',          authenticateToken, communityController.muteMember);
router.put ('/groups/:id/members/:userId/unmute',        authenticateToken, communityController.unmuteMember);
router.put ('/groups/:id/members/:userId/kick',          authenticateToken, communityController.kickMember);
router.put ('/groups/:id/members/:userId/promote',       authenticateToken, communityController.promoteMember);
router.get ('/groups/:id/members/:userId/posts',         authenticateToken, communityController.getMemberPosts);

router.post('/groups/:id/posts',         authenticateToken, communityController.createGroupPost);
router.put ('/groups/:id/posts/:postId', authenticateToken, communityController.updateGroupPost);
router.delete('/groups/:id/posts/:postId', authenticateToken, communityController.deleteGroupPost);

router.put('/posts/:postId/approve', authenticateToken, communityController.approveGroupPost);
router.put('/posts/:postId/reject',  authenticateToken, communityController.rejectGroupPost);
router.get('/groups/:id/posts/pending',  authenticateToken, communityController.getPendingGroupPosts);
router.get('/groups/:id/posts/reported', authenticateToken, communityController.getReportedGroupPosts);
router.get('/groups/:id/my-posts', authenticateToken, communityController.getMyGroupPosts);

// TƯƠNG TÁC BÀI ĐĂNG
router.post('/posts/:postId/like',    authenticateToken, communityController.toggleLikePost);
router.post('/posts/:postId/comment', authenticateToken, communityController.commentOnPost);
router.post('/posts/:postId/report',  authenticateToken, communityController.reportPost);

// ✅ ROUTE LƯU BÀI VIẾT (QUAN TRỌNG)
router.post('/posts/:postId/save',    authenticateToken, communityController.savePost);
router.delete('/posts/:postId/save',  authenticateToken, communityController.unsavePost);
router.get('/groups/:id/saved',       authenticateToken, communityController.getSavedPosts);

router.post('/groups/:id/request-hide',            authenticateToken, communityController.requestHideGroup);
router.post('/groups/:id/request-transfer-doctor', authenticateToken, communityController.requestTransferDoctor);

// Lấy chi tiết 1 bài post trong nhóm
router.get('/groups/:groupSlug/posts/:postId', authenticateTokenOptional, communityController.getGroupPostDetail);

// ════════════════════════════════════════════════════════════════════
// ADMIN QUYỀN LỰC TỐI CAO
// ════════════════════════════════════════════════════════════════════
router.get('/admin/groups', authenticateToken, allowDoctorStaffAdmin, communityController.adminGetAllGroups);
router.put('/admin/groups/:id/approve', authenticateToken, allowDoctorStaffAdmin, communityController.adminApproveGroup);
router.put('/admin/groups/:id/reject',  authenticateToken, allowDoctorStaffAdmin, communityController.adminRejectGroup);
router.put('/admin/groups/:id/force-suspend', authenticateToken, allowAdminOnly, communityController.adminForceSuspendGroup);
router.put('/admin/groups/:id/force-active', authenticateToken, allowAdminOnly, communityController.adminForceActiveGroup);
router.post('/admin/groups/:id/warn', authenticateToken, allowAdminOnly, communityController.adminWarnGroup);
router.delete('/admin/groups/:id/force-delete', authenticateToken, allowAdminOnly, communityController.adminForceDeleteGroup);

module.exports = router;