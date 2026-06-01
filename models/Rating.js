// server/models/Rating.js
// ===== UNIFIED RATING MODEL =====
// Chứa: Đánh giá dịch vụ (appointment, consultation) + Đánh giá bác sĩ
// service_type: 'appointment' | 'consultation' | 'doctor'
// ================================================================================

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Rating = sequelize.define('Rating', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    consultation_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      references: { model: 'consultations', key: 'id' },
      onDelete: 'CASCADE',
      comment: '🔗 Consultation (nullable, dùng khi service_type=consultation)'
    },
    appointment_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: { model: 'appointments', key: 'id' },
      onDelete: 'CASCADE',
      comment: '🔗 Appointment (nullable, dùng khi service_type=appointment)'
    },
    service_type: {
      type: DataTypes.ENUM('appointment', 'consultation', 'doctor'),
      defaultValue: 'appointment',
      allowNull: false,
      comment: '📊 Loại: appointment=khám tại viện | consultation=tư vấn online | doctor=đánh giá bác sĩ'
    },
    patient_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: 'users', key: 'id' },
      comment: '👤 Bệnh nhân làm đánh giá'
    },
    doctor_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      references: { model: 'users', key: 'id' },
      comment: '👨‍⚕️ Bác sĩ được đánh giá'
    },
    rating: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      validate: { min: 1, max: 5 },
      comment: '⭐ Rating 1-5 sao'
    },
    review: { 
      type: DataTypes.TEXT, 
      allowNull: true,
      comment: '📝 Nội dung text review'
    },
    status: {
      type: DataTypes.ENUM('approved', 'hidden'),
      defaultValue: 'approved',
      comment: '✅ Trạng thái: approved=công khai | hidden=ẩn bởi admin'
    },
    admin_note: { 
      type: DataTypes.TEXT, 
      allowNull: true,
      comment: '🗒️ Ghi chú/trả lời của admin/staff/doctor'
    },
    reviewed_by: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      comment: '👤 Người duyệt/trả lời (patient_id on creation, admin/staff later)'
    },
    reviewed_at: { 
      type: DataTypes.DATE, 
      allowNull: true,
      comment: '⏰ Thời điểm tạo/duyệt'
    },
  }, {
    tableName: 'consultation_feedback',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    comment: '💬 Unified Rating table for appointments, consultations, and doctors'
  });

  Rating.associate = (models) => {
    Rating.belongsTo(models.Consultation, { 
      foreignKey: 'consultation_id', 
      as: 'consultation',
      comment: 'Rating của tư vấn online'
    });
    Rating.belongsTo(models.Appointment, {
      foreignKey: 'appointment_id',
      as: 'appointment',
      comment: 'Rating của khám tại viện'
    });
    Rating.belongsTo(models.User, { 
      foreignKey: 'patient_id', 
      as: 'patient' 
    });
    Rating.belongsTo(models.User, { 
      foreignKey: 'doctor_id', 
      as: 'doctor' 
    });
  };

  return Rating;
};
