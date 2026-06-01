// server/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Import middleware xác thực và phân quyền
const { authMiddleware, authorize } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware'); // ✅ THÊM: Middleware phân quyền chi tiết 

// ==================================================================
// 1. KHU VỰC PUBLIC (WEBHOOK - KHÔNG CẦN ĐĂNG NHẬP)
// ⚠️ QUAN TRỌNG: Route này BẮT BUỘC phải đặt trên cùng
// ==================================================================

// Webhook nhận tiền về (Fix lỗi 404)
router.post('/webhook/bank-transfer', (req, res, next) => {
    console.log('🔔 [WEBHOOK] Nhận tín hiệu từ ngân hàng:', req.body);
    next();
}, paymentController.handleBankWebhook);

// Callback trả về từ cổng thanh toán
router.get('/vnpay-return', paymentController.vnpayReturn);
router.get('/momo-return', paymentController.momoReturn);
router.post('/momo-ipn', paymentController.momoIPN);

// ==================================================================
// 2. KHU VỰC PROTECTED (CẦN ĐĂNG NHẬP)
// ==================================================================
router.use(authMiddleware); 

// --- User Routes (Bệnh nhân/Bác sĩ có thể tạo thanh toán) ---
router.post('/', paymentController.createPayment); 
router.post('/consultation', paymentController.createConsultationPayment);
router.post('/refund', paymentController.processRefund);
router.get('/my-payments', paymentController.getMyPayments);
router.get('/appointment/:appointment_id', paymentController.getPaymentByAppointment);

// --- Config Route (Cho phép cả Staff/Admin/User truy cập để lấy thông tin CK) ---
router.get('/config', authorize('admin', 'patient', 'doctor', 'staff'), paymentController.getPaymentConfig);

// ==================================================================
// ⚠️ QUAN TRỌNG: PHÂN QUYỀN CHI TIẾT CHO STAFF TÀI CHÍNH
// Chỉ Staff Finance có quyền payments:view, payments:verify, payments:approve
// Staff từ phòng ban khác (Content, Clinical) KHÔNG được truy cập
// ==================================================================

// --- Admin/Staff Routes - YÊU CẦU QUYỀN CHI TIẾT ---

// 1. CÁC ROUTE CỤ THỂ (STATIC ROUTES) - BẮT BUỘC ĐẶT LÊN TRÊN CÙNG
// ---------------------------------------------------------------
// 🔐 CẬP NHẬT CẤU HÌNH THANH TOÁN
router.put('/config', authorize('admin'), paymentController.updatePaymentConfig);

// 👁️ XEM TẤT CẢ THANH TOÁN
router.get('/all', authMiddleware, roleMiddleware('payments:view'), paymentController.getAllPayments);

// 📊 THỐNG KÊ DOANH THU 
router.get('/statistics/revenue', authMiddleware, roleMiddleware('payments:view'), paymentController.getRevenueStatistics);

// 💰 DANH SÁCH YÊU CẦU HOÀN TIỀN 
router.get('/refunds', authMiddleware, roleMiddleware('refund_requests:view'), paymentController.getRefundRequests);

// ⚙️ XỬ LÝ YÊU CẦU HOÀN TIỀN
const upload = require('../config/upload'); // Import upload config
router.put('/refunds/:id/process', 
  authMiddleware,
  roleMiddleware('refund_requests:approve'), 
  upload.single('proof_image'), 
  paymentController.processRefundRequest
);

// 💊 NHÀ THUỐC BÁN LẺ (RETAIL PHARMACY)
// Yêu cầu staff có quyền bán lẻ / truy cập thanh toán POS
router.get('/pharmacy/retail', authMiddleware, roleMiddleware('payments:view'), paymentController.getRetailInvoices);
router.post('/pharmacy/retail', authMiddleware, roleMiddleware('payments:pos'), paymentController.createRetailInvoice);


// 2. CÁC ROUTE ĐỘNG (DYNAMIC ROUTES CÓ /:id) - BẮT BUỘC ĐẶT XUỐNG DƯỚI
// ---------------------------------------------------------------
// ✅ XÁC NHẬN THANH TOÁN
router.put('/:id/confirm', authMiddleware, roleMiddleware('payments:approve'), paymentController.confirmPayment);

// ❌ TỪ CHỐI THANH TOÁN
router.put('/:id/reject', authMiddleware, roleMiddleware('payments:approve'), paymentController.rejectPayment);

// 🔍 KIỂM TRA TRẠNG THÁI GIAO DỊCH
router.get('/:id/check-status', authMiddleware, roleMiddleware('payments:verify'), paymentController.adminCheckTransaction);

// 🖊️ XÁC MINH THỦ CÔNG
router.put('/:id/verify-manual', authMiddleware, roleMiddleware('payments:verify'), paymentController.verifyManualPayment);

// 👁️ XEM CHI TIẾT 1 GIAO DỊCH (Tuyến bắt wildcard /:id luôn phải để cuối cùng)
router.get('/:id', authMiddleware, roleMiddleware('payments:view'), paymentController.getPaymentById);

module.exports = router;