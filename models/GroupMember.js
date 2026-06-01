// server/models/GroupMember.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GroupMember = sequelize.define('GroupMember', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

    group_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'FK → community_groups.id',
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'FK → users.id',
    },

    role: {
      type: DataTypes.ENUM('owner', 'moderator', 'member'),
      defaultValue: 'member',
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('active', 'muted', 'banned'),
      defaultValue: 'active',
      allowNull: false,
      comment: 'muted=không đăng bài được, banned=bị đuổi',
    },

    muted_until: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Hết hạn mute — null nếu mute vĩnh viễn',
    },
    mute_reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Lý do mute',
    },

    invite_token: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    invited_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },

    // ✅ THÊM MỚI: thống kê bài đăng của thành viên trong nhóm
    posts_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Số bài đăng đã được duyệt trong nhóm',
    },
    last_post_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Thời gian đăng bài gần nhất trong nhóm',
    },

    joined_at:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'group_members',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['group_id', 'user_id'] },
      { fields: ['group_id'] },
      { fields: ['user_id'] },
    ],
  });

  GroupMember.associate = (models) => {
    GroupMember.belongsTo(models.CommunityGroup, { foreignKey: 'group_id', as: 'group' });
    GroupMember.belongsTo(models.User, { foreignKey: 'user_id',    as: 'user' });
    GroupMember.belongsTo(models.User, { foreignKey: 'invited_by', as: 'inviter' });
  };

  console.log('Model GroupMember đã được định nghĩa.');
  return GroupMember;
};