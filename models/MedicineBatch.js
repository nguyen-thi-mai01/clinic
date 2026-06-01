// server/models/MedicineBatch.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MedicineBatch = sequelize.define('MedicineBatch', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    medicine_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'FK → medicines.id'
    },
    batch_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Số lô — VD: LOT-20260301-001'
    },
    expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Hạn dùng'
    },
    quantity_import: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Số lượng nhập ban đầu'
    },
    quantity_remaining: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Tồn hiện tại (trừ dần khi bán)'
    },
    import_price: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      comment: 'Giá nhập (đ/đơn vị)'
    },
    supplier_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'FK → suppliers.id'
    },
    import_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Ngày nhập kho'
    },
    import_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'FK → users.id — Người nhập kho'
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Ghi chú'
    },
    status: {
      type: DataTypes.ENUM('active', 'expired', 'used_up'),
      defaultValue: 'active',
      comment: 'active=còn dùng | expired=hết hạn | used_up=hết hàng'
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'medicine_batches',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['medicine_id'] },
      { fields: ['expiry_date'] },
      { fields: ['status'] }
    ]
  });

  MedicineBatch.associate = (models) => {
    // Lô thuộc về 1 thuốc
    MedicineBatch.belongsTo(models.Medicine, {
      foreignKey: 'medicine_id',
      as: 'Medicine'
    });

    // Lô thuộc về 1 nhà cung cấp
    if (models.Supplier) {
      MedicineBatch.belongsTo(models.Supplier, {
        foreignKey: 'supplier_id',
        as: 'Supplier'
      });
    }

    // Lô có nhiều giao dịch nhập/xuất
    if (models.StockTransaction) {
      MedicineBatch.hasMany(models.StockTransaction, {
        foreignKey: 'batch_id',
        as: 'transactions'
      });
    }

    // Người nhập kho
    if (models.User) {
      MedicineBatch.belongsTo(models.User, {
        foreignKey: 'import_by',
        as: 'ImportedBy'
      });
    }
  };

  console.log('SUCCESS: Model MedicineBatch đã được định nghĩa.');
  return MedicineBatch;
};