const express = require('express');
const router = express.Router();
const marketingController = require('../controllers/marketingController');
const roleMiddleware = require('../middleware/roleMiddleware');
const { authMiddleware } = require('../middleware/authMiddleware');
// Public APIs
router.get('/events/popup', marketingController.getPopupEvent);
router.get('/events/banner-ad', marketingController.getBannerAdEvent);
router.get('/events', marketingController.getEvents);

// ✅ SỬA LỖI XUNG ĐỘT ROUTE: Các route GET tĩnh phải nằm TRƯỚC route động /:id
router.get('/events/my-registrations', authMiddleware, marketingController.getMyRegistrations);
router.get('/events/stats', authMiddleware, roleMiddleware('events_vouchers:view_events', ['admin']), marketingController.getEventStats);
router.get('/events/export', authMiddleware, roleMiddleware('events_vouchers:view_events', ['admin']), marketingController.exportEvents);

router.get('/events/:id', marketingController.getEventDetail);

router.use(authMiddleware);

// Protected APIs (User)
router.get('/my-vouchers', marketingController.getMyVouchers);
router.get('/public-promotions', marketingController.getPublicPromotions); // ✅ SỬA LỖI: Thêm route này để Kho chung hết bị Đang tải
router.post('/claim-voucher', marketingController.claimVoucher); // ✅ SỬA LỖI: Thêm route cho nút Lưu mã
router.post('/game/play', marketingController.playGame); // Quay thưởng
router.get('/game/rewards', marketingController.getGameRewards); // ✅ THÊM MỚI: API Lấy danh sách quà vòng quay
// ✅ THÊM MỚI: API Điểm danh và Đổi điểm
router.get('/my-points', marketingController.getMyPoints);
// SAU KHI SỬA
router.post('/checkin', marketingController.dailyCheckin);
// Đổi route để nhận ID của voucher CỤ THỂ
router.post('/exchange-points/:promoId', marketingController.exchangePoints);
router.post('/validate-voucher', marketingController.validateVoucher); // ✅ MỚI

// Admin APIs (Tạo sự kiện, tạo voucher - Phần này bạn tự bổ sung CRUD cơ bản)
// Ví dụ:
// router.post('/events', roleMiddleware('marketing:manage_events'), marketingController.createEvent);

// --- ADMIN ROUTES (Cần quyền Staff/Admin) ---
// Lưu ý: roleMiddleware bạn đã cấu hình 'marketing:manage_events' ở bước trước
router.post('/events', roleMiddleware('events_vouchers:create_event', ['admin']), marketingController.createEvent);
router.delete('/events/:id', roleMiddleware('events_vouchers:delete_event', ['admin']), marketingController.deleteEvent);

router.get('/promotions', roleMiddleware('events_vouchers:view_vouchers', ['admin']), marketingController.getAllPromotions);
router.get('/promotions/selection-data', roleMiddleware('events_vouchers:view_vouchers', ['admin']), marketingController.getSelectionData); // <-- API MỚI CHO BỘ LỌC
router.post('/promotions', roleMiddleware('events_vouchers:create_voucher', ['admin']), marketingController.createPromotion);
router.delete('/promotions/:id', roleMiddleware('events_vouchers:delete_voucher', ['admin']), marketingController.deletePromotion);

router.put('/events/:id', roleMiddleware('events_vouchers:edit_event', ['admin']), marketingController.updateEvent);
router.put('/events/:id/toggle', roleMiddleware('events_vouchers:edit_event', ['admin']), marketingController.toggleEventStatus);
router.put('/events/:id/status', roleMiddleware('events_vouchers:edit_event', ['admin']), marketingController.updateEventWorkflowStatus);
router.post('/events/:id/track', marketingController.trackEventStats); // Public tracking
router.post('/events/register', authMiddleware, marketingController.registerEvent);
router.delete('/events/registrations/:registration_id/cancel', authMiddleware, marketingController.cancelRegistration);

// (Đã dời route /my-registrations lên trên cùng để tránh lỗi)

// ✅ SAU KHI SỬA (thêm các route mới):
router.put('/promotions/:id', roleMiddleware('events_vouchers:edit_voucher', ['admin']), marketingController.updatePromotion);
// ✅ Thêm 2 route mới:
router.put('/promotions/:id/toggle', roleMiddleware('events_vouchers:edit_voucher', ['admin']), marketingController.togglePromotion);
router.get('/game/history', authMiddleware, marketingController.getMyGameHistory);




// ✅ Wheel Event routes
router.get('/wheel-events',           authMiddleware, roleMiddleware('events_vouchers:view_vouchers', ['admin']), marketingController.getWheelEvents);
router.post('/wheel-events',          authMiddleware, roleMiddleware('events_vouchers:create_game', ['admin']), marketingController.createWheelEvent);
router.put('/wheel-events/:id',       authMiddleware, roleMiddleware('events_vouchers:edit_voucher', ['admin']), marketingController.updateWheelEvent);
router.put('/wheel-events/:id/toggle',authMiddleware, roleMiddleware('events_vouchers:edit_voucher', ['admin']), marketingController.toggleWheelEvent);
router.delete('/wheel-events/:id',    authMiddleware, roleMiddleware('events_vouchers:delete_voucher', ['admin']), marketingController.deleteWheelEvent);
router.get('/wheel-events/winners',   authMiddleware, roleMiddleware('events_vouchers:config_rewards', ['admin']), marketingController.getWinners);

// (Đã dời route /stats và /export lên trên cùng để tránh lỗi)
router.post('/events/:id/duplicate', roleMiddleware('events_vouchers:create_event', ['admin']), marketingController.duplicateEvent);
router.post('/events/checkin', roleMiddleware('events_vouchers:edit_event', ['admin']), marketingController.checkInByQR);
router.get('/events/:event_id/registrations', roleMiddleware('events_vouchers:view_events', ['admin']), marketingController.getEventRegistrations);

// ✅ ROUTE MỚI CHO GIAI ĐOẠN 2
router.post('/events/distribute-gift', roleMiddleware('events_vouchers:edit_event', ['admin']), marketingController.distributeGift);
router.get('/events/:event_id/command-center', roleMiddleware('events_vouchers:view_events', ['admin']), marketingController.getCommandCenterStats);

// ✅ API CHO CẤU HÌNH ĐIỂM DANH & VÒNG QUAY (ĐỔI ĐIỂM)
router.get('/loyalty-config', marketingController.getLoyaltyConfig);
router.put('/loyalty-config', authMiddleware, roleMiddleware('events_vouchers:config_rewards', ['admin']), marketingController.updateLoyaltyConfig);

module.exports = router;