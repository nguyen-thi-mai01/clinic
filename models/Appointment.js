// server/models/Appointment.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Appointment = sequelize.define('Appointment', {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    patient_id: { type: DataTypes.BIGINT, allowNull: true },
    doctor_id: { type: DataTypes.BIGINT, allowNull: false },
    service_id: { type: DataTypes.BIGINT, allowNull: false },
    specialty_id: { type: DataTypes.BIGINT, allowNull: true },
    staff_id: { type: DataTypes.BIGINT, allowNull: true },
    guest_email: { type: DataTypes.STRING, allowNull: true },
    guest_name: { type: DataTypes.STRING, allowNull: true },
    guest_phone: { type: DataTypes.STRING, allowNull: true },
    guest_gender: { type: DataTypes.STRING, allowNull: true },
    guest_dob: { type: DataTypes.DATEONLY, allowNull: true },
    guest_token: { type: DataTypes.STRING, allowNull: true, unique: true },
    booking_context: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Lưu ngữ cảnh đặt lịch: bản thân/người thân, quan hệ, tên người được đặt'
    },
    appointment_type: { type: DataTypes.ENUM('offline', 'online'), defaultValue: 'offline' },
    appointment_date: { type: DataTypes.DATEONLY, allowNull: false },
    appointment_start_time: { type: DataTypes.TIME, allowNull: false }, // Vẫn lưu giờ bắt đầu làm mốc (hoặc giờ bắt đầu Ca)
    appointment_end_time: { type: DataTypes.TIME, allowNull: true }, // [SỬA]: Cho phép null vì Offline không có end_time cố định
    
    // TRẠNG THÁI WORKFLOW
      // [OPTIMIZATION_V1.1] WORKFLOW STATUS - REDUCED 9→5 STATUSES
      // Deprecated status mappings (details in OPTIMIZATION_PHASE1_NOTES.md):
      // - upcoming → DEPRECATED: Calculate as (appointment_date < now+24h && status=='confirmed')
      // - waiting_pay → DEPRECATED: Use payment_status field (unpaid/paid_online/paid_at_clinic)
      // - waiting_exam → DEPRECATED: Renamed to 'in_progress' (after check-in)
      // - passed → DEPRECATED: Calculate as (appointment_date < today && status=='completed')
      // Keeps: pending, confirmed, in_progress, completed, cancelled
      status: { 
        type: DataTypes.ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled'), 
        defaultValue: 'pending',
        comment: '[OPTIMIZATION_V1.1] Simplified 5-status workflow. Dynamic: isUpcoming, isPassed'
      },
    
    // TRẠNG THÁI THANH TOÁN
    payment_status: { 
      type: DataTypes.ENUM('unpaid', 'paid_online', 'paid_at_clinic', 'not_required'), 
      defaultValue: 'unpaid'
    },
    payment_method: { type: DataTypes.STRING(50), allowNull: true },
    paid_at: { type: DataTypes.DATE, allowNull: true },
    payment_hold_until: { type: DataTypes.DATE, allowNull: true },
    
    reason: { type: DataTypes.TEXT, allowNull: true },
    cancel_reason: { type: DataTypes.TEXT, allowNull: true },
    cancelled_by: { type: DataTypes.STRING, allowNull: true },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    medical_result: { type: DataTypes.TEXT, allowNull: true },
    prescription: { type: DataTypes.TEXT, allowNull: true },
    next_appointment: { type: DataTypes.TEXT, allowNull: true },
    medical_files: { type: DataTypes.JSON, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    completed_by: { type: DataTypes.INTEGER, allowNull: true },
    code: { type: DataTypes.STRING(20), unique: true, allowNull: false },

    // --- [SỬA]: QUẢN LÝ SỐ THỨ TỰ (QUEUE SYSTEM) ---
    queue_type: {
      type: DataTypes.ENUM('priority', 'normal'),
      defaultValue: 'normal',
      comment: 'priority: Đặt lịch trước (U) | normal: Walk-in tại quầy (N)'
    },
    payment_queue_number: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    queue_number: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null }, // STT thô (số nguyên)
    display_queue: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Mã STT hiển thị, VD: U01, N02'
    },
    checked_in_at: { type: DataTypes.DATE, allowNull: true },
    // ---------------------------------------------
    
    appointment_address: { type: DataTypes.STRING, allowNull: true },
    reschedule_count: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
    medical_record_status: {
      type: DataTypes.ENUM('no_record', 'has_record'),
      defaultValue: 'no_record',
      allowNull: false
    },
    corp_window: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Mã cửa sổ đặt lịch doanh nghiệp nếu có (ví dụ: CW-2026-05-COMPANY001)'
    },
    corp_data: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Thông tin doanh nghiệp/tổ chức: { corp_name, corp_id, corp_code, window_id, reg_user_id, ... }'
    },

    // ===== [MỚI] PHỤ LỤC CẬN LÂM SÀNG & NGOẠI LỆ (Appointment Optimization) =====
    // Mảng chứa các chỉ định dịch vụ phụ (Siêu âm, Lấy máu, X-quang...)
    // Cấu trúc: [{ id, service_name, service_code, status, queue_number, order_sequence, dependencies, ... }]
    service_indications: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Mảng chỉ định dịch vụ cận lâm sàng, dùng cho multi-stop journey'
    },

    // JSON lưu các cờ ngoại lệ (late_arrival, no_show, wait_time_exceeded...)
    // Cấu trúc: { late_arrival: bool, late_minutes: int, wait_time_exceeded: bool, ... }
    edge_case_flags: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Lưu các cờ xử lý ngoại lệ (late arrival, no-show, urgency...)'
    },

    // Thời gian bệnh nhân đến thực tế (để kiểm tra late arrival)
    actual_arrival_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời gian check-in thực tế (để so sánh với appointment_start_time)'
    }
    // ========================================================================
    
  }, {
    tableName: 'appointments',
    timestamps: true,
    indexes: [
      { fields: ['patient_id'] },
      { fields: ['status'] },
      { fields: ['guest_token'] },
      { fields: ['appointment_date', 'doctor_id', 'queue_type'] } // Index hỗ trợ lấy STT
    ],
    hooks: {
      beforeValidate: async (appointment, options) => {
        if (!appointment.code) {
          const date = new Date();
          const datePart = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}`;
          let newCode = '';
          let existing = null;
          let attempts = 0;
          do {
            if (attempts < 5) {
              const randomPart = String(Math.floor(1000 + Math.random() * 9000));
              newCode = `AP-${datePart}-${randomPart}`;
            } else {
              newCode = `AP-${datePart}-${Date.now() % 100000}`;
            }
            existing = await sequelize.models.Appointment.findOne({ 
              where: { code: newCode }, 
              transaction: options.transaction 
            });
            attempts++;
          } while (existing);
          appointment.code = newCode;
        }
      }
    }
  });

  Appointment.associate = function(models) {
    Appointment.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'Patient' });
    Appointment.belongsTo(models.Doctor, { foreignKey: 'doctor_id', as: 'Doctor' });
    Appointment.belongsTo(models.Service, { foreignKey: 'service_id', as: 'Service' });
    Appointment.belongsTo(models.Specialty, { foreignKey: 'specialty_id', as: 'Specialty' });
    Appointment.hasOne(models.Payment, { foreignKey: 'appointment_id', as: 'Payment' });
    Appointment.hasOne(models.RefundRequest, { foreignKey: 'appointment_id', as: 'RefundRequest' });
    Appointment.hasOne(models.Review, { foreignKey: 'appointment_id', as: 'Review' });
    Appointment.hasOne(models.MedicalRecord, { foreignKey: 'appointment_id', as: 'MedicalRecord' });
    // ❌ BƯỚC 2: OPTIMIZE - Dùng ConsultationFeedback chung (xóa FK reviewer)
  };

  return Appointment;
};