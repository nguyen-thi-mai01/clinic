// server/controllers/consultationAdminController.js
// ✅ Controller xử lý các chức năng quản lý tư vấn cho Admin

const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');
const momoService = require('../utils/momoService');
const vnpayService = require('../utils/vnpayService');

// ==================== 1. DANH SÁCH TƯ VẤN REALTIME ====================

/**
 * Lấy danh sách tất cả tư vấn (Admin) với filters nâng cao
 * GET /api/consultations/admin/realtime/all
 */
exports.getAllConsultationsRealtime = async (req, res) => {
  try {
    const {
      status,
      type,
      doctor_id,
      patient_id,
      specialty_id,
      date_from,
      date_to,
      search,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      order = 'DESC'
    } = req.query;

    const whereClause = {};

    // [LOGIC MỚI] NẾU LÀ BÁC SĨ -> CHỈ LẤY CỦA CHÍNH MÌNH
    if (req.user.role === 'doctor') {
      whereClause.doctor_id = req.user.id;
    }
    
    // Filters
    // ✅ SỬA: Chuyển đổi giá trị query params

    // [CODE MỚI - START] LOGIC PHÂN QUYỀN STAFF VẬN HÀNH
    // Nếu là Staff -> Chỉ hiện tư vấn của bác sĩ mình quản lý
    if (req.user.role === 'staff') {
      const staff = await models.Staff.findOne({ where: { user_id: req.user.id } });
      
      // Lấy danh sách ID bác sĩ được phân công
      const managedDoctorIds = staff?.managed_doctors?.doctor_ids || [];

      if (managedDoctorIds.length > 0) {
        // Nếu staff có filter theo doctor_id cụ thể, kiểm tra xem có thuộc danh sách quản lý không
        if (doctor_id) {
          if (!managedDoctorIds.includes(parseInt(doctor_id))) {
            // Nếu lọc bác sĩ không thuộc quyền quản lý -> Trả về rỗng
             return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } });
          }
          // Nếu hợp lệ thì whereClause.doctor_id đã được gán ở logic dưới (hoặc giữ nguyên)
        } else {
          // ✅ ĐÃ SỬA: Chuyển đổi Doctor ID sang User ID để tìm trong bảng Consultation
          // Vì Consultation lưu doctor_id là User ID, còn managed_doctors lưu Doctor ID
          const doctors = await models.Doctor.findAll({
            where: { id: { [Op.in]: managedDoctorIds } },
            attributes: ['user_id']
          });
          const doctorUserIds = doctors.map(d => d.user_id);

          whereClause.doctor_id = { [Op.in]: doctorUserIds };
        }
      } else {
        // Staff không quản lý ai -> Không thấy gì
        return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } });
      }
    }
    

    if (status && status !== 'all') {
      whereClause.status = status;
    }
    if (type && type !== 'all') {
      // ✅ SỬA: Mapping từ UI sang DB
      const typeMapping = {
        'video': 'video',
        'chat': 'chat',
        'offline': 'offline'
      };
      whereClause.consultation_type = typeMapping[type] || type;
    }
    if (doctor_id) whereClause.doctor_id = parseInt(doctor_id);
    if (patient_id) whereClause.patient_id = parseInt(patient_id);
        
    // Date range
    if (date_from || date_to) {
      whereClause.appointment_time = {};
      if (date_from) whereClause.appointment_time[Op.gte] = new Date(date_from);
      if (date_to) whereClause.appointment_time[Op.lte] = new Date(date_to);
    }
    
    // Search
    if (search) {
      whereClause[Op.or] = [
        { consultation_code: { [Op.like]: `%${search}%` } },
        { chief_complaint: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: consultations } = await models.Consultation.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['id', 'full_name', 'phone', 'email', 'avatar_url'],
          include: [
            {
              model: models.Patient,
              attributes: ['id', 'code']
            }
          ]
        },
        {
          model: models.User,
          as: 'doctor',
          attributes: ['id', 'full_name', 'phone', 'email', 'avatar_url'],
          include: [
            {
              model: models.Doctor,
              attributes: ['id', 'code', 'specialty_id'],
              include: [
                {
                  model: models.Specialty,
                  as: 'specialty',
                  attributes: ['id', 'name', 'slug']
                }
              ]
            }
          ]
        },
        {
        model: models.ConsultationPricing,
        as: 'package', // ← SỬA ALIAS
        // SỬA LẠI CÁC CỘT CHO ĐÚNG VỚI MODEL ConsultationPricing.js
        attributes: ['id', 'package_name', 'package_type', 'duration_minutes', 'price'], 
        required: false 
        }
      ],
      order: [[sort_by, order]],
      limit: parseInt(limit),
      offset: offset
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách tư vấn thành công',
      data: {
        consultations,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error in getAllConsultationsRealtime:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách tư vấn',
      error: error.message
    });
  }
};

// ==================== 2. GIÁM SÁT PHIÊN REALTIME ====================

/**
 * Lấy danh sách phiên đang hoạt động
 * GET /api/consultations/admin/realtime/active
 */
exports.getActiveConsultations = async (req, res) => {
  try {
    // [LOGIC MỚI] Tạo điều kiện lọc
    const whereCondition = { status: 'in_progress' };
    
    // Nếu là bác sĩ, chỉ lấy ca của mình
    if (req.user.role === 'doctor') {
      whereCondition.doctor_id = req.user.id;
    }

    const activeConsultations = await models.Consultation.findAll({
      where: whereCondition,
      
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['id', 'full_name', 'avatar_url']
        },
        {
          model: models.User,
          as: 'doctor',
          attributes: ['id', 'full_name', 'avatar_url'],
          include: [
            {
              model: models.Doctor,
              attributes: ['specialty_id'],
              include: [
                {
                  model: models.Specialty,
                  attributes: ['name']
                }
              ]
            }
          ]
        },
        {
          model: models.ChatMessage,
          as: 'messages',
          attributes: ['id', 'message_type', 'created_at'],
          limit: 1,
          order: [['created_at', 'DESC']]
        }
      ],
      order: [['started_at', 'ASC']]
    });

    // Tính thời gian còn lại cho mỗi phiên
    const consultationsWithTimeLeft = activeConsultations.map(consultation => {
      const now = new Date();
      const startedAt = new Date(consultation.started_at);
      const duration = consultation.duration || 30; // phút
      const endTime = new Date(startedAt.getTime() + duration * 60000);
      const timeLeft = Math.max(0, Math.floor((endTime - now) / 60000)); // phút

      return {
        ...consultation.toJSON(),
        time_left_minutes: timeLeft,
        is_overtime: timeLeft === 0
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách phiên hoạt động thành công',
      data: {
        active_consultations: consultationsWithTimeLeft,
        total: consultationsWithTimeLeft.length
      }
    });

  } catch (error) {
    console.error('Error in getActiveConsultations:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách phiên hoạt động',
      error: error.message
    });
  }
};

/**
 * Xem nội dung chat của một phiên (read-only)
 * GET /api/consultations/admin/realtime/:id/messages
 */
exports.getConsultationMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const consultation = await models.Consultation.findOne({
      where: { consultation_code: id }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn'
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: messages } = await models.ChatMessage.findAndCountAll({
      where: {
        consultation_id: id,
        is_deleted: false
      },
      include: [
        {
          model: models.User,
          as: 'sender',
          attributes: ['id', 'full_name', 'avatar_url']
        }
      ],
      order: [['created_at', 'ASC']],
      limit: parseInt(limit),
      offset: offset
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy tin nhắn thành công',
      data: {
        messages,
        consultation: {
          id: consultation.id,
          code: consultation.consultation_code,
          status: consultation.status
        },
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error in getConsultationMessages:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy tin nhắn',
      error: error.message
    });
  }
};

/**
 * Gửi tin nhắn hệ thống vào phiên tư vấn
 * POST /api/consultations/admin/realtime/:id/system-message
 */
exports.sendSystemMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, type = 'warning', target_user_id, notify_both } = req.body;
    const adminId = req.user.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập nội dung tin nhắn'
      });
    }

    // Tìm theo numeric id trước, fallback sang consultation_code
    let consultation = null;
    if (!isNaN(id)) {
      consultation = await models.Consultation.findByPk(id, {
        include: [
          { model: models.User, as: 'patient', attributes: ['id', 'full_name'] },
          { model: models.User, as: 'doctor', attributes: ['id', 'full_name'] }
        ]
      });
    }
    if (!consultation) {
      consultation = await models.Consultation.findOne({
        where: { consultation_code: id },
        include: [
          { model: models.User, as: 'patient', attributes: ['id', 'full_name'] },
          { model: models.User, as: 'doctor', attributes: ['id', 'full_name'] }
        ]
      });
    }

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn'
      });
    }

    // Lưu tin nhắn vào DB dùng consultation.id (số nguyên)
    // Xác định receiver_id: nếu notify_both thì gửi 2 tin riêng, 
// nếu không thì gửi cho target hoặc mặc định là patient
const receiverId = target_user_id || consultation.patient?.id;

if (!receiverId) {
  return res.status(400).json({
    success: false,
    message: 'Không xác định được người nhận tin nhắn'
  });
}

const metadataObj = {
  sent_by_admin: adminId,
  admin_message_type: type,
  target_user_id: target_user_id || null,
  notify_both: notify_both || false
};

// Tạo tin nhắn cho receiver chính
const systemMessage = await models.ChatMessage.create({
  consultation_id: consultation.id,
  sender_id: adminId,
  sender_type: 'system',
  receiver_id: receiverId,
  message_type: 'system',
  content: message,
  is_system_message: true,
  is_read: false,
  metadata: metadataObj
});

// Nếu notify_both: tạo thêm tin nhắn cho bác sĩ
if (notify_both && consultation.doctor?.id && consultation.doctor.id !== receiverId) {
  await models.ChatMessage.create({
    consultation_id: consultation.id,
    sender_id: adminId,
    sender_type: 'system',
    receiver_id: consultation.doctor.id,
    message_type: 'system',
    content: message,
    is_system_message: true,
    is_read: false,
    metadata: metadataObj
  });
}

    const payload = {
      id: systemMessage.id,
      consultation_id: consultation.id,
      consultation_code: consultation.consultation_code,
      message: message,
      message_type: 'system',
      sender_id: adminId,
      target_user_id: target_user_id || null,
      notify_both: notify_both || false,
      sent_at: systemMessage.created_at || new Date().toISOString()
    };

    // Broadcast tới phòng tư vấn qua WebSocket
    if (global.wsBroadcastToConsultation) {
      global.wsBroadcastToConsultation(consultation.id, {
        type: 'system_message',
        payload
      });
    }

    // Nếu notify_both: broadcast thêm cho bác sĩ
    if (notify_both && consultation.doctor?.id) {
      if (global.wsBroadcastToUser) {
        global.wsBroadcastToUser(consultation.doctor.id, {
          type: 'system_message',
          payload
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Gửi tin nhắn hệ thống thành công',
      data: payload
    });

  } catch (error) {
    console.error('Error in sendSystemMessage:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi tin nhắn hệ thống',
      error: error.message
    });
  }
};

/**
 * Kết thúc phiên thủ công (emergency)
 * PUT /api/consultations/admin/realtime/:id/force-end
 */
exports.forceEndConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const consultation = await models.Consultation.findOne({
      where: { consultation_code: id }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn'
      });
    }

    if (consultation.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể kết thúc phiên đang hoạt động'
      });
    }

    // Cập nhật trạng thái
    consultation.status = 'completed';
    consultation.ended_at = new Date();
    consultation.metadata = {
      ...consultation.metadata,
      force_ended_by_admin: adminId,
      force_end_reason: reason,
      force_ended_at: new Date()
    };
    await consultation.save();

    // Gửi thông báo
    await models.ChatMessage.createSystemMessage(
      id,
      `Buổi tư vấn đã được kết thúc bởi quản trị viên. Lý do: ${reason || 'Không rõ'}`,
      { admin_action: true }
    );

    // Thông báo qua WebSocket — dùng consultation.id (số), không phải code
    if (global.wsBroadcastToConsultation) {
      global.wsBroadcastToConsultation(consultation.id, {
        type: 'consultation_ended',
        payload: {
          ended_by: 'admin',
          reason
        }
      });
    }

    // Đồng thời notify riêng patient và doctor nếu họ không ở trong phòng
    if (global.wsSendToUser) {
      global.wsSendToUser(consultation.patient_id, {
        type: 'consultation_ended',
        payload: { ended_by: 'admin', reason }
      });
      global.wsSendToUser(consultation.doctor_id, {
        type: 'consultation_ended',
        payload: { ended_by: 'admin', reason }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Kết thúc phiên tư vấn thành công',
      data: consultation
    });

  } catch (error) {
    console.error('Error in forceEndConsultation:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi kết thúc phiên tư vấn',
      error: error.message
    });
  }
};

// ==================== 3. QUẢN LÝ GÓI DỊCH VỤ ====================

/**
 * Lấy danh sách gói dịch vụ của tất cả bác sĩ
 * GET /api/consultations/admin/packages
 */
/**
 * Lấy danh sách gói dịch vụ (Logic B)
 * GET /api/consultations/admin/packages
 */
exports.getAllPackages = async (req, res) => {
  try {
    const { 
      is_active, 
      package_type,
      search,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      order = 'DESC'
    } = req.query;

    const whereClause = {};
    if (is_active !== undefined) whereClause.is_active = is_active === 'true';
    if (package_type && package_type !== 'all') whereClause.package_type = package_type;
    
    if (search) {
      whereClause[Op.or] = [
        { package_name: { [Op.like]: `%${search}%` } },
        { package_code: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: packages } = await models.ConsultationPricing.findAndCountAll({
      where: whereClause,
      // Đã xóa include: [ models.User ] vì không còn doctor_id
      order: [[sort_by, order]],
      limit: parseInt(limit),
      offset: offset,
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách gói dịch vụ thành công',
      data: {
        packages,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error in getAllPackages (Logic B):', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách gói dịch vụ',
      error: error.message
    });
  }
};

/**
 * Cập nhật gói dịch vụ của bác sĩ (Admin)
 * PUT /api/consultations/admin/packages/:doctorId
 */
exports.updateDoctorPackage = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const updateData = req.body;

    let pricing = await models.ConsultationPricing.findOne({
      where: { doctor_id: doctorId }
    });

    if (!pricing) {
      // Tạo mới nếu chưa có
      pricing = await models.ConsultationPricing.create({
        doctor_id: doctorId,
        ...updateData
      });
    } else {
      // Cập nhật
      await pricing.update(updateData);
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật gói dịch vụ thành công',
      data: pricing
    });

  } catch (error) {
    console.error('Error in updateDoctorPackage:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật gói dịch vụ',
      error: error.message
    });
  }
};

/**
 * Tạo gói dịch vụ mới (Admin)
 * POST /api/consultations/admin/packages
 */
exports.createPackage = async (req, res) => {
  try {
    const {
      package_name,
      description,
      package_type, // <-- MỚI
      duration_minutes, // <-- MỚI
      price, // <-- MỚI
      notes,
      is_active = true
    } = req.body;

    // Validation
    if (!package_name) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên gói dịch vụ'
      });
    }

    if (!package_type || !['chat', 'video', 'offline'].includes(package_type)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn hình thức tư vấn hợp lệ'
      });
    }
    
    if (!duration_minutes || parseInt(duration_minutes) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập thời lượng hợp lệ (phút)'
      });
    }
    
    if (price === undefined || parseFloat(price) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập giá tiền hợp lệ'
      });
    }

    // Tạo package code tự động
    const packageCode = `PKG${Date.now()}`;

    const newPackage = await models.ConsultationPricing.create({
      package_name,
      package_code: packageCode,
      description,
      package_type,
      duration_minutes: parseInt(duration_minutes),
      price: parseFloat(price),
      notes,
      is_active
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo gói dịch vụ thành công',
      data: newPackage
    });

  } catch (error) {
    console.error('Error in createPackage (Logic B):', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo gói dịch vụ',
      error: error.message
    });
  }
};

/**
 * Cập nhật gói dịch vụ (Admin)
 * PUT /api/consultations/admin/packages/:id
 */
exports.updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const pkg = await models.ConsultationPricing.findByPk(id);
    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gói dịch vụ'
      });
    }

    // Validation (nếu có)
    if (updateData.package_type && !['chat', 'video', 'offline'].includes(updateData.package_type)) {
      return res.status(400).json({
        success: false,
        message: 'Hình thức tư vấn không hợp lệ'
      });
    }

    await pkg.update(updateData);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật gói dịch vụ thành công',
      data: pkg
    });

  } catch (error) {
    console.error('Error in updatePackage (Logic B):', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật gói dịch vụ',
      error: error.message
    });
  }
};

/**
 * Xóa gói dịch vụ (Admin)
 * DELETE /api/consultations/admin/packages/:id
 */
exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;

    const package = await models.ConsultationPricing.findByPk(id);
    if (!package) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gói dịch vụ'
      });
    }

    // Kiểm tra xem có consultation nào đang dùng package này không
    let consultationCount = 0;
    
    // Chỉ kiểm tra nếu gói này được gán cho một bác sĩ cụ thể
    if (package.doctor_id) { 
      consultationCount = await models.Consultation.count({
        where: { consultation_pricing_id: id }// <-- SỬA LỖI Ở ĐÂY
      });
    }

    if (consultationCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa gói dịch vụ này vì có ${consultationCount} tư vấn đang sử dụng`
      });
    }

    await package.destroy();

    return res.status(200).json({
      success: true,
      message: 'Xóa gói dịch vụ thành công'
    });

  } catch (error) {
    console.error('Error in deletePackage:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa gói dịch vụ',
      error: error.message
    });
  }
};

// ==================== 4. QUẢN LÝ HOÀN TIỀN ====================

/**
 * Lấy danh sách giao dịch cần hoàn tiền
 * GET /api/consultations/admin/refunds
 */
exports.getRefundList = async (req, res) => {
  try {
    const {
      status = 'pending',
      payment_method,
      date_from,
      date_to,
      page = 1,
      limit = 20
    } = req.query;

    const whereClause = {
      status: 'cancelled'
    };

    // Chỉ lấy những consultation đã thanh toán và cần hoàn tiền
    const consultations = await models.Consultation.findAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['id', 'full_name', 'phone', 'email']
        },
        {
          model: models.User,
          as: 'doctor',
          attributes: ['id', 'full_name']
        },
        {
        model: models.Payment,
        as: 'payments', // ← THÊM DÒNG NÀY
        where: {
            status: status === 'refunded' ? 'refunded' : ['paid', 'refunded']
        },
        required: true
        }
      ],
      order: [['cancelled_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách hoàn tiền thành công',
      data: {
        refunds: consultations
      }
    });

  } catch (error) {
    console.error('Error in getRefundList:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách hoàn tiền',
      error: error.message
    });
  }
};


/**
 * Admin/Staff: Cập nhật thông tin thanh toán cho Consultation
 * Body: { payment_method, paid_at }
 * PUT /api/consultations/:id/payment
 */
exports.updatePaymentInfo = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params; // Đây là consultation id hoặc code
    const { payment_status, payment_method, paid_at } = req.body;

    // Validate payment_status if provided
    const validPaymentStatuses = ['unpaid', 'paid_online', 'paid_at_clinic', 'not_required', 'refunded', 'partial_refund'];
    if (payment_status && !validPaymentStatuses.includes(payment_status)) {
      await t.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Trạng thái thanh toán không hợp lệ. Phải là một trong: ${validPaymentStatuses.join(', ')}` 
      });
    }

    // Tìm bằng consultation_code hoặc id
    let consultation = await models.Consultation.findOne({ where: { consultation_code: id }, transaction: t });
    if (!consultation && !isNaN(id)) consultation = await models.Consultation.findByPk(id, { transaction: t });
    if (!consultation) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tư vấn' });
    }

    const updates = {};
    if (payment_status !== undefined) updates.payment_status = payment_status;
    if (payment_method !== undefined) updates.payment_method = payment_method;
    if (paid_at) updates.paid_at = new Date(paid_at);
    // If marking as paid, set paid_at to now if not provided
    if ((payment_status === 'paid_online' || payment_status === 'paid_at_clinic') && !paid_at && !consultation.paid_at) {
      updates.paid_at = new Date();
    }

    await consultation.update(updates, { transaction: t });

    // Tạo hoặc cập nhật Payment
    let payment = await models.Payment.findOne({ where: { consultation_id: consultation.id }, transaction: t });
    const paymentData = {
      user_id: consultation.patient_id || 1,
      consultation_id: consultation.id,
      amount: consultation.total_fee || 0,
      method: payment_method || (payment ? payment.method : null),
      status: (payment_status === 'paid_online' || payment_status === 'paid_at_clinic') ? 'paid' : (payment ? payment.status : 'pending'),
      transaction_id: payment ? payment.transaction_id : null,
      payment_info: JSON.stringify({ updated_by: req.user.id, note: 'Admin/Staff manual update' })
    };
    if (payment) {
      await payment.update(paymentData, { transaction: t });
    } else {
      await models.Payment.create(paymentData, { transaction: t });
    }

    await t.commit();
    res.json({ success: true, message: 'Cập nhật thanh toán tư vấn thành công', data: consultation });
  } catch (error) {
    await t.rollback();
    console.error('Error updatePaymentInfo (consultation):', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thanh toán tư vấn' });
  }
};

/**
 * Xử lý hoàn tiền (Admin)
 * POST /api/consultations/admin/refunds/:id/process
 */
exports.processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { refund_amount, refund_reason } = req.body;
    const adminId = req.user.id;

    const consultation = await models.Consultation.findByPk(id, {
      include: [
        {
          model: models.Payment,
          where: { status: 'paid' },
          required: true
        }
      ]
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn hoặc chưa thanh toán'
      });
    }

    const payment = consultation.Payment;

    // KIỂM TRA BẢO MẬT: Không hoàn tiền cho giao dịch 0đ
  if (!payment || payment.amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Không thể hoàn tiền cho giao dịch miễn phí (0đ) hoặc không tìm thấy thanh toán'
    });
  }
    
    // Xác định số tiền hoàn
    const amountToRefund = refund_amount || payment.amount;

    let refundResult;

    // Gọi API hoàn tiền theo phương thức thanh toán
    if (payment.method === 'momo') {
      refundResult = await momoService.createRefund({
        orderId: payment.code,
        transId: payment.transaction_id,
        amount: amountToRefund,
        description: refund_reason || 'Hoàn tiền tư vấn'
      });
    } else if (payment.method === 'vnpay') {
      refundResult = await vnpayService.createRefund({
        orderId: payment.code,
        transactionNo: payment.transaction_id,
        amount: amountToRefund,
        refundAmount: amountToRefund,
        transactionType: '02', // Hoàn toàn bộ
        user: req.user.username || 'admin'
      });
    } else {
      // Thanh toán tiền mặt - chỉ cập nhật trạng thái
      refundResult = { success: true };
    }

    if (refundResult.success) {
      // Cập nhật trạng thái payment
      payment.status = 'refunded';
      payment.metadata = {
        ...payment.metadata,
        refund_amount: amountToRefund,
        refund_reason,
        refunded_by: adminId,
        refunded_at: new Date(),
        refund_result: refundResult
      };
      await payment.save();

      // Cập nhật consultation
      consultation.metadata = {
        ...consultation.metadata,
        refund_processed: true,
        refund_amount: amountToRefund
      };
      await consultation.save();

      await models.Notification.create({
      user_id: consultation.patient_id,
      type: 'appointment',
      message: `✅ Hoàn tiền thành công cho lịch tư vấn (Mã: ${consultation.consultation_code}).`,
      link: `/tu-van/${consultation.id}`,
      is_read: false
    });

      return res.status(200).json({
        success: true,
        message: 'Hoàn tiền thành công',
        data: {
          consultation,
          payment,
          refund_amount: amountToRefund
        }
      });
    } else {
      throw new Error(refundResult.message || 'Hoàn tiền thất bại');
    }

  } catch (error) {
    console.error('Error in processRefund:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý hoàn tiền',
      error: error.message
    });
  }
};

// ==================== 5. QUẢN LÝ PHẢN HỒI & ĐÁNH GIÁ ====================

/**
 * Lấy danh sách đánh giá
 * GET /api/consultations/admin/feedbacks
 */
exports.getAllFeedbacks = async (req, res) => {
  try {
    const {
      doctor_id,
      rating,
      status, 
      type,
      page = 1,
      limit = 20
    } = req.query;

    const whereClause = {
      // CHỈ LẤY CÁC LỊCH HẸN ĐÃ ĐƯỢC ĐÁNH GIÁ
      rating: { [Op.ne]: null } 
    };

    if (req.user.role === 'doctor') {
      // Bác sĩ chỉ xem đánh giá của chính mình
      whereClause.doctor_id = req.user.id;
    } 
    else if (req.user.role === 'staff') {
      // Staff xem theo filter (hoặc logic quản lý nếu có)
      if (doctor_id) whereClause.doctor_id = doctor_id;
    }
    else {
      // Admin xem theo filter
      if (doctor_id) whereClause.doctor_id = doctor_id;
    }

    // THÊM MỚI: Lọc theo loại (chat/video)
    if (type && type !== 'all') {
      whereClause.consultation_type = type;
    }
    
    if (doctor_id) whereClause.doctor_id = doctor_id;
    
    // Sửa lỗi 'NaN'
    if (rating && rating !== 'all') {
      whereClause.rating = parseInt(rating);
    }
    
    // Bỏ qua filter 'status' (pending, approved) vì chúng ta đọc từ bảng consultations

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // SỬA LẠI: Đọc trực tiếp từ models.Consultation
    const { count, rows: feedbacks } = await models.Consultation.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: 'patient', // Lấy thông tin Bệnh nhân
          attributes: ['id', 'full_name', 'avatar_url']
        },
        {
          model: models.User,
          as: 'doctor', // Lấy thông tin Bác sĩ
          attributes: ['id', 'full_name', 'avatar_url'],
          include: [
            {
              model: models.Doctor,
              attributes: ['specialty_id'],
              include: [
                {
                  model: models.Specialty,
                  as: 'specialty',
                  attributes: ['name']
                }
              ]
            }
          ]
        }
        // Không cần include 'consultation' nữa vì chúng ta đang ở chính nó
      ],
      order: [['updated_at', 'DESC']], // Sắp xếp theo ngày đánh giá (cập nhật)
      limit: parseInt(limit),
      offset: offset
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đánh giá từ bảng Consultations thành công',
      data: {
        feedbacks, // Dữ liệu bây giờ là danh sách các Consultations đã được đánh giá
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error in getAllFeedbacks:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách đánh giá',
      error: error.message
    });
  }
};


// ==================== 6. BÁO CÁO & THỐNG KÊ ====================

/**
 * Thống kê tổng quan hệ thống
 * GET /api/consultations/admin/statistics/overview
 */
exports.getSystemStatistics = async (req, res) => {
  try {
    const { date_from, date_to, type } = req.query; // Thêm type nếu chưa có

    const whereClause = {};
    
    // [LOGIC MỚI] NẾU LÀ BÁC SĨ -> CHỈ THỐNG KÊ CỦA MÌNH
    if (req.user.role === 'doctor') {
      whereClause.doctor_id = req.user.id;
    }
    if (date_from || date_to) {
      whereClause.created_at = {};
      if (date_from) whereClause.created_at[Op.gte] = new Date(date_from);
      if (date_to) whereClause.created_at[Op.lte] = new Date(date_to);
    }

    // SỬA: Thêm đoạn này
    if (type && type !== 'all') {
      whereClause.consultation_type = type;
    }

    // Tổng số tư vấn
    const totalConsultations = await models.Consultation.count({ where: whereClause });

    // Theo trạng thái
    const byStatus = await models.Consultation.findAll({
      where: whereClause,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // Theo loại
    const byType = await models.Consultation.findAll({
      where: whereClause,
      attributes: [
        'consultation_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['consultation_type'],
      raw: true
    });

    // Doanh thu
    // SỬA: Đổi models.Payment -> models.Consultation và các cột tương ứng
    const revenue = await models.Consultation.sum('total_fee', {
      where: {
        payment_status: 'paid', // SỬA: status -> payment_status
        ...whereClause
      }
    });

    // Tỷ lệ hoàn tiền
    // SỬA: Đổi models.Payment -> models.Consultation
    const totalRefunded = await models.Consultation.count({
      where: {
        payment_status: 'refunded', // SỬA: status -> payment_status
        ...whereClause
      }
    });
    
    // SỬA: Đổi models.Payment -> models.Consultation
    const totalPaid = await models.Consultation.count({
      where: {
        payment_status: ['paid', 'refunded'], // SỬA: status -> payment_status
        ...whereClause
      }
    });

    const refundRate = totalPaid > 0 ? ((totalRefunded / totalPaid) * 100).toFixed(2) : 0;

    // Đánh giá trung bình
    const avgRating = await models.Consultation.findOne({
      where: {
        ...whereClause,
        rating: { [Op.ne]: null } // Chỉ tính các tư vấn có đánh giá
      },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_reviews']
      ],
      raw: true
    });

    const ratingBreakdown = await models.Consultation.findAll({
      where: {
        ...whereClause,
        rating: { [Op.ne]: null }
      },
      attributes: [
        'rating',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['rating'],
      order: [['rating', 'ASC']],
      raw: true
    });

    // Gói được đặt nhiều nhất
    const topPackage = await models.Consultation.findAll({
      where: whereClause,
      attributes: [
            'consultation_type',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['consultation_type'],
          order: [[sequelize.literal('count'), 'DESC']],
          limit: 1,
      raw: true
    });

    // Thời gian cao điểm
    const peakHours = await models.Consultation.findAll({
    where: whereClause,
    attributes: [
      [sequelize.fn('HOUR', sequelize.col('appointment_time')), 'hour'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: [sequelize.fn('HOUR', sequelize.col('appointment_time'))],
      limit: 3,
      raw: true
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy thống kê thành công',
      data: {
        total_consultations: totalConsultations,
        by_status: byStatus,
        by_type: byType,
        total_revenue: revenue || 0,
        refund_rate: parseFloat(refundRate),
        avg_rating: parseFloat(avgRating?.avg_rating || 0).toFixed(1),
        total_reviews: avgRating?.total_reviews || 0,
        rating_breakdown: ratingBreakdown,
        top_package: topPackage[0] || null,
        peak_hours: peakHours
      }
    });

  } catch (error) {
    console.error('Error in getSystemStatistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê',
      error: error.message
    });
  }
};

/**
 * Thống kê theo bác sĩ
 * GET /api/consultations/admin/statistics/by-doctor
 */
exports.getDoctorStatistics = async (req, res) => {
  try {
    const { date_from, date_to, page = 1, limit = 10 } = req.query;

    const whereClause = {};
    if (date_from || date_to) {
      whereClause.created_at = {};
      if (date_from) whereClause.created_at[Op.gte] = new Date(date_from);
      if (date_to) whereClause.created_at[Op.lte] = new Date(date_to);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // ✅ THÊM: Logic lọc bác sĩ
    const userCondition = { role: 'doctor' };
    if (req.user.role === 'doctor') {
      userCondition.id = req.user.id; // Bác sĩ chỉ xem được thống kê của chính mình
    }

    const doctors = await models.User.findAll({
      where: userCondition, // <-- Thay đổi ở đây
      attributes: ['id', 'full_name', 'avatar_url'],
      include: [
        {
          model: models.Doctor,
          attributes: ['specialty_id'],
          include: [
            {
              model: models.Specialty,
              as: 'specialty',
              attributes: ['name']
            }
          ]
        },
        {
          model: models.Consultation,
          as: 'doctor_consultations',
          where: whereClause,
          required: false,
          attributes: []
        }
      ],
      group: ['User.id'],
      subQuery: false,
      limit: parseInt(limit),
      offset: offset
    });

    // Lấy thống kê chi tiết cho từng bác sĩ
    const doctorStats = await Promise.all(
      doctors.map(async (doctor) => {
        const [consultations, feedbackStats] = await Promise.all([
          models.Consultation.findAll({
            where: {
              doctor_id: doctor.id,
              ...whereClause
            },
            attributes: [
              'status',
              [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['status'],
            raw: true
          }),
          models.Rating.getDoctorStats(doctor.id)
        ]);

        const totalConsultations = consultations.reduce((sum, item) => sum + parseInt(item.count), 0);
        const completed = consultations.find(c => c.status === 'completed')?.count || 0;
        const cancelled = consultations.find(c => c.status === 'cancelled')?.count || 0;

        return {
          doctor: doctor.toJSON(),
          total_consultations: totalConsultations,
          completed: parseInt(completed),
          cancelled: parseInt(cancelled),
          completion_rate: totalConsultations > 0 ? ((completed / totalConsultations) * 100).toFixed(2) : 0,
          avg_rating: parseFloat(feedbackStats.avg_rating || 0).toFixed(1),
          total_reviews: feedbackStats.total_reviews || 0
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Lấy thống kê bác sĩ thành công',
      data: {
        doctors: doctorStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error in getDoctorStatistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê bác sĩ',
      error: error.message
    });
  }
};

/**
 * Thống kê theo bệnh nhân
 * GET /api/consultations/admin/statistics/by-patient
 */
exports.getPatientStatistics = async (req, res) => {
  try {
    const { date_from, date_to, page = 1, limit = 10 } = req.query;

    const whereClause = {};
    if (date_from || date_to) {
      whereClause.created_at = {};
      if (date_from) whereClause.created_at[Op.gte] = new Date(date_from);
      if (date_to) whereClause.created_at[Op.lte] = new Date(date_to);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const patients = await models.Consultation.findAll({
      where: whereClause,
      attributes: [
        'patient_id',
        [sequelize.fn('COUNT', sequelize.col('Consultation.id')), 'total_consultations'],
        [sequelize.fn('SUM', sequelize.col('total_fee')), 'total_spent']
      ],
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['id', 'full_name', 'phone', 'email']
        }
      ],
      group: ['patient_id'],
      order: [[sequelize.literal('total_consultations'), 'DESC']],
      limit: parseInt(limit),
      offset: offset,
      subQuery: false
    });

    // Lấy gói phổ biến của mỗi bệnh nhân
    const patientStats = await Promise.all(
      patients.map(async (patient) => {
        const mostUsedPackage = await models.Consultation.findOne({
          where: {
            patient_id: patient.patient_id,
            ...whereClause
          },
          attributes: [
        [sequelize.fn('HOUR', sequelize.col('appointment_time')), 'hour'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.fn('HOUR', sequelize.col('appointment_time'))],
      order: [[sequelize.literal('count'), 'DESC']],
          limit: 1,
          raw: true
        });

        return {
          ...patient.toJSON(),
          most_used_package: mostUsedPackage?.consultation_type || 'N/A'
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Lấy thống kê bệnh nhân thành công',
      data: {
        patients: patientStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error in getPatientStatistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê bệnh nhân',
      error: error.message
    });
  }
};

// ==================== 7. EXPORT DỮ LIỆU ====================

/**
 * Export danh sách tư vấn ra Excel
 * GET /api/consultations/admin/export
 */
exports.exportConsultations = async (req, res) => {
  try {
    // TODO: Implement export to Excel using xlsx library
    // Tạm thời trả về JSON

    const consultations = await models.Consultation.findAll({
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['full_name', 'phone', 'email']
        },
        {
          model: models.User,
          as: 'doctor',
          attributes: ['full_name']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      message: 'Export dữ liệu thành công',
      data: consultations
    });

  } catch (error) {
    console.error('Error in exportConsultations:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi export dữ liệu',
      error: error.message
    });
  }
};

// ==================== 8. HÀNH ĐỘNG CỦA ADMIN (MỚI) ====================

/**
 * Admin/Staff phê duyệt lịch tư vấn
 * PUT /api/consultations/admin/realtime/:id/approve
 */
exports.approveConsultation = async (req, res) => {
  try {
    const { id } = req.params; // 'id' ở đây là consultation_code (ví dụ CS123...)
    const adminId = req.user.id;
    
    // SỬA: Tìm theo consultation_code
    const consultation = await models.Consultation.findOne({
      where: { consultation_code: id }
    });

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tư vấn' });
    }

    // --- BẮT ĐẦU SỬA: THÊM CHECK QUYỀN STAFF ---
    if (req.user.role === 'staff') {
      const staffProfile = await models.Staff.findOne({ where: { user_id: req.user.id } });
      
      if (!staffProfile) {
         return res.status(403).json({ success: false, message: 'Không tìm thấy hồ sơ nhân viên.' });
      }

      // Parse JSON managed_doctors an toàn
      let managedData = staffProfile.managed_doctors;
      if (typeof managedData === 'string') {
        try { managedData = JSON.parse(managedData); } catch (e) { managedData = { doctor_ids: [] }; }
      }
      
      const managedIds = (managedData?.doctor_ids || []).map(id => Number(id));
      const consultationDoctorId = Number(consultation.doctor_id); // doctor_id trong bảng Consultations là User ID (nếu model thiết kế vậy) hoặc Doctor ID.
      // LƯU Ý QUAN TRỌNG: Trong Consultation model, doctor_id thường là User ID của bác sĩ.
      // Cần kiểm tra xem managed_doctors lưu User ID hay Doctor ID.
      // Giả sử hệ thống nhất quán dùng User ID cho các quan hệ này.
      // Nếu managed_doctors lưu Doctor ID (bảng doctors), ta cần query thêm để lấy User ID.
      
      // Cách an toàn nhất: Kiểm tra cả 2 (nếu managedIds chứa UserID của bác sĩ)
      // Hoặc query Doctor model để lấy ID chính xác.
      
      // Giả định: managed_doctors lưu User ID của bác sĩ (để nhất quán với bảng Users)
      // Nếu managed_doctors lưu Doctor ID (bảng doctors), cần sửa lại logic này một chút.
      
      if (!managedIds.includes(consultationDoctorId)) {
          // Fallback: Thử tìm Doctor ID từ User ID này
          const doctorRecord = await models.Doctor.findOne({ where: { user_id: consultationDoctorId } });
          if (!doctorRecord || !managedIds.includes(doctorRecord.id)) {
             return res.status(403).json({ 
               success: false, 
               message: 'Bạn không có quyền quản lý bác sĩ của ca tư vấn này.' 
             });
          }
      }
    }
    // --- KẾT THÚC SỬA ---
    if (consultation.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Chỉ có thể phê duyệt tư vấn đang ở trạng thái "Chờ duyệt"' 
      });
    }

    // Cập nhật trạng thái
    consultation.status = 'confirmed';
    consultation.metadata = {
      ...consultation.metadata,
      approved_by_admin: adminId,
      approved_at: new Date()
    };
    await consultation.save();

    // --- SỬA ĐOẠN NÀY ---
    // Gửi thông báo cho Bệnh nhân
    await models.Notification.create({
      user_id: consultation.patient_id,
      type: 'appointment',
      message: `✅ Lịch tư vấn (Mã: ${consultation.consultation_code}) của bạn đã được quản trị viên phê duyệt.`,
      link: `/tu-van/${consultation.id}`,
      is_read: false
    });
    // Gửi thông báo cho Bác sĩ
    await models.Notification.create({
      user_id: consultation.doctor_id,
      type: 'appointment',
      // LỖI DO DÒNG CŨ DÙNG 'content', HÃY ĐỔI THÀNH 'message'
      message: `🗓️ Bạn có một lịch tư vấn mới (Mã: ${consultation.consultation_code}) đã được admin phê duyệt.`, 
      link: `/lich-tu-van-cua-toi`,
      is_read: false
    });
    // --- HẾT ĐOẠN SỬA ---
    return res.status(200).json({
      success: true,
      message: 'Phê duyệt tư vấn thành công',
      data: consultation
    });

  } catch (error) {
    console.error('Error in approveConsultation:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi phê duyệt tư vấn',
      error: error.message
    });
  }
};

/**
 * Admin/Staff từ chối lịch tư vấn
 * PUT /api/consultations/admin/realtime/:id/reject
 */
exports.rejectConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id; // <--- THÊM DÒNG NÀY ĐỂ KHAI BÁO adminId

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do từ chối' });
    }

    const consultation = await models.Consultation.findOne({
      where: { consultation_code: id }
    });

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tư vấn' });
    }

    // --- BẮT ĐẦU SỬA: THÊM CHECK QUYỀN STAFF ---
    if (req.user.role === 'staff') {
      const staffProfile = await models.Staff.findOne({ where: { user_id: req.user.id } });
      if (!staffProfile) return res.status(403).json({ success: false, message: 'Không tìm thấy hồ sơ nhân viên.' });

      let managedData = staffProfile.managed_doctors;
      if (typeof managedData === 'string') {
        try { managedData = JSON.parse(managedData); } catch (e) { managedData = { doctor_ids: [] }; }
      }
      const managedIds = (managedData?.doctor_ids || []).map(id => Number(id));
      const consultationDoctorId = Number(consultation.doctor_id);

      // Check quyền
      if (!managedIds.includes(consultationDoctorId)) {
          const doctorRecord = await models.Doctor.findOne({ where: { user_id: consultationDoctorId } });
          if (!doctorRecord || !managedIds.includes(doctorRecord.id)) {
             return res.status(403).json({ 
               success: false, 
               message: 'Bạn không có quyền quản lý bác sĩ của ca tư vấn này.' 
             });
          }
      }
    }
    // --- KẾT THÚC SỬA ---

    if (consultation.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Chỉ có thể từ chối tư vấn đang ở trạng thái "Chờ duyệt"' 
      });
    }

    // Cập nhật trạng thái
    consultation.status = 'rejected';
    consultation.cancel_reason = reason;
    consultation.cancelled_by = 'admin';
    consultation.cancelled_at = new Date();
    consultation.metadata = {
      ...consultation.metadata,
      rejected_by_admin: adminId
    };
    await consultation.save();

    // --- SỬA ĐOẠN NÀY ---
    // Gửi thông báo cho Bệnh nhân
    await models.Notification.create({
      user_id: consultation.patient_id,
      type: 'system',
      // ĐỔI 'content' THÀNH 'message'
      message: `🚫 Lịch tư vấn (Mã: ${consultation.consultation_code}) của bạn đã bị từ chối. Lý do: ${reason}`,
      link: `/tu-van/lich-su`,
      is_read: false
    });
    // --- HẾT ĐOẠN SỬA ---

    return res.status(200).json({
      success: true,
      message: 'Từ chối tư vấn thành công',
      data: consultation
    });

  } catch (error) {
    console.error('Error in rejectConsultation:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi từ chối tư vấn',
      error: error.message
    });
  }
};

/**
 * Admin hủy lịch hẹn đã xác nhận (MỚI)
 * PUT /api/consultations/admin/realtime/:id/cancel-confirmed
 */
exports.cancelConfirmedConsultation = async (req, res) => {
  try {
    const { id } = req.params; // 'id' này là consultation_code (ví dụ: CS176...)
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do hủy lịch' });
    }

    const consultation = await models.Consultation.findOne({
      where: { consultation_code: id }
    });

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tư vấn' });
    }

    if (consultation.status !== 'confirmed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Chỉ có thể hủy lịch hẹn đang ở trạng thái "Đã xác nhận"' 
      });
    }

    // Kiểm tra điều kiện 24 giờ
    const now = new Date();
    const appointmentTime = new Date(consultation.appointment_time);
    const hoursDifference = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursDifference < 24) {
       return res.status(400).json({ 
        success: false, 
        message: 'Không thể hủy lịch hẹn cận giờ (ít hơn 24 giờ)' 
      });
    }

    // Cập nhật trạng thái
    consultation.status = 'cancelled'; // Chuyển sang "Đã hủy"
    consultation.cancel_reason = reason;
    consultation.cancelled_by = 'admin';
    consultation.cancelled_at = new Date();
    consultation.metadata = {
      ...consultation.metadata,
      cancelled_by_admin: adminId
    };
    await consultation.save();

    // --- SỬA ĐOẠN NÀY ---
    // Gửi thông báo cho Bệnh nhân
    await models.Notification.create({
      user_id: consultation.patient_id,
      type: 'system',
      // ĐỔI 'content' THÀNH 'message'
      message: `❌ Lịch tư vấn (Mã: ${consultation.consultation_code}) đã bị Admin hủy. Lý do: ${reason}`,
      link: `/tu-van/lich-su`,
      is_read: false
    });

    // Gửi thông báo cho Bác sĩ
    await models.Notification.create({
      user_id: consultation.doctor_id,
      type: 'system',
      // ĐỔI 'content' THÀNH 'message'
      message: `❌ Lịch tư vấn (Mã: ${consultation.consultation_code}) của bạn đã bị Admin hủy. Lý do: ${reason}`,
      link: `/lich-tu-van-cua-toi`,
      is_read: false
    });
    // --- HẾT ĐOẠN SỬA ---
    return res.status(200).json({
      success: true,
      message: 'Hủy lịch hẹn thành công. Nếu lịch có phí, nút hoàn tiền sẽ xuất hiện.',
      data: consultation
    });

  } catch (error) {
    console.error('Error in cancelConfirmedConsultation:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi hủy lịch hẹn',
      error: error.message
    });
  }
};

/**
 * MỚI: Admin lấy danh sách Sự cố đang chờ xử lý
 * GET /api/consultations/admin/realtime/incidents
 */
exports.getPendingIncidents = async (req, res) => {
  try {
    const {
      status,
      priority,
      report_type,
      date_from,
      date_to,
      page = 1,
      limit = 20
    } = req.query;

    const where = {};

    // Mặc định lấy tất cả chưa đóng nếu không truyền status
    if (status && status !== 'all') {
      where.status = status;
    } else {
      where.status = { [Op.in]: ['pending', 'acknowledged', 'investigating'] };
    }

    if (priority)    where.priority    = priority;
    if (report_type) where.report_type = report_type;
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at[Op.gte] = new Date(date_from);
      if (date_to)   where.created_at[Op.lte] = new Date(date_to);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: incidents } = await models.ConsultationReport.findAndCountAll({
      where,
      include: [
        {
          model: models.Consultation,
          as: 'consultation',
          attributes: ['id', 'consultation_code', 'consultation_type', 'appointment_time'],
          include: [
            { model: models.User, as: 'patient', attributes: ['id', 'full_name', 'email'] },
            { model: models.User, as: 'doctor',  attributes: ['id', 'full_name', 'email'] }
          ]
        },
        { model: models.User, as: 'reporter', attributes: ['id', 'full_name', 'email'] },
        { model: models.User, as: 'resolver',  attributes: ['id', 'full_name'] }
      ],
      order: [
        ['priority', 'DESC'],  // critical → high → medium → low
        ['created_at', 'ASC']
      ],
      limit:  parseInt(limit),
      offset
    });

    res.status(200).json({
      success: true,
      data: incidents,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting pending incidents:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải danh sách sự cố' });
  }
};

/**
 * MỚI: Admin xử lý (đóng) một sự cố
 * PUT /api/consultations/admin/realtime/incidents/:id/resolve
 */
exports.resolveIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_note, status = 'resolved' } = req.body;
    const adminId = req.user.id;

    const report = await models.ConsultationReport.findByPk(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy báo cáo' });
    }

    report.status = status;
    report.admin_notes = admin_note; // ✅ Sửa: admin_note → admin_notes (đúng field trong model)
    report.resolved_by = adminId;   // ✅ Sửa: reviewed_by → resolved_by (đúng field trong model)
    report.resolved_at = new Date();
    await report.save();

    // ✅ Thêm: Thông báo cho người báo cáo
    await models.Notification.create({
      user_id: report.reporter_id,
      type: 'appointment',
      message: `✅ Báo cáo sự cố của bạn đã được xử lý: ${
        status === 'resolved' ? 'Đã giải quyết' :
        status === 'investigating' ? 'Đang xử lý' :
        status === 'acknowledged' ? 'Đã tiếp nhận' : status
      }${admin_note ? '. Ghi chú: ' + admin_note : ''}`,
      link: `/lich-tu-van-cua-toi?type=reports`,
      is_read: false
    });

    // Broadcast cho tất cả admin đang mở monitor
    if (global.wsBroadcastToAdmins) {
      global.wsBroadcastToAdmins({
        type: 'incident_resolved',
        payload: { report_id: report.id, status: report.status }
      });
    }

    // Broadcast realtime cho reporter (patient/doctor đang online)
    if (global.wsSendToUser) {
      global.wsSendToUser(report.reporter_id, {
        type: 'incident_resolved',
        payload: {
          report_id: report.id,
          status,
          admin_notes: admin_note || null
        }
      });
    }

    // Broadcast cho tất cả admin/staff đang mở monitor — cập nhật list
    if (global.wsBroadcastToAdmins) {
      global.wsBroadcastToAdmins({
        type: 'incident_resolved',
        payload: {
          report_id: report.id,
          status,
          resolved_by: adminId
        }
      });
    }

    res.status(200).json({ success: true, message: 'Đã xử lý sự cố', data: report });
  } catch (error) {
    console.error('Error resolving incident:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xử lý sự cố' });
  }
};

/**
 * Update consultation workflow status (admin/staff/doctor manual override)
 * PUT /api/consultations/admin/:id/status
 * Body: { status: 'pending'|'confirmed'|'upcoming'|'in_progress'|'completed'|'passed'|'cancelled'|'rejected'|'expired' }
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status value
    const validStatuses = ['pending', 'confirmed', 'upcoming', 'in_progress', 'completed', 'passed', 'cancelled', 'rejected', 'expired'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Phải là một trong: ${validStatuses.join(', ')}`
      });
    }

    // Find consultation by ID or consultation_code
    let consultation = await models.Consultation.findOne({ where: { consultation_code: id } });
    if (!consultation && !isNaN(id)) {
      consultation = await models.Consultation.findByPk(id);
    }

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn'
      });
    }

    // Update status
    const oldStatus = consultation.status;
    consultation.status = status;
    await consultation.save();

    // Log audit trail
    console.log(`Consultation ${id} status changed: ${oldStatus} → ${status} by user ${req.user?.id}`);

    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: consultation
    });

  } catch (error) {
    console.error('ERROR in updateStatus (consultation):', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật trạng thái',
      error: error.message
    });
  }
};
/**
 * Admin lấy lịch sử chat của một phiên để xem lại trước khi reply
 * GET /api/consultations/admin/realtime/:id/messages
 */
exports.getConsultationMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    let consultation = null;
    if (!isNaN(id)) {
      consultation = await models.Consultation.findByPk(id);
    }
    if (!consultation) {
      consultation = await models.Consultation.findOne({
        where: { consultation_code: id }
      });
    }
    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tư vấn' });
    }

    const messages = await models.ChatMessage.findAll({
      where: { consultation_id: consultation.id },
      include: [
        { model: models.User, as: 'sender', attributes: ['id', 'full_name', 'avatar_url', 'role'] }
      ],
      order: [['created_at', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      success: true,
      data: messages,
      consultation: {
        id: consultation.id,
        consultation_code: consultation.consultation_code
      }
    });
  } catch (error) {
    console.error('Error getConsultationMessages:', error);
    return res.status(500).json({ success: false, message: 'Lỗi khi tải lịch sử chat' });
  }
};
