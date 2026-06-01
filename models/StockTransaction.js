// server/models/StockTransaction.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StockTransaction = sequelize.define('StockTransaction', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    batch_id: {
      type: DataTypes.BIGINT,
      allowNull: true, // null khi điều chỉnh trực tiếp stock_total không theo lô
      comment: 'FK → medicine_batches.id'
    },
    medicine_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'FK → medicines.id — để query nhanh không cần JOIN qua batch'
    },
    type: {
      type: DataTypes.ENUM(
        'import',               // Nhập kho
        'export_prescription',  // Xuất theo đơn bác sĩ
        'export_retail',        // Xuất bán lẻ tại quầy
        'adjust',               // Điều chỉnh (kiểm kê)
        'destroy'               // Hủy thuốc hết hạn
      ),
      allowNull: false,
      comment: 'Loại giao dịch'
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Số lượng: dương (+) = nhập vào, âm (-) = xuất ra'
    },
    reference_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Mã tham chiếu: mã đơn thuốc, mã hóa đơn bán lẻ, mã phiếu nhập...'
    },
    reference_type: {
      type: DataTypes.ENUM('import', 'prescription', 'retail', 'adjustment', 'destroy'),
      allowNull: true,
      comment: 'Loại tài liệu tham chiếu'
    },
    unit_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Đơn giá tại thời điểm giao dịch (giá nhập hoặc giá bán)'
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Ghi chú'
    },
    created_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'FK → users.id — người thực hiện giao dịch'
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    // Không có updated_at vì giao dịch kho không được sửa sau khi tạo
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'stock_transactions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['medicine_id'] },
      { fields: ['batch_id'] },
      { fields: ['type'] },
      { fields: ['created_at'] },
      { fields: ['reference_id'] }
    ]
  });

  StockTransaction.associate = (models) => {
    // Giao dịch thuộc về 1 lô thuốc
    if (models.MedicineBatch) {
      StockTransaction.belongsTo(models.MedicineBatch, {
        foreignKey: 'batch_id',
        as: 'Batch'
      });
    }

    // Giao dịch thuộc về 1 thuốc (shortcut, không cần qua batch)
    StockTransaction.belongsTo(models.Medicine, {
      foreignKey: 'medicine_id',
      as: 'Medicine'
    });

    // Người thực hiện
    if (models.User) {
      StockTransaction.belongsTo(models.User, {
        foreignKey: 'created_by',
        as: 'CreatedBy'
      });
    }
  };

  console.log('SUCCESS: Model StockTransaction đã được định nghĩa.');
  return StockTransaction;
};