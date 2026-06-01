// server/models/ConsultationPricing.js
// LOGIC B: Model này định nghĩa một "Gói dịch vụ" (Template)
// Ví dụ: "Gói Chat 15 phút", "Gói Video 30 phút"

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ConsultationPricing = sequelize.define('ConsultationPricing', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    
    // ==================== THÔNG TIN GÓI (LOGIC B) ====================
    
    package_name: {
      type: DataTypes.STRING(255),
      allowNull: false, // Bắt buộc
      comment: 'Tên gói dịch vụ (do admin tự đặt)'
    },
    
    package_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      comment: 'Mã gói dịch vụ (tự động tạo)'
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Mô tả ngắn cho gói'
    },
    
    // Loại gói (Chat hay Video)
    package_type: {
      type: DataTypes.ENUM('chat', 'video', 'offline'),
      allowNull: false,
      defaultValue: 'chat'
    },
    
    // Thời lượng của gói
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: 'Thời lượng của gói (phút)'
    },
    
    // Giá của gói
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 100000,
      comment: 'Giá (phí cơ bản) của gói này'
    },
    
    // ==================== QUẢN LÝ BÁC SĨ ====================
    
    // LƯU MẢNG CODE BÁC SĨ (tương tự services.doctor_codes)
    doctor_codes: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Danh sách CODE bác sĩ thực hiện dịch vụ tư vấn [DR00001, DR00002]'
    },
    
    // ==================== CÁC TRƯỜNG KHÁC ====================
    
    // Ghi chú
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Trạng thái (Gói này có đang được bán không?)
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
    
    // === ĐÃ XÓA ===
    // doctor_id (Gói không còn gắn với bác sĩ)
    // chat_fee, video_fee, offline_fee
    // chat_duration, video_duration, offline_duration
    // allow_chat, allow_video, allow_offline
    // working_hours
    
  }, {
    tableName: 'consultation_pricing',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['is_active'] },
      { fields: ['package_type'] }
    ]
  });

  ConsultationPricing.associate = (models) => {
    // Gói này có thể được đặt trong nhiều buổi tư vấn
    ConsultationPricing.hasMany(models.Consultation, {
      foreignKey: 'consultation_pricing_id'
    });
  };

  console.log(' Model ConsultationPricing (LOGIC B) đã được định nghĩa');
  return ConsultationPricing;
};