// server/models/GroupJoinRequest.js
// Nghiệp vụ:
// - Chỉ dùng cho private group (public group join ngay, không cần request)
// - UNIQUE(group_id, user_id): mỗi user chỉ có 1 request pending tại 1 thời điểm
// - Sau khi approved → tạo GroupMember record tương ứng
// - Sau khi rejected → user phải đợi 7 ngày mới request lại (xử lý ở controller)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GroupJoinRequest = sequelize.define('GroupJoinRequest', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

    group_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'FK → community_groups.id'
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'FK → users.id — người xin vào nhóm'
    },

    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
      allowNull: false
    },

    // Lý do xin vào (optional, giúp owner/moderator quyết định)
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Lý do muốn tham gia nhóm (optional)'
    },

    // Ai duyệt/từ chối request
    reviewed_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'FK → users.id — owner/moderator duyệt'
    },
    reviewed_at: { type: DataTypes.DATE, allowNull: true },
    rejection_reason: { type: DataTypes.TEXT, allowNull: true },

    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'group_join_requests',
    timestamps: true,
    underscored: true,
    indexes: [
      // UNIQUE: 1 user chỉ có 1 pending request trong 1 nhóm
      { unique: true, fields: ['group_id', 'user_id'] },
      { fields: ['group_id', 'status'] }
    ]
  });

  GroupJoinRequest.associate = (models) => {
    GroupJoinRequest.belongsTo(models.CommunityGroup, { foreignKey: 'group_id', as: 'group' });
    GroupJoinRequest.belongsTo(models.User, { foreignKey: 'user_id', as: 'requester' });
    GroupJoinRequest.belongsTo(models.User, { foreignKey: 'reviewed_by', as: 'reviewer' });
  };

  console.log(' Model GroupJoinRequest đã được định nghĩa.');
  return GroupJoinRequest;
};