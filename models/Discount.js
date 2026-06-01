const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Discount = sequelize.define('Discount', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255) },
    type: { type: DataTypes.ENUM('percentage', 'fixed', 'free') },
    value: { type: DataTypes.DECIMAL(10, 2) },
    start_date: { type: DataTypes.DATE, allowNull: false },
    end_date: { type: DataTypes.DATE, allowNull: false },
    specialty_id: { type: DataTypes.BIGINT },
    doctor_id: { type: DataTypes.BIGINT },
    apply_count: { type: DataTypes.INTEGER },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'discounts',
    timestamps: true,
    underscored: true
  });

  Discount.associate = (models) => {
    Discount.belongsTo(models.Specialty, { foreignKey: 'specialty_id' });
    Discount.belongsTo(models.User, { foreignKey: 'doctor_id' });
    Discount.hasMany(models.Payment, { foreignKey: 'discount_id' });
  };

  console.log('SUCCESS: Model Discount đã được định nghĩa.');
  return Discount;
};