// server/models/Consultation.js
// Model quản lý buổi tư vấn (Chat với bác sĩ)

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Consultation = sequelize.define('Consultation', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    
    // ==================== THÔNG TIN CƠ BẢN ====================
    
    // Bệnh nhân
    patient_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    
    // Bác sĩ
    doctor_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    
    // Mã buổi tư vấn (duy nhất)
    consultation_code: {
      type: DataTypes.STRING(30),
      unique: true,
      allowNull: false
    },
    
    // Loại tư vấn
    consultation_type: {
      type: DataTypes.ENUM('chat', 'video', 'offline'),
      allowNull: false,
      defaultValue: 'chat',
      comment: 'chat: Chat với bác sĩ | video: Video call | offline: Tại bệnh viện'
    },
    
    // Chuyên khoa
    specialty_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'specialties',
        key: 'id'
      }
    },

    // ID của gói dịch vụ đã chọn
    consultation_pricing_id: {
      type: DataTypes.BIGINT,
      allowNull: true, // Cho phép null để tương thích với các cuộc hẹn cũ
      references: {
        model: 'consultation_pricing',
        key: 'id'
      }
    },
    
    // ==================== THỜI GIAN ====================
    
    // Thời gian đặt lịch
    appointment_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Thời gian hẹn tư vấn'
    },
    
    // Thời gian bắt đầu thực tế
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời gian bắt đầu tư vấn thực tế'
    },
    
    // Thời gian kết thúc
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời gian kết thúc tư vấn'
    },
    
    // Thời lượng (phút)
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Thời lượng tư vấn tính bằng phút'
    },
    
    // ==================== TRẠNG THÁI ====================
    
    // Trạng thái workflow (chu trình chính)
    status: {
      type: DataTypes.ENUM(
        'pending',      // Chờ xác nhận
        'confirmed',    // Đã xác nhận, chờ thanh toán/sắp tới
        'upcoming',     // Sắp diễn ra (24h trước appointment_time)
        'in_progress',  // Đang diễn ra
        'completed',    // Hoàn thành
        'passed',       // Đã qua (1 ngày sau khi kết thúc)
        'cancelled',    // Đã hủy
        'rejected',     // Bị từ chối
        'expired'       // Đã hết hạn (không được duyệt)
      ),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Trạng thái workflow: pending→confirmed→upcoming→in_progress→completed→passed'
    },
    
    // Trạng thái thanh toán (tách riêng)
    payment_status: {
      type: DataTypes.ENUM(
        'unpaid',           // Chưa thanh toán
        'paid_online',      // Đã thanh toán online
        'paid_at_clinic',   // Đã thanh toán tại phòng khám
        'not_required',     // Không yêu cầu thanh toán
        'refunded',         // Đã hoàn tiền
        'partial_refund'    // Hoàn một phần
      ),
      allowNull: false,
      defaultValue: 'unpaid',
      comment: 'Trạng thái thanh toán độc lập với workflow'
    },
    
    // Phương thức thanh toán (chi tiết)
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'momo, zalopay, vnpay, cash, bank_transfer, card, insurance'
    },
    
    // Thời gian thanh toán
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời điểm thanh toán thành công'
    },

    // Hạn thanh toán (thường = appointment_time - 30 phút)
    payment_due_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Hạn cuối cần hoàn tất thanh toán để giữ lịch tư vấn'
    },
    
    // Trạng thái hồ sơ y tế (consultation report)
    medical_record_status: {
      type: DataTypes.ENUM('no_record', 'has_record'),
      allowNull: false,
      defaultValue: 'no_record',
      comment: 'no_record: Chưa có báo cáo tư vấn | has_record: Đã có báo cáo tư vấn (consultation report)'
    },
    
    // Người hủy
    cancelled_by: {
      type: DataTypes.ENUM('patient', 'doctor', 'system', 'admin'),
      allowNull: true
    },
    
    // Lý do hủy
    cancel_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Thời gian hủy
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // ── ĐỔI LỊCH ──
    // Đã từng đổi lịch chưa (chỉ cho đổi 1 lần)
    is_rescheduled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    // Thời điểm đổi lịch
    rescheduled_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Lưu giờ gốc để hiển thị lịch sử
    original_appointment_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Lý do đổi lịch
    reschedule_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // ==================== THÔNG TIN Y TẾ ====================
    
    // Triệu chứng chính
    chief_complaint: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Triệu chứng chính của bệnh nhân'
    },
    
    // Tiền sử bệnh
    medical_history: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Tiền sử bệnh (tiểu đường, cao huyết áp...)'
    },
    
    // Thuốc đã dùng
    current_medications: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Các loại thuốc đang sử dụng'
    },
    
    // Thời gian xuất hiện triệu chứng
    symptom_duration: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Hôm nay, 2-3 ngày, >1 tuần, >1 tháng'
    },
    
    // Chẩn đoán của bác sĩ
    diagnosis: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Chẩn đoán sơ bộ của bác sĩ'
    },
    
    // Kế hoạch điều trị
    treatment_plan: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Kế hoạch điều trị, lời khuyên'
    },
    
    // Đơn thuốc
    prescription_data: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Thông tin đơn thuốc dạng JSON'
    },

    // Triệu chứng bác sĩ ghi nhận trong buổi tư vấn / kết quả tư vấn
    symptoms: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Triệu chứng / mô tả vấn đề của buổi tư vấn'
    },

    // Lời khuyên / dặn dò cho bệnh nhân
    advice: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Dặn dò, lời khuyên sau tư vấn'
    },

    // Chỉ số ghi nhận trong buổi tư vấn (nếu có)
    vitals_json: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Dữ liệu chỉ số / sinh hiệu dạng JSON'
    },

    // Ghi chú lâm sàng
    clinical_note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Ghi chú lâm sàng của bác sĩ'
    },

    // Chỉ định dịch vụ phụ trong buổi tư vấn
    service_indications: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Danh sách dịch vụ phụ / chỉ định'
    },

    // Ảnh xét nghiệm / file minh chứng
    test_images_json: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Danh sách ảnh xét nghiệm'
    },

    // File báo cáo / tài liệu đính kèm
    report_files_json: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Danh sách file báo cáo/tài liệu'
    },

    // Snapshot toàn bộ kết quả tư vấn để bệnh nhân xem lại đầy đủ
    result_snapshot: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Toàn bộ dữ liệu kết quả tư vấn dạng JSON'
    },
    
    // Mức độ nghiêm trọng
    severity_level: {
      type: DataTypes.ENUM('normal', 'moderate', 'urgent'),
      allowNull: true,
      defaultValue: 'normal',
      comment: 'Mức độ: Bình thường | Cần theo dõi | Khẩn cấp'
    },
    
    // Cần tái khám
    need_followup: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    
    // Ngày tái khám
    followup_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Ghi chú tái khám
    followup_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // ==================== TÀI CHÍNH ====================
    
    // Phí cơ bản
    base_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Phí tư vấn cơ bản'
    },
    
    // Phí nền tảng
    platform_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Phí nền tảng (10%)'
    },
    
    // Giảm giá
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Số tiền giảm giá từ voucher/promotion'
    },

    // Tổng phí
    total_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Tổng phí sau khi trừ discount'
    },
    
    // ID giao dịch thanh toán
    payment_transaction_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    
    // Số tiền hoàn lại
    refund_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    
    // Lý do hoàn tiền
    refund_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Thời gian hoàn tiền
    refunded_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // ==================== ĐÁNH GIÁ ====================
    
    // Đánh giá (1-5 sao)
    rating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5
      }
    },
    
    // Nội dung đánh giá
    review: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Thời gian đánh giá
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // ==================== METADATA ====================
    
    // Phòng chat/video
    room_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'ID phòng chat hoặc video call'
    },
    
    // Session chat
    chat_session_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'ID session chat'
    },
    
    // File đính kèm
    attachments: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Danh sách file đính kèm từ bệnh nhân'
    },
    
    // File từ bác sĩ
    doctor_files: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'File từ bác sĩ (đơn thuốc, hướng dẫn...)'
    },
    
    // Metadata bổ sung
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Thông tin bổ sung dạng JSON'
    },

    chat_otp: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'OTP để vào phòng chat'
    },
    
    otp_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời gian OTP hết hạn'
    },
    
    reminder_sent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Đã gửi nhắc nhở 5 phút'
    },

    // THÊM MỚI: OTP cho Video Call
    video_otp: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'OTP để vào phòng video call'
    },
    
    video_otp_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời gian OTP video hết hạn'
    },
    
    // Device info
    patient_device: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Thiết bị của bệnh nhân (web, mobile, app)'
    },
    
    doctor_device: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Thiết bị của bác sĩ'
    },
    
    // ==================== TIMESTAMPS ====================
    
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
    
  }, {
    tableName: 'consultations',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['patient_id'] },
      { fields: ['doctor_id'] },
      { fields: ['consultation_code'] },
      { fields: ['status'] },
      { fields: ['consultation_type'] },
      { fields: ['appointment_time'] },
      { fields: ['payment_status'] },
      { fields: ['payment_due_at'] },
      { fields: ['created_at'] },
      { fields: ['patient_id', 'status'] },
      { fields: ['doctor_id', 'status'] },
      { fields: ['doctor_id', 'appointment_time'] }
    ]
  });

  // ==================== ASSOCIATIONS ====================
  
  Consultation.associate = (models) => {
    // Bệnh nhân
    Consultation.belongsTo(models.User, {
      foreignKey: 'patient_id',
      as: 'patient'
    });
    
    // Bác sĩ
    Consultation.belongsTo(models.User, {
      foreignKey: 'doctor_id',
      as: 'doctor'
    });
    
    // Chuyên khoa
    Consultation.belongsTo(models.Specialty, {
      foreignKey: 'specialty_id',
      as: 'specialty'
    });
    
    // Tin nhắn chat
    Consultation.hasMany(models.ChatMessage, {
      foreignKey: 'consultation_id',
      as: 'messages'
    });
    
    // Thanh toán
    Consultation.hasMany(models.Payment, {
      foreignKey: 'consultation_id',
      as: 'payments'
    });
    
    // Buổi tư vấn này thuộc về 1 Gói dịch vụ
    Consultation.belongsTo(models.ConsultationPricing, {
      foreignKey: 'consultation_pricing_id',
      as: 'package' // Đổi tên alias từ 'pricing' thành 'package'
    });
  };

  // ==================== HOOKS ====================
  
  // Hook: Tự động tạo consultation_code
  Consultation.addHook('beforeValidate', async (consultation, options) => {
    if (!consultation.consultation_code) {
      const timestampPart = Date.now().toString(36).toUpperCase();
      const randomPart1 = Math.random().toString(36).substring(2, 8).toUpperCase();
      const randomPart2 = Math.random().toString(36).substring(2, 8).toUpperCase();
      consultation.consultation_code = `CS-${timestampPart}-${randomPart1}-${randomPart2}`;
    }
  });
  
  // Hook: Tự động tính total_fee
  Consultation.addHook('beforeSave', async (consultation, options) => {
    if (consultation.base_fee !== undefined && consultation.platform_fee !== undefined) {
      const gross = parseFloat(consultation.base_fee) + parseFloat(consultation.platform_fee);
      const discount = parseFloat(consultation.discount_amount || 0);
      consultation.total_fee = Math.max(0, gross - discount);
    }
  });
  
  // Hook: Tự động tính duration khi kết thúc
  Consultation.addHook('beforeUpdate', async (consultation, options) => {
    if (consultation.changed('ended_at') && consultation.ended_at && consultation.started_at) {
      const start = new Date(consultation.started_at);
      const end = new Date(consultation.ended_at);
      const durationMs = end - start;
      consultation.duration_minutes = Math.round(durationMs / 60000);
    }
  });

  // ==================== INSTANCE METHODS ====================
  
  // Bắt đầu tư vấn
  Consultation.prototype.start = async function() {
    this.status = 'in_progress';
    this.started_at = new Date();
    await this.save();
    
    console.log(` Consultation ${this.consultation_code} started`);
  };
  
  // Kết thúc tư vấn
  Consultation.prototype.complete = async function(doctorData) {
    this.status = 'completed';
    this.ended_at = new Date();
    
    if (doctorData) {
      this.diagnosis = doctorData.diagnosis;
      this.treatment_plan = doctorData.treatment_plan;
      this.prescription_data = doctorData.prescription_data;
      this.severity_level = doctorData.severity_level;
      this.need_followup = doctorData.need_followup;
      this.followup_date = doctorData.followup_date;
      this.followup_notes = doctorData.followup_notes;
      this.doctor_files = doctorData.doctor_files;
    }
    
    await this.save();
    
    console.log(` Consultation ${this.consultation_code} completed`);
  };
  
  // Hủy tư vấn
  Consultation.prototype.cancel = async function(cancelledBy, reason) {
    this.status = 'cancelled';
    this.cancelled_by = cancelledBy;
    this.cancel_reason = reason;
    this.cancelled_at = new Date();
    await this.save();
    
    console.log(`❌ Consultation ${this.consultation_code} cancelled by ${cancelledBy}`);
  };
  
  // Xác nhận tư vấn (bác sĩ)
  Consultation.prototype.confirm = async function() {
    this.status = 'confirmed';
    await this.save();
    
    console.log(` Consultation ${this.consultation_code} confirmed`);
  };
  
  // Từ chối tư vấn (bác sĩ)
  Consultation.prototype.reject = async function(reason) {
    this.status = 'rejected';
    this.cancel_reason = reason;
    this.cancelled_at = new Date();
    this.cancelled_by = 'doctor';
    await this.save();
    
    console.log(`❌ Consultation ${this.consultation_code} rejected`);
  };
  
  // Đánh giá tư vấn
  Consultation.prototype.addReview = async function(rating, review) {
    this.rating = rating;
    this.review = review;
    this.reviewed_at = new Date();
    await this.save();
    
    console.log(`⭐ Consultation ${this.consultation_code} rated: ${rating}/5`);
  };
  
  // Hoàn tiền
  Consultation.prototype.refund = async function(amount, reason) {
    this.payment_status = amount >= this.total_fee ? 'refunded' : 'partial_refund';
    this.refund_amount = amount;
    this.refund_reason = reason;
    this.refunded_at = new Date();
    await this.save();
    
    console.log(`💰 Consultation ${this.consultation_code} refunded: ${amount} VND`);
  };
  
  // Kiểm tra có thể bắt đầu không
  Consultation.prototype.canStart = function() {
    const now = new Date();
    const appointmentTime = new Date(this.appointment_time);
    const timeDiff = (now - appointmentTime) / 60000; // phút
    
    // Có thể bắt đầu trước 15 phút đến sau 10 phút
    return timeDiff >= -15 && timeDiff <= 10 && this.status === 'confirmed';
  };
  
  // Kiểm tra có thể hủy không
  Consultation.prototype.canCancel = function() {
    return ['pending', 'confirmed'].includes(this.status);
  };

  // ==================== CLASS METHODS ====================
  
  // Lấy tư vấn theo bệnh nhân
  Consultation.getByPatient = async function(patientId, options = {}) {
    const { status, limit = 10, offset = 0 } = options;
    
    const where = { patient_id: patientId };
    if (status) where.status = status;
    
    return await this.findAll({
      where,
      include: [
        {
          model: sequelize.models.User,
          as: 'doctor',
          attributes: ['id', 'full_name', 'avatar_url']
        },
        {
          model: sequelize.models.Specialty,
          as: 'specialty',
          attributes: ['id', 'name']
        }
      ],
      order: [['appointment_time', 'DESC']],
      limit,
      offset
    });
  };
  
  // Lấy tư vấn theo bác sĩ
  Consultation.getByDoctor = async function(doctorId, options = {}) {
    const { status, limit = 10, offset = 0 } = options;
    
    const where = { doctor_id: doctorId };
    if (status) where.status = status;
    
    return await this.findAll({
      where,
      include: [
        {
          model: sequelize.models.User,
          as: 'patient',
          attributes: ['id', 'full_name', 'avatar_url', 'phone']
        },
        {
          model: sequelize.models.Specialty,
          as: 'specialty',
          attributes: ['id', 'name']
        }
      ],
      order: [['appointment_time', 'DESC']],
      limit,
      offset
    });
  };
  
  // Đếm tư vấn theo trạng thái
  Consultation.countByStatus = async function(userId, userType = 'patient') {
    const field = userType === 'patient' ? 'patient_id' : 'doctor_id';
    
    const counts = await this.findAll({
      where: { [field]: userId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });
    
    return counts.reduce((acc, item) => {
      acc[item.status] = parseInt(item.count);
      return acc;
    }, {});
  };
  
  // Tính doanh thu theo bác sĩ
  Consultation.calculateDoctorRevenue = async function(doctorId, startDate, endDate) {
    const { Op } = require('sequelize');
    
    const result = await this.findAll({
      where: {
        doctor_id: doctorId,
        status: 'completed',
        payment_status: 'paid',
        completed_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_consultations'],
        [sequelize.fn('SUM', sequelize.col('base_fee')), 'total_revenue'],
        [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating']
      ],
      raw: true
    });
    
    return result[0];
  };
  
  // Tự động hủy tư vấn quá hạn
  Consultation.autoCancel = async function() {
    const { Op } = require('sequelize');
    const cutoffTime = new Date(Date.now() - 10 * 60 * 1000); // 10 phút trước
    
    const expiredConsultations = await this.findAll({
      where: {
        status: 'confirmed',
        appointment_time: { [Op.lt]: cutoffTime }
      }
    });
    
    for (const consultation of expiredConsultations) {
      await consultation.cancel('system', 'Tự động hủy do không vào phòng tư vấn sau 10 phút');
    }
    
    console.log(` Auto-cancelled ${expiredConsultations.length} expired consultations`);
    return expiredConsultations.length;
  };

  console.log(' Model Consultation đã được định nghĩa thành công');
  return Consultation;
};