// server/routes/corporateBookingRoutes.js
// Routes cho corporate booking

const express = require('express');
const corporateBookingController = require('../controllers/corporateBookingController');
const { authenticateToken, allowAdminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

console.log('[ROUTES] 🟢 Khởi tạo corporateBookingRoutes');
console.log('[ROUTES] DEBUG - corporateBookingController:', typeof corporateBookingController);
console.log('[ROUTES] DEBUG - authenticateToken:', typeof authenticateToken);
console.log('[ROUTES] DEBUG - allowAdminOnly:', typeof allowAdminOnly);

/**
 * [ADMIN] Tạo corporate window
 * POST /api/corporate/windows
 */
router.post('/windows', 
  authenticateToken, 
  allowAdminOnly, 
  async (req, res) => {
    console.log('[ROUTE] POST /corporate/windows');
    try {
      await corporateBookingController.createCorporateWindow(req, res);
    } catch (error) {
      console.error('[ROUTE] Error createCorporateWindow:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

/**
 * [PUBLIC] Xem window (công khai cho nhân viên)
 * GET /api/corporate/windows/:windowCode
 */
router.get('/windows/:windowCode', async (req, res) => {
  console.log(`[ROUTE] GET /corporate/windows/${req.params.windowCode}`);
  try {
    await corporateBookingController.getCorporateWindow(req, res);
  } catch (error) {
    console.error('[ROUTE] Error getCorporateWindow:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * [ADMIN] Danh sách windows
 * GET /api/corporate/windows
 */
router.get('/windows', 
  authenticateToken, 
  allowAdminOnly, 
  async (req, res) => {
    console.log('[ROUTE] GET /corporate/windows (list all)');
    try {
      await corporateBookingController.listCorporateWindows(req, res);
    } catch (error) {
      console.error('[ROUTE] Error listCorporateWindows:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

/**
 * [EMPLOYEE/PUBLIC] Đăng ký vào window
 * POST /api/corporate/windows/:windowCode/register
 */
router.post('/windows/:windowCode/register', async (req, res) => {
  console.log(`[ROUTE] POST /corporate/windows/${req.params.windowCode}/register`);
  try {
    await corporateBookingController.registerToCorporateWindow(req, res);
  } catch (error) {
    console.error('[ROUTE] Error registerToCorporateWindow:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * [ADMIN] Đóng window
 * PUT /api/corporate/windows/:windowCode/close
 */
router.put('/windows/:windowCode/close', 
  authenticateToken, 
  allowAdminOnly, 
  async (req, res) => {
    console.log(`[ROUTE] PUT /corporate/windows/${req.params.windowCode}/close`);
    try {
      await corporateBookingController.closeCorporateWindow(req, res);
    } catch (error) {
      console.error('[ROUTE] Error closeCorporateWindow:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

/**
 * [DEBUG] Export/import windows
 * GET /api/corporate/debug/export
 */
router.get('/debug/export', 
  authenticateToken, 
  allowAdminOnly, 
  async (req, res) => {
    console.log('[ROUTE] GET /corporate/debug/export');
    try {
      await corporateBookingController.debugExportWindows(req, res);
    } catch (error) {
      console.error('[ROUTE] Error debugExportWindows:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

console.log('[ROUTES] ✅ corporateBookingRoutes đã được đăng ký');

module.exports = router;
