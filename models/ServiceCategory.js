// server/models/ServiceCategory.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ServiceCategory = sequelize.define('ServiceCategory', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'Tên danh mục, ví dụ: Gói Khám Tổng Quát'
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'Slug để tạo URL, ví dụ: goi-kham-tong-quat'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Mô tả ngắn về danh mục dịch vụ'
    },
    image_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'URL hình ảnh đại diện cho danh mục'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Trạng thái hoạt động của danh mục'
    },
  }, {
    tableName: 'service_categories',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  ServiceCategory.associate = (models) => {
    // Một danh mục có thể chứa NHIỀU dịch vụ con
    if (models.Service) {
        ServiceCategory.hasMany(models.Service, {
            foreignKey: 'category_id',
            as: 'services' // Đặt alias để dễ dàng include khi truy vấn
        });
    }
  };

  // Hook để tự động tạo slug từ name
  ServiceCategory.addHook('beforeValidate', (category, options) => {
    if (category.name && !category.slug) {
      const slugify = (str) => 
        str.toLowerCase()
           .normalize('NFD') // Chuẩn hóa Unicode
           .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu
           .replace(/đ/g, 'd')
           .replace(/[^a-z0-9 -]/g, '')
           .replace(/\s+/g, '-')
           .replace(/-+/g, '-');
      category.slug = slugify(category.name);
    }
  });

  console.log('SUCCESS: Model ServiceCategory đã được định nghĩa.');
  return ServiceCategory;
};