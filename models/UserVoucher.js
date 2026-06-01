const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserVoucher = sequelize.define('UserVoucher', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.BIGINT, allowNull: false },
    promotion_id: { type: DataTypes.BIGINT, allowNull: false },
    is_used: { type: DataTypes.BOOLEAN, defaultValue: false },
    used_at: { type: DataTypes.DATE },
    // Lưu lại thông tin đơn hàng đã dùng mã này (nếu có)
    order_id: { type: DataTypes.BIGINT, allowNull: true }
  }, {
    tableName: 'user_vouchers',
    underscored: true
  });

  UserVoucher.associate = (models) => {
    UserVoucher.belongsTo(models.User, { foreignKey: 'user_id' });
    UserVoucher.belongsTo(models.Promotion, { foreignKey: 'promotion_id' });
  };

  return UserVoucher;
};