// server/models/LeaveRequest.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LeaveRequest = sequelize.define('LeaveRequest', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'FK -> users table'
    },
    user_type: {
      type: DataTypes.ENUM('doctor', 'staff'),
      allowNull: false,
      comment: 'Loại user xin nghỉ'
    },
    leave_type: {
      type: DataTypes.ENUM('full_day', 'single_shift', 'time_range', 'multiple_days'),
      allowNull: false,
      comment: 'Loại nghỉ: cả ngày, 1 ca, khoảng giờ, nhiều ngày'
    },
    date_from: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Ngày bắt đầu nghỉ'
    },
    date_to: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Ngày kết thúc nghỉ (NULL nếu chỉ nghỉ 1 ngày)'
    },
    shift_name: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'morning/afternoon/evening - NULL nếu full_day hoặc time_range'
    },
    time_from: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: 'Giờ bắt đầu nghỉ - chỉ dùng cho time_range'
    },
    time_to: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: 'Giờ kết thúc nghỉ - chỉ dùng cho time_range'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Lý do xin nghỉ'
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false
    },
    requested_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Thời gian gửi đơn'
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời gian xử lý (duyệt/từ chối)'
    },
    processed_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Admin/Staff xử lý đơn'
    },
    reject_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Lý do từ chối (nếu status=rejected)'
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
    tableName: 'leave_requests',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['date_from', 'date_to'] },
      { fields: ['user_id', 'status'] },
      { fields: ['processed_by'] }
    ]
  });

  LeaveRequest.associate = (models) => {
    LeaveRequest.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    LeaveRequest.belongsTo(models.User, {
      foreignKey: 'processed_by',
      as: 'processor'
    });
  };

  // Instance methods
  LeaveRequest.prototype.canCancel = function() {
    return this.status === 'pending';
  };

  LeaveRequest.prototype.isOverlapping = function(date) {
    const checkDate = new Date(date);
    const dateFrom = new Date(this.date_from);
    const dateTo = this.date_to ? new Date(this.date_to) : dateFrom;
    
    return checkDate >= dateFrom && checkDate <= dateTo;
  };

  console.log('SUCCESS: Model LeaveRequest đã được định nghĩa.');
  return LeaveRequest;
};