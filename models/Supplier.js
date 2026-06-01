// server/models/Supplier.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Supplier = sequelize.define('Supplier', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Tên nhà cung cấp'
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Số điện thoại'
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Email liên hệ'
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Địa chỉ'
    },
    tax_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Mã số thuế'
    },
    contact_person: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Người liên hệ'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
      comment: 'Trạng thái hoạt động'
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'suppliers',
    timestamps: true,
    underscored: true
  });

  Supplier.associate = (models) => {
    if (models.MedicineBatch) {
      Supplier.hasMany(models.MedicineBatch, {
        foreignKey: 'supplier_id',
        as: 'batches'
      });
    }
  };

  console.log('SUCCESS: Model Supplier đã được định nghĩa.');
  return Supplier;
};