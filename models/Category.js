const { DataTypes } = require('sequelize');
const slugify = require('slugify'); // Helper tạo slug

module.exports = (sequelize) => {
  const Category = sequelize.define('Category', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    category_type: { type: DataTypes.ENUM('tin_tuc', 'thuoc', 'benh_ly'), allowNull: false, comment: 'Loại danh mục: tin_tuc, thuoc, benh_ly' },
    name: { type: DataTypes.STRING(255), allowNull: false, comment: 'Tên danh mục con' },
    slug: { type: DataTypes.STRING(255), unique: true, comment: 'URL thân thiện' },
    description: { type: DataTypes.TEXT, allowNull: true, comment: 'Mô tả chi tiết về danh mục' },
    
    // --- CÁC CỘT QUẢNG CÁO MỚI ---
    banner_image_url: { type: DataTypes.STRING(500), allowNull: true, comment: 'Link ảnh banner ngang' },
    banner_target_link: { type: DataTypes.STRING(500), allowNull: true, comment: 'Link đích khi click banner' },
    sidebar_ad_image_url: { type: DataTypes.STRING(500), allowNull: true, comment: 'Link ảnh quảng cáo sidebar' },
    sidebar_ad_target_link: { type: DataTypes.STRING(500), allowNull: true, comment: 'Link đích quảng cáo sidebar' },
    
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'categories',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['category_type'] }, { fields: ['slug'], unique: true }],
    hooks: {
      beforeValidate: (category) => {
        if (category.name && !category.slug) {
          category.slug = slugify(category.name, { lower: true, strict: true });
        }
      },
      afterCreate: (category) => console.log(`[LOG - Category]: Đã tạo danh mục mới ID: ${category.id} - Tên: ${category.name}`),
      afterUpdate: (category) => console.log(`[LOG - Category]: Đã cập nhật danh mục ID: ${category.id}`)
    }
  });

  // ĐỊNH NGHĨA QUAN HỆ (ASSOCIATIONS)
  Category.associate = (models) => {
    Category.hasMany(models.Article, { foreignKey: 'category_id', onDelete: 'RESTRICT' });
    Category.hasMany(models.Medicine, { foreignKey: 'category_id', onDelete: 'RESTRICT' });
    Category.hasMany(models.Disease, { foreignKey: 'category_id', onDelete: 'RESTRICT' });
  };

  // ============================================
  // HELPER METHODS
  // ============================================
  Category.getCategoryTypeLabel = (type) => {
    const labels = {
      'tin_tuc': 'Tin tức',
      'thuoc': 'Thuốc',
      'benh_ly': 'Bệnh lý'
    };
    return labels[type] || type;
  };
  console.log('SUCCESS: Model Category đã được định nghĩa.');
  return Category;
};