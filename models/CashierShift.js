// server/models/CashierShift.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CashierShift = sequelize.define('CashierShift', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    staff_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'ID của Staff (thu ngân) mở ca'
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'ID của User tương ứng'
    },
    shift_config_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'ID WorkShiftConfig được phân công (nếu có)'
    },
    shift_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Ngày làm ca'
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Thời điểm bắt đầu ca thực tế'
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời điểm kết thúc ca thực tế'
    },
    opening_cash: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Tiền mặt đầu ca (nhân viên kiểm đếm)'
    },
    closing_cash_actual: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Tiền mặt cuối ca (nhân viên kiểm đếm thực tế)'
    },
    closing_cash_system: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Tiền mặt cuối ca theo hệ thống (tự tính)'
    },
    cash_difference: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Chênh lệch: actual - system (+ = thừa, - = thiếu)'
    },
    total_transactions: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Tổng số giao dịch trong ca'
    },
    total_revenue_cash: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: 'Tổng doanh thu tiền mặt trong ca'
    },
    total_revenue_transfer: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      comment: 'Tổng doanh thu chuyển khoản trong ca'
    },
    opening_note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Ghi chú đầu ca / bàn giao từ ca trước'
    },
    closing_note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Ghi chú cuối ca / bàn giao cho ca sau'
    },
    status: {
      type: DataTypes.ENUM('open', 'closed', 'pending_review'),
      defaultValue: 'open',
      allowNull: false,
      comment: 'open: đang mở | closed: đã đóng | pending_review: chờ admin xét duyệt'
    },
    reviewed_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'Admin đã xét duyệt'
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    review_note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Ghi chú của admin khi xét duyệt'
    }
  }, {
    tableName: 'cashier_shifts',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['staff_id'] },
      { fields: ['shift_date'] },
      { fields: ['status'] },
      { fields: ['staff_id', 'status'] }
    ]
  });

  CashierShift.associate = (models) => {
    CashierShift.belongsTo(models.Staff, {
      foreignKey: 'staff_id',
      as: 'staff'
    });
    CashierShift.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'cashier'
    });
    CashierShift.belongsTo(models.WorkShiftConfig, {
      foreignKey: 'shift_config_id',
      as: 'shiftConfig'
    });
    CashierShift.belongsTo(models.User, {
      foreignKey: 'reviewed_by',
      as: 'reviewer'
    });
  };

  console.log('SUCCESS: Model CashierShift đã được định nghĩa.');
  return CashierShift;
};