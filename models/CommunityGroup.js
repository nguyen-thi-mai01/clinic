// server/models/CommunityGroup.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CommunityGroup = sequelize.define('CommunityGroup', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cover_image: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL ảnh bìa nhóm',
    },
    //  THÊM MỚI: ảnh đại diện riêng biệt với ảnh bìa
    avatar_image: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL ảnh đại diện nhóm (avatar, khác ảnh bìa)',
    },
    icon: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Emoji icon dự phòng khi không có avatar_image',
    },

    type: {
      type: DataTypes.ENUM('official', 'community'),
      defaultValue: 'community',
      allowNull: false,
    },
    privacy: {
      type: DataTypes.ENUM('public', 'private', 'invite_only'),
      defaultValue: 'public',
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'suspended'),
      defaultValue: 'pending',
      allowNull: false,
    },

    requires_doctor: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    owner_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    doctor_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    requires_post_approval: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    members_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    posts_count:   { type: DataTypes.INTEGER, defaultValue: 0 },

    // Admin duyệt nhóm
    approved_by: { type: DataTypes.BIGINT, allowNull: true },
    approved_at:  { type: DataTypes.DATE,   allowNull: true },
    rejection_reason: { type: DataTypes.TEXT, allowNull: true },

    //  THÊM MỚI: Yêu cầu ẩn nhóm (gửi lên admin duyệt thay vì xóa thẳng)
    hide_requested_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'FK → users.id — owner gửi yêu cầu ẩn nhóm',
    },
    hide_requested_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    hide_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Lý do muốn ẩn nhóm',
    },

    //  THÊM MỚI: Yêu cầu chuyển bác sĩ phụ trách (cần admin duyệt)
    transfer_doctor_requested: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'doctor_id mới đang đề xuất — chờ admin duyệt',
    },
    transfer_doctor_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'community_groups',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  });

  CommunityGroup.associate = (models) => {
    CommunityGroup.belongsTo(models.User,   { foreignKey: 'owner_id', as: 'owner' });
    CommunityGroup.belongsTo(models.Doctor, { foreignKey: 'doctor_id', as: 'doctor' });
    CommunityGroup.hasMany(models.GroupMember,     { foreignKey: 'group_id', as: 'members' });
    CommunityGroup.hasMany(models.GroupPost,       { foreignKey: 'group_id', as: 'posts' });
    CommunityGroup.hasMany(models.GroupJoinRequest,{ foreignKey: 'group_id', as: 'joinRequests' });
  };

  console.log('Model CommunityGroup đã được định nghĩa.');
  return CommunityGroup;
};