const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Specialty = sequelize.define('Specialty', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    description: { type: DataTypes.TEXT },
    slug: { type: DataTypes.STRING(255), unique: true },
    icon: { type: DataTypes.STRING(100), defaultValue: 'FaStethoscope' },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'specialties',
    timestamps: true,
    underscored: true
  });

  Specialty.associate = (models) => {
    Specialty.hasMany(models.Doctor, { foreignKey: 'specialty_id' });
    Specialty.hasMany(models.Appointment, { foreignKey: 'specialty_id' });
    Specialty.hasMany(models.Discount, { foreignKey: 'specialty_id' });
  };

  console.log('SUCCESS: Model Specialty đã được định nghĩa.');
  return Specialty;
};