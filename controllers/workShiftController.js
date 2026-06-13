// server/controllers/workShiftController.js
const { models } = require('../config/db');
const { Op } = require('sequelize');

/**
 * @desc    Lấy cấu hình ca làm việc (public)
 * @route   GET /api/work-shifts/config
 * @access  Public
 */
exports.getWorkShiftConfig = async (req, res) => {
  try {
    const shifts = await models.WorkShiftConfig.findAll({
      // where: { is_active: true },
      order: [['start_time', 'ASC']],
      attributes: ['id', 'shift_name', 'display_name', 'start_time', 'end_time', 'days_of_week', 'is_active']
    });

    res.status(200).json({
      success: true,
      data: shifts
    });
  } catch (error) {
    console.error('ERROR in getWorkShiftConfig:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy cấu hình ca làm việc.'
    });
  }
};

/**
 * @desc    Cập nhật cấu hình ca làm việc (Admin only)
 * @route   PUT /api/work-shifts/config
 * @access  Private/Admin
 */
exports.updateWorkShiftConfig = async (req, res) => {
  try {
    const { shifts } = req.body;

    if (!shifts || !Array.isArray(shifts)) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu shifts không hợp lệ.'
      });
    }

    // Validate shifts data
    // Thêm 'night' vào mảng các ca hợp lệ
    const validShiftNames = ['morning', 'afternoon', 'evening', 'night'];
    for (const shift of shifts) {
      if (!validShiftNames.includes(shift.shift_name)) {
        return res.status(400).json({
          success: false,
          message: `Tên ca không hợp lệ: ${shift.shift_name}`
        });
      }

      if (!shift.start_time || !shift.end_time) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thời gian bắt đầu hoặc kết thúc.'
        });
      }
    }

    // Upsert từng shift
    const results = [];
    for (const shiftData of shifts) {
      const [shift, created] = await models.WorkShiftConfig.upsert({
        shift_name: shiftData.shift_name,
        display_name: shiftData.display_name || shiftData.shift_name,
        start_time: shiftData.start_time,
        end_time: shiftData.end_time,
        days_of_week: shiftData.days_of_week || [1, 2, 3, 4, 5, 6],
        is_active: shiftData.is_active !== undefined ? shiftData.is_active : true
      }, {
        conflictFields: ['shift_name']
      });

      results.push(shift);
    }

    // Gửi thông báo cho tất cả bác sĩ và nhân viên
    const recipients = await models.User.findAll({
      where: {
        role: ['doctor', 'staff'],
        is_active: true
      },
      attributes: ['id']
    });

    const shiftSummary = results
      .filter(s => s.is_active)
      .map(s => `${s.display_name} (${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)})`)
      .join(', ');

    await Promise.all(recipients.map(u =>
      models.Notification.create({
        user_id: u.id,
        type: 'system',
        message: `📋 Cấu hình ca làm việc vừa được cập nhật: ${shiftSummary}. Vui lòng kiểm tra lịch của bạn.`,
        link: '/lich-cua-toi',
        is_read: false
      })
    ));

    res.status(200).json({
      success: true,
      message: 'Cập nhật cấu hình ca làm việc thành công.',
      data: results
    });
  } catch (error) {
    console.error('ERROR in updateWorkShiftConfig:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật cấu hình ca làm việc.'
    });
  }
};

/**
 * @desc    Lấy danh sách slots còn trống cho bác sĩ trong ngày
 * @route   GET /api/work-shifts/available-slots
 * @query   doctor_id, date, service_id, appointment_type
 * @access  Public
 */
exports.getAvailableSlots = async (req, res) => {
  try {
    const { doctor_id, service_id, date, appointment_type = 'offline' } = req.query;

    if (!doctor_id || !service_id || !date) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin doctor_id, service_id hoặc date'
      });
    }

    // Import chéo hàm helper đã xây dựng hoàn chỉnh ở bên appointmentController
    // Nhằm đảm bảo duy trì duy nhất 1 logic Sức chứa (Offline) và Khóa giờ (Online) cho toàn hệ thống
    const appointmentController = require('./appointmentController');
    
    // Gọi Public API (đã được bọc lại trong appt controller) bằng cách redirect 
    // hoặc xử lý bằng cách tái sử dụng logic nội bộ.
    // (Lưu ý: Nếu bạn gặp lỗi vòng lặp import, bạn có thể copy đoạn ruột API getAvailableSlots từ appointmentController sang đây)

    // Cách an toàn nhất: Call method đã export bên file appointmentController.
    return appointmentController.getAvailableSlots(req, res);

  } catch (error) {
    console.error('ERROR in getAvailableSlots:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi máy chủ khi lấy khung giờ.'
    });
  }
};

// ================================================================
// CA THU NGÂN (CASHIER SHIFT) — MỞ CA / ĐÓNG CA / QUẢN LÝ
// ================================================================

/**
 * Kiểm tra ca hiện tại của nhân viên đang đăng nhập
 * GET /api/work-shifts/cashier/current
 */
exports.getCurrentCashierShift = async (req, res) => {
  try {
    const userId = req.user.id;

    const staff = await models.Staff.findOne({ where: { user_id: userId } });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ nhân viên.' });
    }

    const shift = await models.CashierShift.findOne({
      where: { staff_id: staff.id, status: 'open' },
      include: [
        { model: models.WorkShiftConfig, as: 'shiftConfig' },
        { model: models.User, as: 'cashier', attributes: ['full_name', 'username'] }
      ],
      order: [['started_at', 'DESC']]
    });

    // Nếu đang có ca mở → tính doanh thu thực tế trong ca
    if (shift) {
      const payments = await models.Payment.findAll({
        where: {
          status: 'paid',
          created_at: { [Op.gte]: shift.started_at }
        },
        attributes: ['method', 'amount']
      });

      const revenueCash = payments
        .filter(p => p.method === 'cash')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const revenueTransfer = payments
        .filter(p => p.method !== 'cash')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      return res.json({
        success: true,
        data: {
          ...shift.toJSON(),
          live_revenue_cash: revenueCash,
          live_revenue_transfer: revenueTransfer,
          live_transactions: payments.length,
          system_expected_cash: parseFloat(shift.opening_cash) + revenueCash
        }
      });
    }

    res.json({ success: true, data: null, message: 'Chưa có ca nào đang mở.' });
  } catch (error) {
    console.error('ERROR getCurrentCashierShift:', error);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

/**
 * Mở ca làm việc
 * POST /api/work-shifts/cashier/start
 * Body: { opening_cash, opening_note, shift_config_id? }
 */
exports.startCashierShift = async (req, res) => {
  try {
    const userId = req.user.id;
    const { opening_cash, opening_note, shift_config_id } = req.body;

    if (opening_cash === undefined || opening_cash === null) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập số tiền đầu ca.' });
    }

    // Tìm Staff record
    const staff = await models.Staff.findOne({
      where: { user_id: userId },
      include: [{ model: models.User, attributes: ['full_name'] }]
    });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ nhân viên.' });
    }

    // Kiểm tra đã có ca mở chưa
    const existingShift = await models.CashierShift.findOne({
      where: { staff_id: staff.id, status: 'open' }
    });
    if (existingShift) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đang có ca chưa đóng. Vui lòng đóng ca hiện tại trước.',
        data: existingShift
      });
    }

    // Kiểm tra lịch phân công (nếu có shift_config_id)
    let shiftConfig = null;
    if (shift_config_id) {
      shiftConfig = await models.WorkShiftConfig.findByPk(shift_config_id);
      if (!shiftConfig) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy ca làm việc.' });
      }
    } else {
      // Tự động tìm ca phù hợp theo giờ hiện tại
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00`;
      const allShifts = await models.WorkShiftConfig.findAll({ where: { is_active: true } });
      shiftConfig = allShifts.find(s => s.start_time <= currentTime && s.end_time >= currentTime) || null;
    }

    const today = new Date().toISOString().split('T')[0];

    const newShift = await models.CashierShift.create({
      staff_id: staff.id,
      user_id: userId,
      shift_config_id: shiftConfig?.id || null,
      shift_date: today,
      started_at: new Date(),
      opening_cash: parseFloat(opening_cash),
      opening_note: opening_note || null,
      status: 'open'
    });

    // Log audit
    await models.AuditLog.create({
      user_id: userId,
      action_type: 'shift_start',
      target_type: 'cashier_shift',
      target_id: newShift.id,
      target_name: staff.User?.full_name || `Staff ${staff.code}`,
      details: JSON.stringify({
        opening_cash: opening_cash,
        shift_config: shiftConfig?.display_name || 'Tự động',
        shift_date: today
      })
    });

    res.status(201).json({
      success: true,
      message: `Mở ca thành công! Ca ${shiftConfig?.display_name || 'làm việc'} đã bắt đầu.`,
      data: { ...newShift.toJSON(), shiftConfig }
    });
  } catch (error) {
    console.error('ERROR startCashierShift:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi mở ca: ' + error.message });
  }
};

/**
 * Đóng ca làm việc
 * POST /api/work-shifts/cashier/end
 * Body: { closing_cash_actual, closing_note }
 */
exports.endCashierShift = async (req, res) => {
  try {
    const userId = req.user.id;
    const { closing_cash_actual, closing_note } = req.body;

    if (closing_cash_actual === undefined || closing_cash_actual === null) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập số tiền kiểm đếm cuối ca.' });
    }

    const staff = await models.Staff.findOne({
      where: { user_id: userId },
      include: [{ model: models.User, attributes: ['full_name'] }]
    });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ nhân viên.' });
    }

    const shift = await models.CashierShift.findOne({
      where: { staff_id: staff.id, status: 'open' },
      order: [['started_at', 'DESC']]
    });
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ca đang mở.' });
    }

    // Tính doanh thu thực tế trong ca
    const payments = await models.Payment.findAll({
      where: {
        status: 'paid',
        created_at: { [Op.gte]: shift.started_at }
      },
      attributes: ['method', 'amount']
    });

    const revenueCash = payments
      .filter(p => p.method === 'cash')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const revenueTransfer = payments
      .filter(p => p.method !== 'cash')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const systemExpectedCash = parseFloat(shift.opening_cash) + revenueCash;
    const actualCash = parseFloat(closing_cash_actual);
    const difference = actualCash - systemExpectedCash;

    // Cập nhật ca
    await shift.update({
      ended_at: new Date(),
      closing_cash_actual: actualCash,
      closing_cash_system: systemExpectedCash,
      cash_difference: difference,
      total_transactions: payments.length,
      total_revenue_cash: revenueCash,
      total_revenue_transfer: revenueTransfer,
      closing_note: closing_note || null,
      status: Math.abs(difference) > 50000 ? 'pending_review' : 'closed'
    });

    // Log audit
    await models.AuditLog.create({
      user_id: userId,
      action_type: 'shift_end',
      target_type: 'cashier_shift',
      target_id: shift.id,
      target_name: staff.User?.full_name || `Staff ${staff.code}`,
      details: JSON.stringify({
        opening_cash: shift.opening_cash,
        closing_cash_actual: actualCash,
        closing_cash_system: systemExpectedCash,
        difference: difference,
        total_revenue_cash: revenueCash,
        total_revenue_transfer: revenueTransfer,
        total_transactions: payments.length
      })
    });

    res.json({
      success: true,
      message: Math.abs(difference) > 50000
        ? `Đóng ca thành công. ⚠️ Chênh lệch ${Math.abs(difference).toLocaleString('vi-VN')}đ — chờ Admin xét duyệt.`
        : 'Đóng ca thành công!',
      data: {
        shift: await models.CashierShift.findByPk(shift.id),
        summary: {
          opening_cash: shift.opening_cash,
          revenue_cash: revenueCash,
          revenue_transfer: revenueTransfer,
          system_expected: systemExpectedCash,
          actual_counted: actualCash,
          difference: difference,
          total_transactions: payments.length
        }
      }
    });
  } catch (error) {
    console.error('ERROR endCashierShift:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi đóng ca.' });
  }
};

/**
 * Lấy lịch sử ca của nhân viên đang đăng nhập
 * GET /api/work-shifts/cashier/history
 */
exports.getMyCashierShiftHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const staff = await models.Staff.findOne({ where: { user_id: userId } });
    if (!staff) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ nhân viên.' });

    const { rows, count } = await models.CashierShift.findAndCountAll({
      where: { staff_id: staff.id },
      include: [{ model: models.WorkShiftConfig, as: 'shiftConfig' }],
      order: [['started_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({ success: true, data: rows, total: count });
  } catch (error) {
    console.error('ERROR getMyCashierShiftHistory:', error);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

/**
 * [ADMIN] Lấy tất cả ca làm việc — để quản lý, xét duyệt
 * GET /api/work-shifts/cashier/all
 */
exports.getAllCashierShifts = async (req, res) => {
  try {
    const { date, status, staff_id, limit = 30, offset = 0 } = req.query;
    const where = {};
    if (date) where.shift_date = date;
    if (status) where.status = status;
    if (staff_id) where.staff_id = staff_id;

    const { rows, count } = await models.CashierShift.findAndCountAll({
      where,
      include: [
        {
          model: models.Staff,
          as: 'staff',
          include: [{ model: models.User, attributes: ['full_name', 'avatar_url'] }]
        },
        { model: models.WorkShiftConfig, as: 'shiftConfig' },
        { model: models.User, as: 'reviewer', attributes: ['full_name'] }
      ],
      order: [['started_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Tổng hợp thống kê ngày
    const todayStr = new Date().toISOString().split('T')[0];
    const todayShifts = await models.CashierShift.findAll({
      where: { shift_date: date || todayStr }
    });

    const stats = {
      total_revenue_cash: todayShifts.reduce((s, sh) => s + parseFloat(sh.total_revenue_cash || 0), 0),
      total_revenue_transfer: todayShifts.reduce((s, sh) => s + parseFloat(sh.total_revenue_transfer || 0), 0),
      total_transactions: todayShifts.reduce((s, sh) => s + (sh.total_transactions || 0), 0),
      open_shifts: todayShifts.filter(sh => sh.status === 'open').length,
      pending_review: todayShifts.filter(sh => sh.status === 'pending_review').length
    };

    res.json({ success: true, data: rows, total: count, stats });
  } catch (error) {
    console.error('ERROR getAllCashierShifts:', error);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

/**
 * [ADMIN] Xét duyệt ca chênh lệch
 * PUT /api/work-shifts/cashier/:id/review
 * Body: { action: 'approve'|'reject', review_note }
 */
exports.reviewCashierShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, review_note } = req.body;
    const adminId = req.user.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action phải là approve hoặc reject.' });
    }

    const shift = await models.CashierShift.findByPk(id, {
      include: [{ model: models.Staff, as: 'staff', include: [{ model: models.User, attributes: ['full_name'] }] }]
    });
    if (!shift) return res.status(404).json({ success: false, message: 'Không tìm thấy ca làm việc.' });
    if (shift.status !== 'pending_review') {
      return res.status(400).json({ success: false, message: 'Ca này không ở trạng thái chờ xét duyệt.' });
    }

    await shift.update({
      status: action === 'approve' ? 'closed' : 'pending_review',
      reviewed_by: adminId,
      reviewed_at: new Date(),
      review_note: review_note || null
    });

    // Gửi thông báo cho nhân viên
    await models.Notification.create({
      user_id: shift.staff?.User?.id || shift.user_id,
      type: 'shift_review',
      message: action === 'approve'
        ? `Ca làm việc ngày ${shift.shift_date} đã được Admin xác nhận.`
        : `Ca làm việc ngày ${shift.shift_date} cần giải trình. Lý do: ${review_note}`,
      link: '/quay-tiep-don',
      is_read: false
    });

    res.json({
      success: true,
      message: action === 'approve' ? 'Đã xác nhận ca làm việc.' : 'Đã gửi yêu cầu giải trình.',
      data: shift
    });
  } catch (error) {
    console.error('ERROR reviewCashierShift:', error);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};