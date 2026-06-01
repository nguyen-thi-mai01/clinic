// server/models/Disease.js - UPDATED
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Disease = sequelize.define('Disease', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    category_id: { type: DataTypes.BIGINT },
    name: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    symptoms: { type: DataTypes.TEXT, comment: 'Triệu chứng' },
    treatments: { type: DataTypes.TEXT, comment: 'Phương pháp điều trị' },
    description: { type: DataTypes.TEXT, comment: 'Mô tả chung' },
    
    // ===== THÊM MỚI =====
    hidden: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: false,
      comment: 'Admin ẩn bệnh lý (không hiện công khai)'
    },
    hidden_reason: { 
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Lý do ẩn bệnh lý'
    },
    slug: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: true,
      comment: 'Slug cho URL công khai'
    },
    // ===================
    
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'diseases',
    timestamps: true,
    underscored: true
  });

  Disease.associate = (models) => {
    // Liên kết với Category
    Disease.belongsTo(models.Category, { foreignKey: 'category_id' });
    
    // Polymorphic relationship với Interaction
    Disease.hasMany(models.Interaction, { 
      foreignKey: 'entity_id',
      constraints: false,
      scope: { entity_type: 'disease' },
      as: 'interactions'
    });

    // ===== THÊM MỚI =====
    // Liên kết với EntitySuggestion
    Disease.hasMany(models.EntitySuggestion, {
      foreignKey: 'entity_id',
      constraints: false,
      scope: { entity_type: 'disease' },
      as: 'suggestions'
    });
    // ===================
  };

  console.log('SUCCESS: Model Disease đã được định nghĩa.');
  return Disease;
};