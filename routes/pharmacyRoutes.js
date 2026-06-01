// server/routes/pharmacyRoutes.js

const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacyController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// ============================================================
// RATE LIMITER — chỉ cho POS public endpoint
// ============================================================
let posRateLimiter;
try {
  const rateLimit = require('express-rate-limit');
  posRateLimiter = rateLimit({
    windowMs: 60 * 1000,   // 1 phút
    max: 60,               // tối đa 60 request/phút/IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Quá nhiều request. Vui lòng thử lại sau 1 phút.'
    },
    skip: (req) => {
      // Bỏ qua rate limit nếu đã có token hợp lệ (staff/admin dùng POS)
      return !!req.headers.authorization;
    }
  });
} catch {
  // express-rate-limit chưa cài → dùng middleware pass-through
  posRateLimiter = (req, res, next) => next();
  console.warn('[pharmacy] express-rate-limit chưa cài, POS endpoint không có rate limit');
}

// ============================================================
// NHÓM 1: PUBLIC — Quầy thuốc POS lấy danh sách thuốc
// ============================================================

// GET /api/pharmacy/medicines
router.get('/medicines', posRateLimiter, pharmacyController.getMedicinesForPOS);

// GET /api/pharmacy/medicines/:id
// Lấy chi tiết 1 thuốc + các lô còn hàng (dùng khi cần xem lô trước khi bán)
router.get('/medicines/:id', pharmacyController.getMedicineDetail);


// ============================================================
// NHÓM 2: BÁN THUỐC — Staff / Admin thực hiện tại quầy
// ============================================================

// POST /api/pharmacy/retail
// Tạo đơn bán lẻ (không theo đơn bác sĩ) → tự động trừ kho FEFO
router.post(
  '/retail',
  authenticateToken,
  authorize('admin', 'staff'),
  pharmacyController.createRetailOrder
);

// POST /api/pharmacy/sell-prescription
// Bán theo đơn thuốc bác sĩ (prescription_json từ MedicalRecord) → trừ kho
router.post(
  '/sell-prescription',
  authenticateToken,
  authorize('admin', 'staff'),
  pharmacyController.sellPrescription
);


// ============================================================
// NHÓM 3: QUẢN LÝ KHO — Admin / Staff quản lý kho
// ============================================================

// --- Tổng quan tồn kho ---

// GET /api/pharmacy/stock
// Danh sách tất cả thuốc với tổng tồn kho, trạng thái
router.get(
  '/stock',
  authenticateToken,
  authorize('admin', 'staff'),
  pharmacyController.getStock
);

// GET /api/pharmacy/stock/alerts
// Cảnh báo: hết hàng, sắp hết hạn (30/60 ngày), tồn thấp
router.get(
  '/stock/alerts',
  authenticateToken,
  authorize('admin', 'staff'),
  pharmacyController.getStockAlerts
);

// GET /api/pharmacy/stock/:medicineId/batches
// Lấy tất cả lô của 1 thuốc (kể cả đã hết, đã hạn)
router.get(
  '/stock/:medicineId/batches',
  authenticateToken,
  authorize('admin', 'staff'),
  pharmacyController.getBatchesByMedicine
);

// --- Nhập kho ---

// POST /api/pharmacy/stock/import
// Nhập lô thuốc mới vào kho
router.post(
  '/stock/import',
  authenticateToken,
  authorize('admin', 'staff'),
  pharmacyController.importStock
);

// --- Điều chỉnh / Kiểm kê ---

// POST /api/pharmacy/stock/adjust
// Điều chỉnh tồn kho (kiểm kê phát hiện sai lệch)
router.post(
  '/stock/adjust',
  authenticateToken,
  authorize('admin'),
  pharmacyController.adjustStock
);

// POST /api/pharmacy/stock/bulk-adjust
// Kiểm kê hàng loạt: nhận array [{medicine_id, batch_id, actual_quantity}]
router.post(
  '/stock/bulk-adjust',
  authenticateToken,
  authorize('admin'),
  pharmacyController.bulkAdjustStock
);

// POST /api/pharmacy/stock/destroy
// Hủy lô thuốc hết hạn, ghi StockTransaction type=destroy
router.post(
  '/stock/destroy',
  authenticateToken,
  authorize('admin'),
  pharmacyController.destroyBatch
);

// --- Lịch sử giao dịch ---

// GET /api/pharmacy/stock/transactions
// Lịch sử toàn bộ nhập/xuất/điều chỉnh
// Query params: medicine_id, type, from_date, to_date, page, limit
router.get(
  '/stock/transactions',
  authenticateToken,
  authorize('admin', 'staff'),
  pharmacyController.getTransactionHistory
);

// GET /api/pharmacy/stock/revenue
// Báo cáo doanh thu: theo thuốc, theo khoảng thời gian, lợi nhuận
// Query params: from_date, to_date, group_by (medicine|day|month)
router.get(
  '/stock/revenue',
  authenticateToken,
  authorize('admin', 'staff'),
  pharmacyController.getRevenueReport
);

// GET /api/pharmacy/stock/export-csv
// Xuất lịch sử giao dịch ra file CSV
// Query params: from_date, to_date, type
router.get(
  '/stock/export-csv',
  authenticateToken,
  authorize('admin', 'staff'),
  pharmacyController.exportTransactionsCSV
);

// GET /api/pharmacy/stock/export-revenue-csv
// Xuất báo cáo doanh thu ra file CSV
// Query params: from_date, to_date, group_by
router.get(
  '/stock/export-revenue-csv',
  authenticateToken,
  authorize('admin', 'staff'),
  pharmacyController.exportRevenueCSV
);


// ============================================================
// NHÓM 4: NHÀ CUNG CẤP — Admin quản lý
// ============================================================

// GET /api/pharmacy/suppliers
router.get(
  '/suppliers',
  authenticateToken,
  authorize('admin', 'staff'),
  pharmacyController.getSuppliers
);

// POST /api/pharmacy/suppliers
router.post(
  '/suppliers',
  authenticateToken,
  authorize('admin'),
  pharmacyController.createSupplier
);

// PUT /api/pharmacy/suppliers/:id
router.put(
  '/suppliers/:id',
  authenticateToken,
  authorize('admin'),
  pharmacyController.updateSupplier
);

// DELETE /api/pharmacy/suppliers/:id
router.delete(
  '/suppliers/:id',
  authenticateToken,
  authorize('admin'),
  pharmacyController.deleteSupplier
);


module.exports = router;