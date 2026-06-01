const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const WheelPrize = sequelize.define('WheelPrize', {
    id:             { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    wheel_event_id: { type: DataTypes.BIGINT, allowNull: false },
    promotion_id:   { type: DataTypes.BIGINT, allowNull: true },
    label:          { type: DataTypes.STRING, allowNull: false },
    probability:    { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
    quantity:       { type: DataTypes.INTEGER, defaultValue: -1 },
    quantity_won:   { type: DataTypes.INTEGER, defaultValue: 0 },
    color:          { type: DataTypes.STRING(20) },
    is_miss:          { type: DataTypes.BOOLEAN, defaultValue: false },
    sort_order:       { type: DataTypes.INTEGER, defaultValue: 0 },
    reward_type:      { type: DataTypes.ENUM('voucher','card','item'), defaultValue: 'voucher' },
    external_code:    { type: DataTypes.STRING(500), allowNull: true },
    reward_image_url: { type: DataTypes.STRING(500), allowNull: true },
  }, { tableName: 'wheel_prizes', underscored: true });

  WheelPrize.associate = (models) => {
    WheelPrize.belongsTo(models.WheelEvent, { foreignKey: 'wheel_event_id', as: 'wheelEvent' });
    WheelPrize.belongsTo(models.Promotion,  { foreignKey: 'promotion_id',   as: 'promotion'  });
  };
  return WheelPrize;
};