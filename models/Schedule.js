// server/models/Schedule.js
'use strict';
const { DataTypes } = require('sequelize'); // Import DataTypes

module.exports = (sequelize) => {
  const Schedule = sequelize.define('Schedule', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    doctor_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'doctors',
        key: 'id'
      }
    },
    schedule_type: {
      // SỬA: Thêm 'flexible_registration' và 'overtime'
      type: DataTypes.ENUM('fixed', 'overtime', 'leave', 'shift_change', 'flexible_registration'),
      allowNull: false,
      defaultValue: 'fixed'
    },
    date: {
      type: DataTypes.DATEONLY,
      // SỬA: Cho phép NULL (cho loại 'flexible_registration')
      allowNull: true 
    },
    start_time: {
      type: DataTypes.TIME,
      // SỬA: Cho phép NULL
      allowNull: true, 
      validate: {
        isValidWorkTime(value) {
          // SỬA: Bỏ qua validation cho 'leave' VÀ 'flexible_registration'
          if (this.schedule_type === 'leave' || this.schedule_type === 'flexible_registration') {
            return true;
          }
          if (!value) throw new Error('start_time là bắt buộc cho lịch fixed/overtime.');
          
          // (Validation giờ làm việc giữ nguyên)
        }
      }
    },
    end_time: {
      type: DataTypes.TIME,
      // SỬA: Cho phép NULL
      allowNull: true, 
      validate: {
        isValidWorkTime(value) {
          // SỬA: Bỏ qua validation
          if (this.schedule_type === 'leave' || this.schedule_type === 'flexible_registration') {
            return true;
          }
          if (!value) throw new Error('end_time là bắt buộc cho lịch fixed/overtime.');
          
          // (Validation giờ làm việc giữ nguyên)
        },
        isAfterStartTime(value) {
          // SỬA: Bỏ qua validation
          if (this.schedule_type === 'leave' || this.schedule_type === 'flexible_registration') {
            return true;
          }
          if (!this.start_time || !value) return true; 
          
          const normalizeTime = (time) => {
            const timeStr = String(time);
            const parts = timeStr.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
          };
          const startMinutes = normalizeTime(this.start_time);
          const endMinutes = normalizeTime(value);
          
          if (endMinutes <= startMinutes) {
            throw new Error('Giờ kết thúc phải sau giờ bắt đầu');
          }
        }
      }
    },
    status: {
      // Giữ nguyên ENUM, 'pending', 'approved', 'rejected' sẽ được dùng chung
      type: DataTypes.ENUM('available', 'booked', 'pending', 'approved', 'rejected', 'cancelled'),
      allowNull: false,
      defaultValue: 'available'
    },
    user_type: {
      type: DataTypes.ENUM('doctor', 'staff'),
      allowNull: false
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Lý do đăng ký Tăng ca (nếu có)"
    },
    approved_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // =============================================
    // === BỔ SUNG CHO LỊCH LINH HOẠT & TĂNG CA ===
    // =============================================
    weekly_schedule_json: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Lưu các slot con: {"mon": ["07:00-09:30"], "tue": ["full"]...}'
    },
    effective_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Ngày bắt đầu có hiệu lực của lịch linh hoạt'
    },
    is_active_registration: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Đánh dấu đây là bản đăng ký đang được áp dụng'
    },
    reject_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Lý do admin từ chối (lịch linh hoạt hoặc tăng ca)"
    },
    // =============================================

    is_recurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    recurring_pattern: {
      type: DataTypes.JSON,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'schedules',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['doctor_id'] },
      { fields: ['date'] },
      { fields: ['status'] },
      { fields: ['schedule_type'] },
      { fields: ['date', 'user_id'] },
      // Index mới
      { fields: ['user_id', 'schedule_type', 'is_active_registration'] }
    ]
  });

  Schedule.associate = function(models) {
    Schedule.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    Schedule.belongsTo(models.Doctor, {
      foreignKey: 'doctor_id',
      as: 'doctor'
    });
    Schedule.belongsTo(models.User, {
      foreignKey: 'approved_by',
      as: 'approver'
    });
    Schedule.hasMany(models.Appointment, {
      foreignKey: 'schedule_id',
      as: 'appointments'
    });
    
    // Association mới (cho Doctor/Staff)
    Schedule.hasOne(models.Doctor, { 
      foreignKey: 'current_schedule_id', 
      as: 'activeDoctor' 
    });
    Schedule.hasOne(models.Staff, { 
      foreignKey: 'current_schedule_id', 
      as: 'activeStaff' 
    });
  };
  
  // (Bỏ Validation cứng nhắc từ file gốc)

  return Schedule;
};