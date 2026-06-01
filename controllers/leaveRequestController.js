// server/controllers/leaveRequestController.js
// SỬA: Đã cập nhật transaction và dùng đúng ENUM 'leave_req'

const { models, sequelize } = require('../config/db'); 
const { Op } = require('sequelize');
const emailSender = require('../utils/emailSender');

/**
 * Helper: Xác định ai sẽ nhận được đơn xin nghỉ này để phê duyệt
 * @param {number} requesterUserId - ID của người gửi đơn
 * @returns {Array} - Mảng các user_id sẽ nhận được đơn
 */
const getLeaveRequestApprovers = async (requesterUserId) => {
  const approvers = [];
  
  // 1. Luôn có admin
  const admins = await models.User.findAll({ 
    where: { role: 'admin' },
    attributes: ['id']
  });
  approvers.push(...admins.map(admin => admin.id));
  
  // 2. Lấy thông tin người gửi đơn
  const requesterStaff = await models.Staff.findOne({ 
    where: { user_id: requesterUserId },
    attributes: ['department', 'rank']
  });
  
  if (!requesterStaff) {
    // Nếu không phải staff (có thể là doctor), chỉ admin duyệt
    return approvers;
  }
  
  const { department, rank } = requesterStaff;
  
  // 3. Nếu là trưởng phòng, chỉ admin duyệt
  if (rank === 'manager') {
    return approvers;
  }
  
// 4. Nếu là nhân viên thường, tìm trưởng phòng và nhân viên có quyền approve_leave
  const departmentStaff = await models.Staff.findAll({
    where: { 
      department: department,
      user_id: { [Op.ne]: requesterUserId } // Loại trừ chính mình
    },
    // SỬA LỖI: Bỏ include User thừa để tránh lỗi join bảng, chỉ lấy đúng dữ liệu cần thiết
    attributes: ['user_id', 'rank', 'permissions']
  });
  
  // Thêm trưởng phòng
  const manager = departmentStaff.find(staff => staff.rank === 'manager');
  if (manager) {
    approvers.push(manager.user_id);
  }
  
  // Thêm nhân viên có quyền approve_leave 
  // SỬA LỖI: Chặn crash nếu work_shift lưu dạng boolean (true) thay vì mảng (Array)
  for (const staff of departmentStaff) {
    const perms = staff.permissions;
    if (perms && perms.work_shift) {
      if (Array.isArray(perms.work_shift) && perms.work_shift.includes('approve_leave')) {
        approvers.push(staff.user_id);
      } else if (perms.work_shift === true) {
        approvers.push(staff.user_id);
      }
    }
  }
  
  // 5. Loại bỏ duplicate
  return [...new Set(approvers)];
};

const DEFAULT_SHIFT_RANGES = {
  morning: { start: '07:00:00', end: '12:00:00' },
  afternoon: { start: '13:00:00', end: '17:00:00' },
  evening: { start: '17:00:00', end: '21:00:00' }
};

const timeToMinutes = (timeValue) => {
  if (!timeValue) return null;
  const [hours, minutes] = String(timeValue).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const getLeaveWindowMinutes = (leaveType, shiftName, timeFrom, timeTo) => {
  if (leaveType === 'time_range') {
    return { start: timeToMinutes(timeFrom), end: timeToMinutes(timeTo) };
  }

  if (leaveType === 'single_shift') {
    const shift = DEFAULT_SHIFT_RANGES[shiftName];
    if (!shift) return { start: null, end: null };
    return { start: timeToMinutes(shift.start), end: timeToMinutes(shift.end) };
  }

  return { start: null, end: null };
};

const overlaps = (startA, endA, startB, endB) => {
  if ([startA, endA, startB, endB].some(v => v == null)) return false;
  return startA < endB && endA > startB;
};

/**
 * @desc    Tạo đơn xin nghỉ (Doctor/Staff)
 * @route   POST /api/leave-requests
 * @access  Private/Doctor/Staff
 */
exports.createLeaveRequest = async (req, res) => {
  
  const transaction = await sequelize.transaction();
  
  try {
    const requesterUserId = req.user.id;
    const { target_user_id } = req.body;
    const { leave_type, date_from, date_to, shift_name, time_from, time_to, reason } = req.body;

    // Validate
    if (!leave_type || !date_from || !reason) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Thiếu thông tin: leave_type, date_from, reason là bắt buộc.' });
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dateFromObj = new Date(date_from);
    if (dateFromObj < tomorrow) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Phải gửi đơn xin nghỉ trước ít nhất 1 ngày.' });
    }

    // Xác định người nhận đơn (mặc định là chính người gửi)
    let userId = requesterUserId;
    if (target_user_id) {
      const targetUser = await models.User.findByPk(target_user_id, { transaction });
      if (!targetUser) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Không tìm thấy người được chọn để gửi đơn.' });
      }

      // Staff clinical được phép gửi hộ cho bác sĩ mình phụ trách
      if (req.user.role === 'staff') {
        const requesterStaff = await models.Staff.findOne({ where: { user_id: requesterUserId }, transaction });
        if (!requesterStaff || requesterStaff.department !== 'clinical') {
          await transaction.rollback();
          return res.status(403).json({ success: false, message: 'Bạn không có quyền gửi đơn thay cho người khác.' });
        }

        const targetDoctor = await models.Doctor.findOne({ where: { user_id: target_user_id }, transaction });
        if (!targetDoctor || !requesterStaff.canManageDoctor(targetDoctor.id)) {
          await transaction.rollback();
          return res.status(403).json({ success: false, message: 'Bạn chỉ được gửi đơn thay cho bác sĩ mình được phân công.' });
        }
      }

      userId = target_user_id;
    }

    // Kiểm tra user_type
    let userType = null;
    let doctorId = null;
    const doctor = await models.Doctor.findOne({ where: { user_id: userId }, transaction });
    if (doctor) {
      userType = 'doctor';
      doctorId = doctor.id;
    } else {
      const staff = await models.Staff.findOne({ where: { user_id: userId }, transaction });
      if (staff) { userType = 'staff'; }
    }
    if (!userType) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Chỉ bác sĩ hoặc nhân viên mới có thể xin nghỉ.' });
    }

    // Chặn leave nếu trùng lịch hẹn của bác sĩ trong cùng khung giờ
    if (userType === 'doctor') {
      const appointmentConflicts = await models.Appointment.findAll({
        where: {
          doctor_id: doctorId,
          appointment_date: { [Op.between]: [date_from, date_to || date_from] },
          status: { [Op.notIn]: ['cancelled', 'passed'] }
        },
        attributes: ['appointment_date', 'appointment_start_time', 'appointment_end_time'],
        transaction
      });

      const isAllDayLeave = leave_type === 'full_day' || leave_type === 'multiple_days';
      const leaveWindow = getLeaveWindowMinutes(leave_type, shift_name, time_from, time_to);

      const hasConflict = appointmentConflicts.some(app => {
        if (isAllDayLeave) return true;
        const appStart = timeToMinutes(app.appointment_start_time);
        const appEnd = timeToMinutes(app.appointment_end_time);
        return overlaps(leaveWindow.start, leaveWindow.end, appStart, appEnd);
      });

      if (hasConflict) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Khoảng thời gian này đang có lịch hẹn, không thể đăng ký nghỉ.' });
      }
    }
    
    // Kiểm tra trùng lặp đơn nghỉ
    const targetDateTo = date_to ? date_to : date_from; // SỬA LỖI: Đảm bảo biến không bị undefined
    const overlappingLeave = await models.LeaveRequest.findOne({
      where: {
        user_id: userId,
        status: { [Op.in]: ['pending', 'approved'] },
        date_from: { [Op.lte]: targetDateTo }, 
        [Op.or]: [
          { date_to: { [Op.gte]: date_from } },
          { date_to: null, date_from: { [Op.gte]: date_from } } // SỬA LỖI: Bỏ [Op.is] để tránh lỗi truy vấn Sequelize
        ]
      },
      transaction
    });
    if (overlappingLeave) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: `Bạn đã có một đơn xin nghỉ (Trạng thái: ${overlappingLeave.status}) trùng với khoảng thời gian này.` });
    }

    // (Kiểm tra conflict appointments)
    if (userType === 'doctor') {
      const conflictAppointments = await models.Appointment.findAll({
        where: {
          doctor_id: doctorId,
          appointment_date: { [Op.between]: [date_from, date_to || date_from] },
          status: { [Op.in]: ['pending', 'confirmed'] }
        },
        transaction
      });
      if (conflictAppointments.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Bạn có ${conflictAppointments.length} lịch hẹn trong khoảng thời gian này. Vui lòng liên hệ admin để xử lý trước khi xin nghỉ.` });
      }
    }

    // Create leave request
    const leaveRequest = await models.LeaveRequest.create({
      user_id: userId,
      user_type: userType,
      leave_type,
      date_from,
      date_to: leave_type === 'multiple_days' ? date_to : null,
      shift_name: leave_type === 'single_shift' ? shift_name : null,
      time_from: leave_type === 'time_range' ? time_from : null,
      time_to: leave_type === 'time_range' ? time_to : null,
      reason,
      status: 'pending',
      requested_at: new Date()
    }, { transaction });

    // SỬA: Gửi thông báo cho những người có quyền phê duyệt đơn này
    const approvers = await getLeaveRequestApprovers(userId);
    
    for (const approverId of approvers) {
      if (models.Notification) {
        await models.Notification.create({
          user_id: approverId,
          type: 'leave_req', 
          message: `${req.user.full_name} đã gửi đơn xin nghỉ mới: "${reason.substring(0, 50)}..."`,
          link: `/quan-ly-lich-lam-viec?tab=manage-registrations&sub_tab=leaves&highlight=${leaveRequest.id}`,
          is_read: false
        }, { transaction });
      }
    }
    
    await transaction.commit();
    
    res.status(201).json({
      success: true,
      message: 'Đơn xin nghỉ đã được gửi và đang chờ duyệt.',
      data: leaveRequest
    });

  } catch (error) {
    await transaction.rollback();
    
    console.error('ERROR in createLeaveRequest:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tạo đơn xin nghỉ.'
    });
  }
};

/**
 * @desc    Lấy danh sách đơn xin nghỉ của tôi
 * @route   GET /api/leave-requests/my-leaves
 * @access  Private/Doctor/Staff
 */
exports.getMyLeaveRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const where = { user_id: userId };
    if (status && status !== 'all') where.status = status;

    const leaveRequests = await models.LeaveRequest.findAll({
      where,
      include: [
        {
          model: models.User,
          as: 'processor',
          attributes: ['id', 'full_name', 'email']
        }
      ],
      order: [['requested_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests
    });

  } catch (error) {
    console.error('ERROR in getMyLeaveRequests:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách đơn xin nghỉ.'
    });
  }
};

/**
 * @desc    Lấy danh sách đơn xin nghỉ (Admin/Staff)
 * @route   GET /api/leave-requests/pending
 * @access  Private/Admin/Staff
 */
exports.getPendingLeaveRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { user_type, status } = req.query;

    const where = {};

    // SỬA: Logic lọc trạng thái (Loại bỏ 'cancelled' khỏi 'all')
    if (status && status !== 'all') {
      // 1. Lọc theo status cụ thể (pending, approved, rejected)
      where.status = status;
    } else if (status === 'all') {
      // 2. Nếu là 'all', lấy tất cả TRỪ 'cancelled'
      where.status = { [Op.not]: 'cancelled' };
    } else {
      // 3. Mặc định (không truyền status) -> chỉ lấy 'pending'
      where.status = 'pending';
    }

    if (user_type && user_type !== 'all') {
      where.user_type = user_type;
    }

    let includeClause = [
      { 
        model: models.User, 
        as: 'user',
        attributes: ['id', 'full_name', 'email', 'role'],
        include: [
          { 
            model: models.Doctor,
            include: [{ model: models.Specialty, as: 'specialty' }] 
          },
          { model: models.Staff }
        ] 
      } 
    ];

    let leaveRequests;
    
    // SỬA: Logic lọc đơn theo quyền phê duyệt
    if (userRole === 'admin') {
      // Admin: xem tất cả đơn pending
      // Không cần filter gì thêm
    } else if (userRole === 'staff') {
      // Lấy thông tin staff hiện tại
      const currentStaff = await models.Staff.findOne({ 
        where: { user_id: userId },
        attributes: ['department', 'rank', 'permissions']
      });
      
      if (currentStaff) {
        const { department, rank, permissions } = currentStaff;
        let allowedUserIds = [];
        
        // Trưởng phòng: thấy đơn của tất cả nhân viên trong department (trừ chính mình)
        if (rank === 'manager') {
          const departmentUsers = await models.Staff.findAll({
            where: { 
              department: department,
              user_id: { [Op.ne]: userId } // Loại trừ chính mình
            },
            attributes: ['user_id']
          });
          allowedUserIds = departmentUsers.map(staff => staff.user_id);
        }
        // Nhân viên có quyền approve_leave: thấy đơn của nhân viên khác trong department
        else if (permissions && permissions.work_shift && permissions.work_shift.includes('approve_leave')) {
          const departmentUsers = await models.Staff.findAll({
            where: { department: department },
            attributes: ['user_id']
          });
          allowedUserIds = departmentUsers.map(staff => staff.user_id).filter(id => id !== userId);
        }
        
        // Lọc đơn theo danh sách user được phép
        if (allowedUserIds.length > 0) {
          where.user_id = { [Op.in]: allowedUserIds };
        } else {
          // Nếu không có quyền duyệt ai, trả về empty
          return res.status(200).json({
            success: true,
            count: 0,
            data: []
          });
        }
      }
    }
    // Doctor và Patient: không có quyền xem đơn pending
    else {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    leaveRequests = await models.LeaveRequest.findAll({
      where,
      include: includeClause,
      order: [['requested_at', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests
    });

  } catch (error) {
    console.error('ERROR in getPendingLeaveRequests:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách đơn chờ duyệt.'
    });
  }
};

/**
 * @desc    Duyệt đơn xin nghỉ (Admin/Staff)
 * @route   PUT /api/leave-requests/:id/approve
 * @access  Private/Admin/Staff
 */
exports.approveLeaveRequest = async (req, res) => {
  
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const leaveRequest = await models.LeaveRequest.findByPk(id, {
      include: [ { model: models.User, as: 'user' } ],
      transaction
    });

    if (!leaveRequest) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn.' });
    }
    if (leaveRequest.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Đơn đã được xử lý.' });
    }

    // SỬA: Kiểm tra quyền phê duyệt
    const approvers = await getLeaveRequestApprovers(leaveRequest.user_id);
    if (!approvers.includes(userId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Bạn không có quyền duyệt đơn này.' });
    }

    await leaveRequest.update({
      status: 'approved',
      processed_at: new Date(),
      processed_by: userId
    }, { transaction });

    // Cập nhật WORK_STATUS
    if (leaveRequest.user_type === 'doctor') {
        const doctor = await models.Doctor.findOne({ where: { user_id: leaveRequest.user_id }, transaction });
        if (doctor && doctor.update) {
            await doctor.update({ work_status: 'on_leave' }, { transaction }); //
        }
    } else if (leaveRequest.user_type === 'staff') {
        const staff = await models.Staff.findOne({ where: { user_id: leaveRequest.user_id }, transaction });
        if (staff && staff.update) {
            await staff.update({ work_status: 'on_leave' }, { transaction }); //
        }
    }

    // Tạo notification cho user
    if (models.Notification) {
      await models.Notification.create({
        user_id: leaveRequest.user_id,
        // SỬA: Dùng 'leave_req'
        type: 'leave_req', 
        message: `Đơn xin nghỉ của bạn (từ ${leaveRequest.date_from}) đã được DUYỆT.`,
        link: `/lich-cua-toi`,
        is_read: false
      }, { transaction });
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Đơn xin nghỉ đã được duyệt.',
      data: leaveRequest
    });

  } catch (error) {
    await transaction.rollback();
    console.error('ERROR in approveLeaveRequest:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi duyệt đơn xin nghỉ.'
    });
  }
};

/**
 * @desc    Từ chối đơn xin nghỉ (Admin/Staff)
 * @route   PUT /api/leave-requests/:id/reject
 * @access  Private/Admin/Staff
 */
exports.rejectLeaveRequest = async (req, res) => {

  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { reject_reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!reject_reason) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối.' });
    }

    const leaveRequest = await models.LeaveRequest.findByPk(id, {
      include: [{ model: models.User, as: 'user' }],
      transaction
    });

    if (!leaveRequest) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn.' });
    }
    if (leaveRequest.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Đơn đã được xử lý.' });
    }

    // SỬA: Kiểm tra quyền phê duyệt
    const approvers = await getLeaveRequestApprovers(leaveRequest.user_id);
    if (!approvers.includes(userId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Bạn không có quyền từ chối đơn này.' });
    }

    await leaveRequest.update({
      status: 'rejected',
      processed_at: new Date(),
      processed_by: userId,
      reject_reason
    }, { transaction });

    // Notification
    if (models.Notification) {
      await models.Notification.create({
        user_id: leaveRequest.user_id,
        // SỬA: Dùng 'leave_req'
        type: 'leave_req', 
        message: `Đơn xin nghỉ của bạn (từ ${leaveRequest.date_from}) đã bị TỪ CHỐI. Lý do: ${reject_reason}`,
        link: `/lich-cua-toi`,
        is_read: false
      }, { transaction });
    }
    
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Đơn xin nghỉ đã bị từ chối.',
      data: leaveRequest
    });

  } catch (error) {
    await transaction.rollback();
    console.error('ERROR in rejectLeaveRequest:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi từ chối đơn xin nghỉ.'
    });
  }
};

/**
 * @desc    Hủy đơn xin nghỉ (Owner)
 * @route   DELETE /api/leave-requests/:id
 * @access  Private/Doctor/Staff
 */
exports.cancelLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const leaveRequest = await models.LeaveRequest.findByPk(id);

    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn.' });
    }
    if (leaveRequest.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy đơn này.' });
    }
    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đơn đang chờ duyệt.' });
    }

    await leaveRequest.update({ 
      status: 'cancelled' //
    });

    res.status(200).json({
      success: true,
      message: 'Đơn xin nghỉ đã được hủy.',
      data: leaveRequest
    });

  } catch (error) {
    console.error('ERROR in cancelLeaveRequest:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi hủy đơn xin nghỉ.'
    });
  }
};

/**
 * @desc    Lấy lịch sử đơn nghỉ của 1 user (Admin/Staff xem)
 * @route   GET /api/leave-requests/history/:userId
 * @access  Private/Admin/Staff
 */
exports.getUserLeaveHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    const where = { user_id: userId };
    if (status && status !== 'all') where.status = status;

    const leaveRequests = await models.LeaveRequest.findAll({
      where,
      include: [
        {
          model: models.User,
          as: 'processor',
          attributes: ['id', 'full_name', 'email']
        }
      ],
      order: [['requested_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests
    });

  } catch (error) {
    console.error('ERROR in getUserLeaveHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy lịch sử đơn xin nghỉ.'
    });
  }
};