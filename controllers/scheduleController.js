// server/controllers/scheduleController.js
// SỬA LỖI: Cập nhật hàm getSchedules để hỗ trợ Lịch Tuần (lọc theo date_from, date_to)

const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment');
const ExcelJS = require('exceljs');

// ============================================
// === HELPER MỚI: TẠO THÔNG BÁO ===
// ============================================
const createNotification = async (data) => {
  try {
    if (!data.user_id || !data.message) {
      console.warn('Bỏ qua thông báo: Thiếu user_id hoặc message.');
      return;
    }
    
    // 1. Tạo trong DB
    const notification = await models.Notification.create({
      user_id: data.user_id,
      type: data.type || 'schedule', // Sửa: Dùng 'schedule'
      message: data.message,
      link: data.link || '/lich-cua-toi',
      is_read: false
    }, { transaction: data.transaction || null });
    
    // 2. (MỚI) Gửi real-time WS
    if (global.wsSendToUser) {
      global.wsSendToUser(data.user_id, {
        type: 'new_notification',
        payload: {
          id: notification.id,
          message: data.message,
          link: data.link
        }
      });
    }

  } catch (error) {
    console.error(`Lỗi khi tạo thông báo cho user ${data.user_id}:`, error.message);
  }
};

// Thay thế hàm này
const notifyAllAdmins = async (data) => {
  try {
    const admins = await models.User.findAll({ 
      where: { role: 'admin' }, 
      attributes: ['id'],
      transaction: data.transaction || null
    });
    
    for (const admin of admins) {
      // (SỬA) Chỉ cần gọi createNotification (nó đã bao gồm WS)
      await createNotification({
        ...data,
        user_id: admin.id
      });
    }
  } catch (error) {
     console.error(`Lỗi khi gửi thông báo hàng loạt cho Admin:`, error.message);
  }
};

// (MỚI) Gửi thông báo cho trưởng phòng và admin
const notifyDepartmentManagersAndAdmins = async (data) => {
  try {
    const { user_type, user_id, transaction } = data;
    
    // 1. Gửi cho Admin (luôn luôn)
    const admins = await models.User.findAll({ 
      where: { role: 'admin', is_active: true }, 
      attributes: ['id'],
      transaction
    });
    
    for (const admin of admins) {
      await createNotification({
        ...data,
        user_id: admin.id
      });
    }
    
    // 2. Gửi cho trưởng phòng tương ứng
    let departmentManagers = [];
    
    if (user_type === 'doctor') {
      // Bác sĩ -> gửi cho trưởng phòng Clinical
      departmentManagers = await models.User.findAll({
        include: [{
          model: models.Staff,
          where: { department: 'clinical', rank: 'manager' },
          required: true
        }],
        where: { role: 'staff', is_active: true },
        attributes: ['id'],
        transaction
      });
    } else if (user_type === 'staff') {
      // Nhân viên -> tìm department của họ và gửi cho trưởng phòng đó
      const staff = await models.Staff.findOne({
        where: { user_id: user_id },
        attributes: ['department'],
        transaction
      });
      
      if (staff && staff.department) {
        departmentManagers = await models.User.findAll({
          include: [{
            model: models.Staff,
            where: { department: staff.department, rank: 'manager' },
            required: true
          }],
          where: { role: 'staff', is_active: true },
          attributes: ['id'],
          transaction
        });
      }
    }
    
    // Gửi thông báo cho các trưởng phòng
    for (const manager of departmentManagers) {
      await createNotification({
        ...data,
        user_id: manager.id
      });
    }
    
  } catch (error) {
     console.error(`Lỗi khi gửi thông báo cho trưởng phòng và admin:`, error.message);
  }
};

// ============================================
// 1. TẠO 1 LỊCH CỐ ĐỊNH ĐƠN GIẢN (ADMIN)
// (Hàm createSingleFixedSchedule giữ nguyên)
//
// ============================================
exports.createSingleFixedSchedule = async (req, res) => {
  try {
    const { user_id, date, start_time, end_time } = req.body;

    if (!user_id || !date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin user_id, date, start_time hoặc end_time'
      });
    }

    const user = await models.User.findByPk(user_id);
    if (!user || (user.role !== 'doctor' && user.role !== 'staff')) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhân viên hoặc bác sĩ'
      });
    }

    const user_type = user.role;
    const doctor = user.role === 'doctor' ? await models.Doctor.findOne({ where: { user_id: user.id } }) : null;

    // Kiểm tra trùng lịch
    const existingSchedule = await models.Schedule.findOne({
      where: {
        user_id,
        date,
        [Op.or]: [
          { start_time: { [Op.lt]: end_time }, end_time: { [Op.gt]: start_time } }
        ]
      }
    });

    if (existingSchedule) {
      return res.status(400).json({
        success: false,
        message: 'Đã có lịch trùng trong khoảng thời gian này',
        conflict: existingSchedule
      });
    }

    // Tạo lịch mới
    const newSchedule = await models.Schedule.create({
      user_id,
      doctor_id: doctor?.id || null,
      user_type,
      schedule_type: 'fixed',
      date,
      start_time,
      end_time,
      status: 'available', // Lịch cố định admin tạo là 'available' luôn
      approved_by: req.user.id,
      approved_at: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Tạo lịch làm việc thành công',
      schedule: newSchedule
    });

  } catch (error) {
    console.error('ERROR in createSingleFixedSchedule:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo lịch làm việc',
      error: error.message
    });
  }
};

// ============================================
// 2. TẠO LỊCH CỐ ĐỊNH HÀNG LOẠT (ADMIN)
// (Hàm createFixedSchedule giữ nguyên)
//
// ============================================
exports.createFixedSchedule = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { user_ids, week_data } = req.body;
    // ... (logic của bạn) ...
    
    // Tạm thời rollback và trả về thông báo
    await transaction.rollback();
    res.status(501).json({ success: false, message: "Chức năng tạo hàng loạt chưa được triển khai đầy đủ" });

  } catch (error) {
    await transaction.rollback();
    console.error('ERROR in createFixedSchedule (batch):', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo lịch cố định hàng loạt',
      error: error.message
    });
  }
};


// ============================================
// 3. LẤY LỊCH CÔNG KHAI (CHO BỆNH NHÂN ĐẶT LỊCH)
// (Hàm getPublicSchedules giữ nguyên)
//
// ============================================
exports.getPublicSchedules = async (req, res) => {
  try {
    const { user_id, date, date_from, date_to } = req.query;
    
    const where = {
      schedule_type: 'fixed', // Chỉ lấy lịch cố định
      status: 'available' // Chỉ lấy lịch còn trống
    };

    if (user_id) where.user_id = user_id;
    if (date) where.date = date; 
    else {
      const today = new Date().toISOString().split('T')[0];
      where.date = { [Op.gte]: date_from || today };
      if (date_to) where.date[Op.lte] = date_to;
    }

    const schedules = await models.Schedule.findAll({
      where,
      include: [
        {
          model: models.User,
          as: 'user',
          attributes: ['id', 'full_name', 'avatar_url', 'role']
        },
        {
          model: models.Doctor,
          as: 'doctor',
          include: [{ model: models.Specialty, attributes: ['id', 'name'] }],
          required: false
        }
      ],
      order: [['date', 'ASC'], ['start_time', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });

  } catch (error) {
    console.error('ERROR in getPublicSchedules:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch công khai',
      error: error.message
    });
  }
};

// ============================================
// 4. LẤY DANH SÁCH LỊCH LÀM VIỆC (CÓ PHÂN QUYỀN)
// (Hàm này được SỬA)
//
// ============================================
exports.getSchedules = async (req, res) => {
  try {
    // SỬA: Thêm date_from và date_to
    const { user_id, month, year, date_from, date_to, schedule_type, status } = req.query;

    let whereClause = {};

    // Phân quyền (SỬA ĐỔI: Cho phép Staff xem lịch bác sĩ)
    if (req.user.role === 'admin') {
      if (user_id) whereClause.user_id = user_id;
    } else if (req.user.role === 'staff') {
      if (user_id) {
        // Nếu staff chỉ định xem lịch của bác sĩ cụ thể
        // → Kiểm tra xem bác sĩ đó có trong managed_doctors không
        const staffProfile = await models.Staff.findOne({ where: { user_id: req.user.id } });
        const isManagedDoctor = staffProfile?.canManageDoctor
          ? staffProfile.canManageDoctor(user_id)
          : true; // fallback: nếu không có instance method thì cho qua
        
        if (!isManagedDoctor && req.user.id !== parseInt(user_id)) {
          return res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch của nhân sự này.' });
        }
        whereClause.user_id = user_id;
      } else {
        whereClause.user_id = req.user.id;
      }
    } else {
      // Doctor/Patient chỉ xem của mình
      whereClause.user_id = req.user.id; 
    }

    
    // SỬA: Ưu tiên lọc theo date_from/date_to (cho Lịch Tuần/Bảng)
    if (date_from && date_to) {
      whereClause.date = { [Op.between]: [date_from, date_to] };
    } 
    // Giữ lại logic month/year (cho Lịch Tháng)
    else if (month && year) {
      const startDate = moment(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
      const endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');
      whereClause.date = { [Op.between]: [startDate, endDate] };
    }

    if (schedule_type) whereClause.schedule_type = schedule_type;
    if (status) whereClause.status = status;
    
    // CHỈ LẤY LỊCH CỐ ĐỊNH (fixed)
    whereClause.schedule_type = 'fixed'; 

    const result = await models.Schedule.findAndCountAll({
      where: whereClause,
      include: [
        { model: models.User, as: 'user', attributes: ['id', 'full_name', 'email', 'role'] },
        { model: models.Doctor, as: 'doctor' }
      ],
      order: [['date', 'ASC'], ['start_time', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: result.rows,
      count: result.count
    });

  } catch (error) {
    console.error('ERROR in getSchedules:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách lịch làm việc',
      error: error.message
    });
  }
};

// ============================================
// 5. KIỂM TRA TRÙNG LỊCH (ADMIN)
// (Hàm checkScheduleConflict giữ nguyên)
//
// ============================================
exports.checkScheduleConflict = async (req, res) => {
  try {
    const { user_id, date, shift } = req.query;
    if (!user_id || !date || !shift) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
    }

    const SHIFT_TIMES = {
      morning: { start: '07:00:00', end: '12:00:00' },
      afternoon: { start: '13:00:00', end: '17:00:00' },
      evening: { start: '17:00:00', end: '21:00:00' }
    };
    const shiftTime = SHIFT_TIMES[shift];
    if (!shiftTime) {
      return res.status(400).json({ success: false, message: 'Ca không hợp lệ' });
    }

    const existingSchedule = await models.Schedule.findOne({
      where: {
        user_id,
        date,
        [Op.or]: [
          { start_time: { [Op.lt]: shiftTime.end }, end_time: { [Op.gt]: shiftTime.start } }
        ]
      }
    });

    res.json({
      success: true,
      hasConflict: !!existingSchedule,
      conflict: existingSchedule
    });

  } catch (error) {
    console.error('ERROR in checkScheduleConflict:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi kiểm tra trùng lịch',
      error: error.message
    });
  }
};

// ============================================
// 6. CẬP NHẬT LỊCH (ADMIN/OWNER)
// (Hàm updateSchedule giữ nguyên)
//
// ============================================
exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_time, end_time, status } = req.body;

    const schedule = await models.Schedule.findByPk(id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch' });
    }

    // Chỉ Admin mới được sửa
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa lịch này' });
    }
    
    // Chỉ cho phép sửa lịch 'fixed'
    if (schedule.schedule_type !== 'fixed') {
        return res.status(400).json({ success: false, message: 'Không thể sửa lịch không phải là lịch cố định' });
    }

    const updateData = {};
    if (start_time) updateData.start_time = start_time;
    if (end_time) updateData.end_time = end_time;
    if (status) updateData.status = status;

    await schedule.update(updateData);

    res.json({
      success: true,
      message: 'Cập nhật lịch thành công',
      schedule
    });

  } catch (error) {
    console.error('ERROR in updateSchedule:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật lịch',
      error: error.message
    });
  }
};

// ============================================
// 7. XÓA LỊCH (ADMIN/OWNER)
// (Hàm deleteSchedule giữ nguyên)
//
// ============================================
exports.deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await models.Schedule.findByPk(id);

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch' });
    }

    // Kiểm tra quyền (Admin hoặc chủ sở hữu)
    if (req.user.role !== 'admin' && schedule.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa lịch này' });
    }

    // Kiểm tra có appointment không
    const appointmentCount = await models.Appointment.count({
      where: {
        schedule_id: id,
        status: { [Op.in]: ['pending', 'confirmed'] }
      }
    });

    if (appointmentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa vì đã có ${appointmentCount} lịch hẹn liên quan`
      });
    }

    await schedule.destroy();

    res.json({
      success: true,
      message: 'Xóa lịch thành công'
    });

  } catch (error) {
    console.error('ERROR in deleteSchedule:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa lịch',
      error: error.message
    });
  }
};

// ============================================
// 8. THỐNG KÊ GIỜ LÀM VIỆC CÁ NHÂN
// (Hàm getWorkHoursStats giữ nguyên)
//
// ============================================
exports.getWorkHoursStats = async (req, res) => {
  try {
    const { user_id, month, year } = req.query;
    // Admin có thể xem của người khác, user thường chỉ xem của mình
    const targetUserId = (req.user.role === 'admin' && user_id) ? user_id : req.user.id;

    const where = {
      user_id: targetUserId,
      status: { [Op.in]: ['available', 'booked', 'approved'] },
      schedule_type: 'fixed' // Chỉ tính giờ làm cố định
    };

    if (month && year) {
      const startDate = moment(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
      const endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');
      where.date = { [Op.between]: [startDate, endDate] };
    }

    const schedules = await models.Schedule.findAll({ where });

    let totalHours = 0;
    schedules.forEach(schedule => {
      const start = moment(schedule.start_time, 'HH:mm:ss');
      const end = moment(schedule.end_time, 'HH:mm:ss');
      const hours = end.diff(start, 'hours', true);
      totalHours += hours;
    });

    res.json({
      success: true,
      stats: {
        totalHours: Math.round(totalHours * 10) / 10,
        totalDays: schedules.length
      }
    });

  } catch (error) {
    console.error('ERROR in getWorkHoursStats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê giờ làm việc',
      error: error.message
    });
  }
};

// ============================================
// 9. XUẤT BÁO CÁO EXCEL
// (Hàm exportSchedules giữ nguyên)
//
// ============================================
exports.exportSchedules = async (req, res) => {
  try {
    const { user_id, month, year } = req.query;
    const where = {};

    if (req.user.role !== 'admin') {
      where.user_id = req.user.id;
    } else if (user_id) {
      where.user_id = user_id;
    }

    if (month && year) {
      const startDate = moment(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
      const endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');
      where.date = { [Op.between]: [startDate, endDate] };
    }

    const schedules = await models.Schedule.findAll({
      where,
      include: [
        { model: models.User, as: 'user', attributes: ['id', 'full_name', 'email', 'role'] },
        { model: models.Doctor, as: 'doctor', include: [{ model: models.Specialty, attributes: ['name'] }], required: false }
      ],
      order: [['date', 'ASC'], ['start_time', 'ASC']]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lịch làm việc');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'Họ tên', key: 'full_name', width: 25 },
      { header: 'Vai trò', key: 'role', width: 12 },
      { header: 'Chuyên khoa', key: 'specialty', width: 20 },
      { header: 'Ngày', key: 'date', width: 12 },
      { header: 'Giờ bắt đầu', key: 'start_time', width: 12 },
      { header: 'Giờ kết thúc', key: 'end_time', width: 12 },
      { header: 'Loại lịch', key: 'schedule_type', width: 12 },
      { header: 'Trạng thái', key: 'status', width: 12 }
    ];
    worksheet.getRow(1).font = { bold: true };

    schedules.forEach((schedule, index) => {
      worksheet.addRow({
        stt: index + 1,
        full_name: schedule.user?.full_name || 'N/A',
        role: schedule.user?.role || 'N/A',
        specialty: schedule.doctor?.Specialty?.name || 'N/A',
        date: moment(schedule.date).format('DD/MM/YYYY'),
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        schedule_type: schedule.schedule_type,
        status: schedule.status
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=lich-lam-viec.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('ERROR in exportSchedules:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xuất báo cáo',
      error: error.message
    });
  }
};

// ============================================
// 10. (MỚI) USER ĐĂNG KÝ / CẬP NHẬT LỊCH LINH HOẠT
// (Thay thế hàm cũ)
// ============================================
exports.registerOrUpdateFlexibleSchedule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { schedule_type, weekly_schedule_json, target_doctor_id } = req.body;
    const requester = req.user; // Người thực sự gửi request

    // Clinical staff đăng ký hộ bác sĩ
    let user_id = requester.id;
    let user = requester;

    if (target_doctor_id && requester.role === 'staff') {
      // Xác minh staff này có quyền quản lý doctor đó không
      const staffProfile = await models.Staff.findOne({ where: { user_id: requester.id }, transaction: t });
      if (!staffProfile || !staffProfile.canManageDoctor(target_doctor_id)) {
        await t.rollback();
        return res.status(403).json({ success: false, message: 'Bạn không được phép đăng ký lịch cho bác sĩ này.' });
      }
      const doctorUser = await models.Doctor.findByPk(target_doctor_id, {
        include: [{ model: models.User, as: 'user', attributes: ['id', 'role', 'full_name'] }],
        transaction: t
      });
      if (!doctorUser) {
        await t.rollback();
        return res.status(404).json({ success: false, message: 'Không tìm thấy bác sĩ.' });
      }
      user_id = doctorUser.user_id;
      user = { id: doctorUser.user_id, role: 'doctor', full_name: doctorUser.user.full_name };
    }

    if (!['fixed', 'flexible'].includes(schedule_type)) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Loại lịch đăng ký không hợp lệ" });
    }
    
    if (schedule_type === 'flexible' && (!weekly_schedule_json || Object.keys(weekly_schedule_json).length === 0)) {
       await t.rollback();
       return res.status(400).json({ success: false, message: "Vui lòng chọn ít nhất 1 ca làm việc" });
    }

    // Tìm doctor_id (nếu là bác sĩ)
    let doctor_id = null;
    if (user.role === 'doctor') {
      const doctor = await models.Doctor.findOne({ where: { user_id } });
      if (doctor) doctor_id = doctor.id;
    }
    
    // Logic "Chỉ 1 bản ghi": Tìm bản ghi đăng ký CŨ
    let existingRegistration = await models.Schedule.findOne({
      where: {
        user_id: user_id,
        schedule_type: 'flexible_registration'
      },
      transaction: t
    });
    
    const registrationData = {
      user_id: user_id,
      doctor_id: doctor_id,
      user_type: user.role,
      schedule_type: 'flexible_registration',
      status: 'pending', // Luôn set 'pending' khi đăng ký/cập nhật
      weekly_schedule_json: schedule_type === 'flexible' ? weekly_schedule_json : null,
      reject_reason: null, // Xóa lý do từ chối cũ (nếu có)
      // Các trường date, start, end, effective_date... mặc định là null
    };

    let registration;
    let isUpdate = false;

    if (existingRegistration) {
      // CẬP NHẬT bản ghi cũ
      await existingRegistration.update(registrationData, { transaction: t });
      registration = existingRegistration;
      isUpdate = true;
    } else {
      // TẠO MỚI (lần đầu)
      registration = await models.Schedule.create(registrationData, { transaction: t });
    }
    
    // Gửi thông báo cho trưởng phòng và Admin
    const onBehalf = (target_doctor_id && requester.role === 'staff')
      ? ` (do ${requester.full_name} đăng ký hộ)`
      : '';
    const notifMessage = isUpdate
      ? `${user.full_name} vừa CẬP NHẬT đăng ký lịch làm việc${onBehalf}.`
      : `${user.full_name} vừa gửi đăng ký lịch làm việc MỚI${onBehalf}.`;
      
    await notifyDepartmentManagersAndAdmins({
      message: notifMessage,
      link: `/quan-ly-lich-lam-viec?tab=manage-registrations&sub_tab=flexible&highlight=${registration.id}`,
      user_type: user.role === 'doctor' ? 'doctor' : 'staff',
      user_id: user.id,
      transaction: t
    });

    await t.commit();
    
    res.status(isUpdate ? 200 : 201).json({ 
      success: true, 
      message: 'Đã gửi đăng ký lịch. Vui lòng chờ quản trị viên phê duyệt.',
      data: registration
    });

  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('ERROR in registerOrUpdateFlexibleSchedule:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi đăng ký lịch',
      error: error.message
    });
  }
};

// ============================================
// 11. (MỚI) ADMIN PHÊ DUYỆT LỊCH LINH HOẠT
// (Thay thế hàm cũ)
// ============================================
exports.approveScheduleRegistration = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params; // ID của bản ghi Schedule (loại 'flexible_registration')
    const admin_user_id = req.user.id;

    const registration = await models.Schedule.findOne({
      where: { 
        id: id, 
        schedule_type: 'flexible_registration',
        status: { [Op.in]: ['pending', 'rejected'] } // Cho phép duyệt lại đơn bị từ chối
      },
      transaction: t
    });

    if (!registration) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn đăng ký lịch đang chờ hoặc đã bị từ chối." });
    }
    
    const user_id = registration.user_id;
    const user_role = registration.user_type;
    
    // 1. Tắt tất cả các bản ghi 'active' CŨ của user này
    await models.Schedule.update(
      { is_active_registration: false },
      { 
        where: { 
          user_id: user_id,
          schedule_type: 'flexible_registration',
          is_active_registration: true
        },
        transaction: t
      }
    );

    // 2. Kích hoạt bản ghi đăng ký MỚI
    const effective_date = moment().add(1, 'day').startOf('day').format('YYYY-MM-DD');
    
    await registration.update({
      status: 'approved',
      approved_by: admin_user_id,
      approved_at: new Date(),
      effective_date: effective_date,
      is_active_registration: true,
      reject_reason: null // Xóa lý do từ chối cũ
    }, { transaction: t });
    
    // 3. Cập nhật bảng Doctor hoặc Staff
    const new_schedule_type = registration.weekly_schedule_json ? 'flexible' : 'fixed';
    
    // (SỬA LẠI LOGIC NÀY)
    let userModel;
    if (user_role === 'doctor') {
      userModel = models.Doctor;
    } else if (user_role === 'staff') {
      userModel = models.Staff;
    } else {
      // Lỗi: user_type không hợp lệ
      await t.rollback();
      console.error(`Lỗi nghiêm trọng: user_type trong bản ghi đăng ký ${registration.id} không hợp lệ: ${user_role}`);
      return res.status(500).json({ 
        success: false, 
        message: `Lỗi dữ liệu: Vai trò của người dùng không xác định (${user_role}).`
      });
    }

    if (!userModel) {
       await t.rollback();
       console.error(`Lỗi nghiêm trọng: Không thể tải model cho vai trò ${user_role}.`);
       return res.status(500).json({ success: false, message: 'Lỗi máy chủ: Không thể tải model người dùng (Doctor/Staff).' });
    }
    // (Kết thúc sửa)

    await userModel.update(
      { 
        schedule_preference_type: new_schedule_type,
        current_schedule_id: registration.id // Link đến bản ghi active mới
      },
      { where: { user_id: user_id }, transaction: t }
    );
    
    // 4. Gửi thông báo cho user
    await createNotification({
      user_id: user_id,
      message: `Đăng ký lịch làm việc của bạn đã được PHÊ DUYỆT.`,
      // Link đến trang Lịch của tôi, tab đăng ký
      link: `/lich-cua-toi?tab=register_schedule&highlight=${registration.id}`,
      transaction: t
    });

    await t.commit();

    res.status(200).json({
      success: true,
      message: `Đã duyệt lịch. Lịch mới sẽ có hiệu lực từ ${effective_date}.`
    });

  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('ERROR in approveScheduleRegistration:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi duyệt đăng ký lịch',
      error: error.message
    });
  }
};

// ============================================
// 12. (MỚI) ADMIN TỪ CHỐI LỊCH LINH HOẠT
// ============================================
exports.rejectScheduleRegistration = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Lý do từ chối là bắt buộc." });
    }

    const registration = await models.Schedule.findOne({
      where: { 
        id: id, 
        schedule_type: 'flexible_registration',
        status: 'pending' // Chỉ từ chối đơn 'pending'
      },
      transaction: t
    });

    if (!registration) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn đăng ký đang chờ." });
    }

    // Cập nhật đơn
    await registration.update({
      status: 'rejected',
      reject_reason: reason,
      approved_by: req.user.id, // Lưu ai là người từ chối
      approved_at: new Date()
    }, { transaction: t });
    
    // Gửi thông báo cho user
    await createNotification({
      user_id: registration.user_id,
      message: `Đăng ký lịch làm việc của bạn đã bị TỪ CHỐI.`,
      link: `/lich-cua-toi?tab=register_schedule&highlight=${registration.id}`,
      transaction: t
    });

    await t.commit();
    res.status(200).json({ success: true, message: "Đã từ chối đơn đăng ký." });

  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('ERROR in rejectScheduleRegistration:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi từ chối đơn.' });
  }
};

// ============================================
// 13. (MỚI) ADMIN LẤY DANH SÁCH ĐĂNG KÝ (LINH HOẠT)
// (Thay thế hàm cũ)
// ============================================
exports.getPendingRegistrations = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status } = req.query; // (MỚI)
    const where = {
      schedule_type: 'flexible_registration'
    };

    // (MỚI) Thêm logic lọc status
    if (status && status !== 'all') {
      where.status = status;
    } else if (status === 'all') {
      // Lấy tất cả TRỪ 'cancelled' (nếu có)
      where.status = { [Op.notIn]: ['cancelled'] }; 
    } else {
      where.status = 'pending'; // Mặc định
    }

    let includeClause = [
      { model: models.User, as: 'user', attributes: ['id', 'full_name', 'avatar_url', 'role'] }
    ];

    // SỬA: Logic lọc theo department cho trưởng phòng
    if (userRole === 'staff') {
      // Lấy thông tin staff hiện tại
      const currentStaff = await models.Staff.findOne({ 
        where: { user_id: userId },
        attributes: ['department', 'rank']
      });
      
      if (currentStaff && currentStaff.rank === 'manager') {
        // Trưởng phòng: chỉ xem đăng ký của nhân viên trong department mình
        includeClause[0].include = [{ model: models.Staff, where: { department: currentStaff.department }, required: true }];
        includeClause[0].required = true; // INNER JOIN
      }
    }

    const registrations = await models.Schedule.findAll({
      where, // Sửa: Dùng `where`
      include: includeClause,
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({ success: true, data: registrations });

  } catch (error) {
    console.error('ERROR in getPendingRegistrations:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách chờ duyệt',
      error: error.message
    });
  }
};

// ============================================
// 14. (MỚI) USER LẤY BẢN GHI ĐĂNG KÝ DUY NHẤT CỦA MÌNH
// (Thay thế hàm cũ)
// ============================================
exports.getMyScheduleRegistration = async (req, res) => {
  try {
    const user_id = req.user.id;
    
    // Tìm 1 và chỉ 1 bản ghi đăng ký của user
    const registration = await models.Schedule.findOne({
      where: {
        user_id: user_id,
        schedule_type: 'flexible_registration'
      }
    });

    // Nếu không có (user mới chưa đăng ký)
    if (!registration) {
      // Trả về một object giả lập 'fixed'
      return res.status(200).json({ 
        success: true, 
        is_new: true, // Báo cho frontend biết đây là tạo mới
        data: {
          schedule_type: 'fixed',
          weekly_schedule_json: null,
          status: 'new'
        } 
      });
    }
    
    // Nếu có, trả về đăng ký của họ (kèm status và lý do từ chối)
    res.status(200).json({ 
      success: true, 
      is_new: false,
      data: {
         id: registration.id,
         schedule_type: registration.weekly_schedule_json ? 'flexible' : 'fixed',
         weekly_schedule_json: registration.weekly_schedule_json,
         status: registration.status, // pending, approved, rejected
         reject_reason: registration.reject_reason,
         effective_date: registration.effective_date
      }
    });

  } catch (error) {
    console.error('ERROR in getMyScheduleRegistration:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy đăng ký lịch cá nhân',
      error: error.message
    });
  }
};


// ============================================
// === CHỨC NĂNG TĂNG CA (OVERTIME) ===
// ============================================

// ============================================
// 15. (MỚI) ĐĂNG KÝ TĂNG CA (User hoặc Admin)
// ============================================
exports.registerOvertime = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { slots, reason, user_id_for_admin, target_user_id } = req.body; // slots: {"2025-11-18": ["17:00-19:00"], ...}
    const requestUser = req.user; // Người gửi request

    if (!slots || Object.keys(slots).length === 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Vui lòng chọn ít nhất 1 ca tăng ca." });
    }
    
    let targetUser, targetUserId, targetDoctorId = null, targetUserRole;
    
    if (user_id_for_admin || target_user_id) {
      // Admin hoặc staff clinical đăng ký thay cho người khác
      targetUserId = user_id_for_admin || target_user_id;
      targetUser = await models.User.findByPk(targetUserId, { transaction: t });
      if (!targetUser) {
        await t.rollback();
        return res.status(404).json({ success: false, message: "Không tìm thấy user được chọn." });
      }

      if (requestUser.role === 'staff' && target_user_id) {
        const requesterStaff = await models.Staff.findOne({ where: { user_id: requestUser.id }, transaction: t });
        if (!requesterStaff || requesterStaff.department !== 'clinical') {
          await t.rollback();
          return res.status(403).json({ success: false, message: 'Bạn không có quyền đăng ký hộ người khác.' });
        }

        const targetDoctor = await models.Doctor.findOne({ where: { user_id: targetUserId }, transaction: t });
        if (!targetDoctor || !requesterStaff.canManageDoctor(targetDoctor.id)) {
          await t.rollback();
          return res.status(403).json({ success: false, message: 'Bạn chỉ được đăng ký hộ bác sĩ mình được phân công.' });
        }
      }
    } else {
      // User tự đăng ký
      targetUserId = requestUser.id;
      targetUser = requestUser;
    }
    
    targetUserRole = targetUser.role;
    if (targetUserRole === 'doctor') {
      const doctor = await models.Doctor.findOne({ where: { user_id: targetUserId }, transaction: t });
      targetDoctorId = doctor ? doctor.id : null;
    }
    
    const newOvertimeRecords = [];
    const status = (requestUser.role === 'admin') ? 'approved' : 'pending';
    const approved_by = (requestUser.role === 'admin') ? requestUser.id : null;
    const approved_at = (requestUser.role === 'admin') ? new Date() : null;

    for (const [date, timeSlots] of Object.entries(slots)) {
      for (const slot of timeSlots) {
        const [start_time, end_time] = slot.split('-');
        
        const record = await models.Schedule.create({
          user_id: targetUserId,
          doctor_id: targetDoctorId,
          user_type: targetUserRole,
          schedule_type: 'overtime',
          date: date,
          start_time: `${start_time}:00`,
          end_time: `${end_time}:00`,
          status: status,
          reason: reason || "Đăng ký tăng ca",
          approved_by: approved_by,
          approved_at: approved_at
        }, { transaction: t });
        
        newOvertimeRecords.push(record);
      }
    }
    
    // Gửi thông báo
    if (requestUser.role === 'admin' && user_id_for_admin) {
      // Admin đăng ký cho user
      await createNotification({
        user_id: targetUserId,
        message: `Admin đã đăng ký lịch tăng ca cho bạn (tổng ${newOvertimeRecords.length} ca).`,
        link: `/lich-cua-toi?tab=overtime`, // Link tới tab tăng ca
        transaction: t
      });
    } else {
      // User tự đăng ký -> Báo trưởng phòng và Admin
      await notifyDepartmentManagersAndAdmins({
        message: `${requestUser.full_name} vừa gửi ${newOvertimeRecords.length} yêu cầu tăng ca${targetUserRole === 'doctor' ? ' thay cho bác sĩ được phân công' : ''}.`,
        link: `/quan-ly-lich-lam-viec?tab=manage-registrations&sub_tab=overtime`,
        user_type: targetUserRole === 'doctor' ? 'doctor' : 'staff',
        user_id: targetUserId,
        transaction: t
      });
    }

    await t.commit();
    res.status(201).json({ 
      success: true, 
      message: `Đã gửi ${newOvertimeRecords.length} ca tăng ca.`,
      data: newOvertimeRecords
    });

  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('ERROR in registerOvertime:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi đăng ký tăng ca' });
  }
};

// ============================================
// 16. (MỚI) LẤY DANH SÁCH TĂNG CA CHỜ DUYỆT (Admin)
// ============================================
exports.getPendingOvertimes = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status } = req.query; // (MỚI)
    const where = {
      schedule_type: 'overtime'
    };

    // (MỚI) Thêm logic lọc status
    if (status && status !== 'all') {
      where.status = status;
    } else if (status === 'all') {
      // Lấy tất cả TRỪ 'cancelled' (nếu có)
      where.status = { [Op.notIn]: ['cancelled'] };
    } else {
      where.status = 'pending'; // Mặc định
    }

    let includeClause = [
      { model: models.User, as: 'user', attributes: ['id', 'full_name', 'avatar_url', 'role'] }
    ];

    // SỬA: Logic lọc theo department cho trưởng phòng
    if (userRole === 'staff') {
      // Lấy thông tin staff hiện tại
      const currentStaff = await models.Staff.findOne({ 
        where: { user_id: userId },
        attributes: ['department', 'rank']
      });
      
      if (currentStaff && currentStaff.rank === 'manager') {
        // Trưởng phòng: chỉ xem overtime của nhân viên trong department mình
        includeClause[0].include = [{ model: models.Staff, where: { department: currentStaff.department }, required: true }];
        includeClause[0].required = true; // INNER JOIN
      }
    }

    const pendingOvertimes = await models.Schedule.findAll({
      where, // Sửa: Dùng `where`
      include: includeClause,
      order: [['date', 'ASC'], ['start_time', 'ASC']]
    });
    
    res.status(200).json({ success: true, data: pendingOvertimes });

  } catch (error) {
    console.error('ERROR in getPendingOvertimes:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách tăng ca chờ duyệt' });
  }
};

// ============================================
// 17. (MỚI) DUYỆT / TỪ CHỐI TĂNG CA (Admin)
// ============================================
exports.reviewOvertime = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params; // ID của `Schedule` (type 'overtime')
    const { action, reason } = req.body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "Hành động không hợp lệ." });
    }
    if (action === 'reject' && (!reason || !reason.trim())) {
      return res.status(400).json({ success: false, message: "Lý do từ chối là bắt buộc." });
    }

    const overtime = await models.Schedule.findOne({
      where: { id: id, schedule_type: 'overtime', status: 'pending' },
      transaction: t
    });

    if (!overtime) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu tăng ca." });
    }

    let updateData = {
      approved_by: req.user.id,
      approved_at: new Date()
    };
    let notifMessage = '';

    if (action === 'approve') {
      updateData.status = 'approved';
      notifMessage = `Yêu cầu tăng ca ngày ${overtime.date} (${overtime.start_time}) của bạn đã được PHÊ DUYỆT.`;
    } else {
      updateData.status = 'rejected';
      updateData.reject_reason = reason;
      notifMessage = `Yêu cầu tăng ca ngày ${overtime.date} (${overtime.start_time}) đã bị TỪ CHỐI.`;
    }

    await overtime.update(updateData, { transaction: t });
    
    // Gửi thông báo cho user
    await createNotification({
      user_id: overtime.user_id,
      message: notifMessage,
      link: `/lich-cua-toi?tab=overtime&highlight=${overtime.id}`,
      transaction: t
    });

    await t.commit();
    res.status(200).json({ success: true, message: `Đã ${action === 'approve' ? 'phê duyệt' : 'từ chối'} ca tăng ca.` });

  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('ERROR in reviewOvertime:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi duyệt tăng ca.' });
  }
};