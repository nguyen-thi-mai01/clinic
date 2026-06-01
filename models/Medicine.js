// server/models/Medicine.js - UPDATED
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Medicine = sequelize.define('Medicine', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    category_id: { type: DataTypes.BIGINT },
    name: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    // --- [SỬA] Thêm cột đơn vị tính ---
    unit: { 
      type: DataTypes.STRING(50), 
      defaultValue: 'Hộp', 
      comment: 'Đơn vị tính (Viên, Vỉ, Hộp, Lọ...)' 
    },
    price: { type: DataTypes.INTEGER, defaultValue: 0, comment: 'Giá tiền (VNĐ)' },
    composition: { type: DataTypes.TEXT, comment: 'Thành phần thuốc' },
    uses: { type: DataTypes.TEXT, comment: 'Công dụng' },
    side_effects: { type: DataTypes.TEXT, comment: 'Tác dụng phụ' },
    image_url: { type: DataTypes.STRING(500), comment: 'URL hình ảnh' },
    manufacturer: { type: DataTypes.STRING(255), comment: 'Nhà sản xuất' },
    excellent_review_percent: { type: DataTypes.DECIMAL(5,2), defaultValue: 0, comment: '% đánh giá xuất sắc' },
    average_review_percent: { type: DataTypes.DECIMAL(5,2), defaultValue: 0, comment: '% đánh giá trung bình' },
    poor_review_percent: { type: DataTypes.DECIMAL(5,2), defaultValue: 0, comment: '% đánh giá kém' },
    
    // Giữ lại cột cũ để tương thích
    components: { type: DataTypes.TEXT },
    medicine_usage: { type: DataTypes.TEXT },
    description: { type: DataTypes.TEXT },
    
    // ===== THÊM MỚI =====
    hidden: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: false,
      comment: 'Admin ẩn thuốc (không hiện công khai)'
    },
    hidden_reason: { 
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Lý do ẩn thuốc'
    },
    slug: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: true,
      comment: 'Slug cho URL công khai'
    },
    // ===== KHO THUỐC =====
    is_prescription_drug: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Thuốc kê đơn (true) hay không kê đơn (false)'
    },
    min_stock_threshold: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      comment: 'Ngưỡng tồn kho tối thiểu - cảnh báo khi dưới mức này'
    },
    stock_total: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Tổng tồn kho hiện tại (cập nhật tự động khi nhập/xuất)'
    },
    // ===================
    
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'medicines',
    timestamps: true,
    underscored: true
  });

  Medicine.associate = (models) => {
    // Liên kết với Category
    Medicine.belongsTo(models.Category, { foreignKey: 'category_id' });
    
    // Polymorphic relationship với Interaction
    Medicine.hasMany(models.Interaction, { 
      foreignKey: 'entity_id',
      constraints: false,
      scope: { entity_type: 'medicine' },
      as: 'interactions'
    });

    // ===== THÊM MỚI =====
    // Liên kết với EntitySuggestion
    Medicine.hasMany(models.EntitySuggestion, {
      foreignKey: 'entity_id',
      constraints: false,
      scope: { entity_type: 'medicine' },
      as: 'suggestions'
    });

    // ===== KHO THUỐC =====
    if (models.MedicineBatch) {
      Medicine.hasMany(models.MedicineBatch, {
        foreignKey: 'medicine_id',
        as: 'batches'
      });
    }
    if (models.StockTransaction) {
      Medicine.hasMany(models.StockTransaction, {
        foreignKey: 'medicine_id',
        as: 'stockTransactions'
      });
    }
    // ===================
  };

  console.log('SUCCESS: Model Medicine đã được định nghĩa.');
  return Medicine;
};