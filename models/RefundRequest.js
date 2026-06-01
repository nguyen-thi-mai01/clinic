const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RefundRequest = sequelize.define('RefundRequest', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    
    // Liên kết giao dịch gốc
    payment_id: { type: DataTypes.BIGINT, allowNull: false },
    user_id: { type: DataTypes.BIGINT, allowNull: false, comment: 'Người yêu cầu hoàn tiền' },
    
    // Snapshot Tài chính (Quan trọng để kế toán đối soát)
    amount_original: { type: DataTypes.DECIMAL(15, 2), allowNull: false, comment: 'Số tiền gốc đã thanh toán' },
    refund_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, comment: 'Số tiền thực hoàn sau khi trừ phí' },
    penalty_fee: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, comment: 'Phí phạt giữ lại' },
    
    // Snapshot Chính sách (Lưu cứng quy định tại thời điểm hủy)
    policy_snapshot: { 
      type: DataTypes.JSON, 
      allowNull: true,
      comment: 'Lưu rule đã áp dụng: { rule_name: "Hủy trước 24h", penalty_percent: 50 }' 
    },
    
    // Thông tin nhận tiền
    bank_info_snapshot: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: '{ bank_name, account_no, account_name }'
    },
    
    reason: { type: DataTypes.TEXT, allowNull: true },
    
    // Quy trình xử lý
    status: { 
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'rejected', 'cancelled'), 
      defaultValue: 'pending' 
    },
    
    processed_by: { type: DataTypes.BIGINT, allowNull: true, comment: 'Admin xử lý' },
    admin_note: { type: DataTypes.TEXT, allowNull: true },
    
    // Bằng chứng
    refund_ref: { type: DataTypes.STRING(100), comment: 'Mã tham chiếu ngân hàng khi admin chuyển khoản' },
    proof_images: { type: DataTypes.JSON, comment: 'Ảnh biên lai chuyển tiền' },
    
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'refund_requests',
    timestamps: true,
    underscored: true
  });

  RefundRequest.associate = (models) => {
    RefundRequest.belongsTo(models.Payment, { foreignKey: 'payment_id' });
    RefundRequest.belongsTo(models.User, { foreignKey: 'user_id', as: 'User' });
    RefundRequest.belongsTo(models.User, { foreignKey: 'processed_by', as: 'Processor' });
    RefundRequest.hasMany(models.AuditLog, { foreignKey: 'entity_id', constraints: false, scope: { entity_type: 'RefundRequest' } });
    // Thêm association ngược lại để Appointment có thể include RefundRequest qua Payment
    RefundRequest.belongsTo(models.Appointment, { foreignKey: 'appointment_id', as: 'Appointment' });
  };

  return RefundRequest;
};