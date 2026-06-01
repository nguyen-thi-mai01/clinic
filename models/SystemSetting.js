const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SystemSetting = sequelize.define('SystemSetting', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    setting_key: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    value_json: { type: DataTypes.JSON, allowNull: false },
    updated_by: { type: DataTypes.BIGINT },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'system_settings',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['setting_key'] }]
  });

  SystemSetting.associate = (models) => {
    SystemSetting.belongsTo(models.User, { foreignKey: 'updated_by' });
  };

  console.log('SUCCESS: Model SystemSetting đã được định nghĩa.');
  return SystemSetting;
};