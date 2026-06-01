// server/controllers/corporateBookingController.js
// Xử lý corporate booking windows

const corporateWindowManager = require('../utils/corporateWindowManager');

/**
 * [ADMIN/MANAGER] Tạo corporate booking window
 * POST /api/corporate/windows
 */
exports.createCorporateWindow = async (req, res) => {
  try {
    console.log('[API] POST /corporate/windows - Tạo window', { body: req.body });
    
    const { corp_code, company_name, service_id, start_date, end_date, time_slots, max_participants } = req.body;

    if (!company_name || !service_id || !start_date || !end_date) {
      console.log('[API] ⚠️ Thiếu field bắt buộc');
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc (company_name, service_id, start_date, end_date)' });
    }

    // Kiểm tra service tồn tại & là dịch vụ corporate
    const Service = req.app.get('models').Service;
    const service = await Service.findByPk(service_id);
    if (!service) {
      console.log(`[API] ❌ Service ${service_id} không tồn tại`);
      return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });
    }

    if (!service.is_corp) {
      console.log(`[API] ⚠️ Service ${service_id} không phải dịch vụ corporate`);
      return res.status(400).json({ success: false, message: 'Dịch vụ này không được cấu hình cho corporate booking' });
    }

    const windowData = {
      corp_code: corp_code || `CORP-${Date.now().toString(36).toUpperCase()}`,
      company_name,
      service_id,
      start_date,
      end_date,
      time_slots: time_slots || ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
      max_participants: max_participants || 50
    };

    const window = corporateWindowManager.createWindow(windowData);
    console.log('[API] ✅ Tạo window thành công:', window.window_id);

    res.status(201).json({
      success: true,
      message: 'Tạo corporate window thành công',
      data: window
    });
  } catch (error) {
    console.error('[API] ❌ createCorporateWindow error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * [PUBLIC] Lấy thông tin corporate window (nhân viên xem)
 * GET /api/corporate/windows/:windowCode
 */
exports.getCorporateWindow = async (req, res) => {
  try {
    const { windowCode } = req.params;
    console.log('[API] GET /corporate/windows/:windowCode -', { windowCode });

    const window = corporateWindowManager.getWindow(windowCode);
    if (!window) {
      console.log(`[API] ⚠️ Window ${windowCode} không tìm thấy`);
      return res.status(404).json({ success: false, message: 'Không tìm thấy corporate window' });
    }

    // Lấy thông tin dịch vụ
    const Service = req.app.get('models').Service;
    const service = await Service.findByPk(window.service_id);

    console.log('[API] ✅ Trả về window:', window.window_id);
    res.json({
      success: true,
      data: {
        ...window,
        service_info: service ? { id: service.id, name: service.name, price: service.price, duration: service.duration } : null,
        available_slots: window.max_participants - window.registered_count
      }
    });
  } catch (error) {
    console.error('[API] ❌ getCorporateWindow error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * [ADMIN] Danh sách corporate windows
 * GET /api/corporate/windows?status=active&service_id=1
 */
exports.listCorporateWindows = async (req, res) => {
  try {
    const { status, service_id, corp_code } = req.query;
    console.log('[API] GET /corporate/windows - list', { status, service_id, corp_code });

    const filter = {};
    if (status) filter.status = status;
    if (service_id) filter.service_id = parseInt(service_id);
    if (corp_code) filter.corp_code = corp_code;

    const windows = corporateWindowManager.listWindows(filter);
    console.log('[API] ✅ Danh sách windows:', windows.length);

    res.json({
      success: true,
      data: windows,
      total: windows.length
    });
  } catch (error) {
    console.error('[API] ❌ listCorporateWindows error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * [EMPLOYEE] Đăng ký vào corporate window
 * POST /api/corporate/windows/:windowCode/register
 * Body: { name, email, phone, date, time }
 */
exports.registerToCorporateWindow = async (req, res) => {
  try {
    const { windowCode } = req.params;
    const { name, email, phone, date, time } = req.body;

    console.log('[API] POST /corporate/windows/:windowCode/register', { windowCode, email, date, time });

    if (!name || !email || !phone || !date || !time) {
      console.log('[API] ⚠️ Thiếu thông tin');
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }

    // Lấy window
    const window = corporateWindowManager.getWindow(windowCode);
    if (!window) {
      console.log(`[API] ❌ Window ${windowCode} không tồn tại`);
      return res.status(404).json({ success: false, message: 'Corporate window không tồn tại' });
    }

    // Kiểm tra slot
    if (!corporateWindowManager.hasAvailableSlot(windowCode)) {
      console.log(`[API] ❌ Window ${windowCode} hết slot`);
      return res.status(400).json({ success: false, message: 'Corporate window đã hết chỗ' });
    }

    // Kiểm tra ngày/giờ có nằm trong window không
    const reqDate = new Date(date);
    const windowStart = new Date(window.start_date);
    const windowEnd = new Date(window.end_date);
    if (reqDate < windowStart || reqDate > windowEnd) {
      console.log(`[API] ⚠️ Ngày ${date} không nằm trong window (${window.start_date} - ${window.end_date})`);
      return res.status(400).json({ success: false, message: 'Ngày yêu cầu nằm ngoài khoảng thời gian window' });
    }

    // Kiểm tra giờ có trong time_slots
    if (!window.time_slots.includes(time)) {
      console.log(`[API] ⚠️ Giờ ${time} không hợp lệ. Các giờ hợp lệ: ${window.time_slots.join(', ')}`);
      return res.status(400).json({ success: false, message: `Giờ không hợp lệ. Các giờ có sẵn: ${window.time_slots.join(', ')}` });
    }

    // Đăng ký
    const participantInfo = {
      name,
      email,
      phone,
      date,
      time,
      appointment_code: null // Sẽ được set khi tạo appointment thật
    };

    corporateWindowManager.registerParticipant(windowCode, participantInfo);
    console.log(`[API] ✅ Đăng ký nhân viên ${email} vào window`);

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công. Vui lòng tiến hành xác nhận và thanh toán.',
      data: {
        window_id: window.window_id,
        corp_code: window.corp_code,
        registered_participant: participantInfo,
        next_step: 'confirm_appointment'
      }
    });
  } catch (error) {
    console.error('[API] ❌ registerToCorporateWindow error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * [ADMIN] Đóng corporate window
 * PUT /api/corporate/windows/:windowCode/close
 */
exports.closeCorporateWindow = async (req, res) => {
  try {
    const { windowCode } = req.params;
    const { reason } = req.body;

    console.log('[API] PUT /corporate/windows/:windowCode/close', { windowCode, reason });

    const window = corporateWindowManager.getWindow(windowCode);
    if (!window) {
      console.log(`[API] ❌ Window ${windowCode} không tồn tại`);
      return res.status(404).json({ success: false, message: 'Window không tồn tại' });
    }

    const updated = corporateWindowManager.closeWindow(windowCode, reason || 'admin_close');
    console.log(`[API] ✅ Đóng window ${windowCode}`);

    res.json({
      success: true,
      message: 'Window đã được đóng',
      data: updated
    });
  } catch (error) {
    console.error('[API] ❌ closeCorporateWindow error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * [DEBUG] Export tất cả windows (chỉ dùng cho test/debug)
 * GET /api/corporate/debug/export
 */
exports.debugExportWindows = async (req, res) => {
  try {
    console.log('[API-DEBUG] GET /corporate/debug/export');
    const data = corporateWindowManager.exportToJSON();
    console.log(`[API-DEBUG] Export ${data.length} windows`);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[API-DEBUG] Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
