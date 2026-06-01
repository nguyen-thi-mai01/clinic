// server/models/Topic.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Topic = sequelize.define('Topic', {
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true 
    },
    title: { 
      type: DataTypes.STRING(255), 
      allowNull: false,
      comment: 'Tên chủ đề (VD: "Sức khỏe tim mạch", "Dinh dưỡng")'
    },
    description: { 
      type: DataTypes.TEXT, 
      allowNull: true,
      comment: 'Mô tả chi tiết chủ đề'
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      comment: 'URL-friendly slug'
    },
    specialtyIds: {
      type: DataTypes.JSON,
      defaultValue: [],
      field: 'specialty_ids',
      comment: 'Array of specialty IDs liên quan (có thể nhiều chuyên khoa)'
    },
    requiresApproval: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'requires_approval',
      comment: 'Topic này có yêu cầu duyệt câu hỏi không?'
    },
    autoApprove: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'auto_approve',
      comment: 'Tự động duyệt câu hỏi trong topic này?'
    },
    moderatorIds: {
      type: DataTypes.JSON,
      defaultValue: [],
      field: 'moderator_ids',
      comment: 'Array of staff user_id được phân công kiểm duyệt (max 2)'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
      comment: 'Topic có đang hoạt động không?'
    },
    questionsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'questions_count',
      comment: 'Cached counter - số câu hỏi trong topic'
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Icon name (VD: "FaHeart", "FaAppleAlt")'
    },
    avatar: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'URL ảnh đại diện của nhóm/chủ đề'
    },
    coverImage: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'cover_image',
      comment: 'URL ảnh bìa của nhóm/chủ đề'
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Màu đại diện (VD: "#2ecc71")'
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'display_order',
      comment: 'Thứ tự hiển thị'
    },
    createdBy: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'created_by',
      comment: 'Staff user_id tạo topic'
    }
    // deletedAt được tự động tạo bởi paranoid: true
  }, {
    tableName: 'topics',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  Topic.associate = (models) => {
    Topic.hasMany(models.Question, { foreignKey: 'topicId', as: 'questions' });
    Topic.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
  };

  //  Tự động tạo bảng nếu chưa tồn tại
  Topic.sync({ alter: false })
    .then(() => {
      console.log(' Bảng topics đã sẵn sàng (sync completed)');
    })
    .catch((error) => {
      console.error('❌ Lỗi sync bảng topics:', error.message);
    });

  console.log(' Model Topic đã được định nghĩa.');
  return Topic;
};
