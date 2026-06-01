// server/models/AppointmentChange.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AppointmentChange = sequelize.define('AppointmentChange', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    appointment_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'appointments',
        key: 'id'
      }
    },
    change_type: {
      type: DataTypes.ENUM('reschedule', 'cancel', 'doctor_request'),
      allowNull: false,
      comment: 'Loại thay đổi'
    },
    requested_by: {
      type: DataTypes.ENUM('patient', 'doctor', 'staff', 'admin', 'guest', 'system'),
      allowNull: false,
      comment: 'Người yêu cầu thay đổi'
    },
    requester_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'user_id của người yêu cầu (NULL nếu guest/system)'
    },
    change_request: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Chi tiết yêu cầu: { old_date, new_date, reason, ... }'
    },
    change_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
      defaultValue: 'pending',
      allowNull: false
    },
    requested_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    processed_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'Admin/Staff xử lý'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Ghi chú từ người xử lý'
    },

    // ===== [MỚI] Xử lý Ngoại Lệ (Edge Cases) =====
    edge_case_type: {
      type: DataTypes.ENUM('late_arrival', 'no_show', 'urgent_leave', 'nested_indication', 'none'),
      defaultValue: 'none',
      allowNull: true,
      comment: 'Loại ngoại lệ: late arrival, no-show, bác sĩ xin nghỉ gấp, thêm chỉ định...'
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'appointment_changes',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['appointment_id'] },
      { fields: ['change_status'] },
      { fields: ['requested_by'] }
    ]
  });

  AppointmentChange.associate = (models) => {
    AppointmentChange.belongsTo(models.Appointment, {
      foreignKey: 'appointment_id',
      as: 'appointment'
    });

    AppointmentChange.belongsTo(models.User, {
      foreignKey: 'requester_id',
      as: 'requester'
    });

    AppointmentChange.belongsTo(models.User, {
      foreignKey: 'processed_by',
      as: 'processor'
    });
  };

  console.log('SUCCESS: Model AppointmentChange đã được định nghĩa.');
  return AppointmentChange;
};