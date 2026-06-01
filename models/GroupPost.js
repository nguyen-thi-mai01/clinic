// server/models/GroupPost.js
// Nghiệp vụ:
// - status='pending': bài đăng chờ owner/moderator/doctor duyệt
// - disclaimer_shown BẮT BUỘC true trước khi hiển thị public
// - Bài của Doctor/Moderator tự động approved (skip review)
// - Bài chứa SENSITIVE_KEYWORDS bị block, hiện nút "Đặt lịch tư vấn"
// - Bài chứa EMERGENCY_KEYWORDS hiện popup Video Call ngay lập tức
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GroupPost = sequelize.define('GroupPost', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

    group_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'FK → community_groups.id'
    },
    author_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'FK → users.id'
    },

    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Nội dung bài đăng'
    },

    // Ảnh đính kèm
    images: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of image URLs, tối đa 5 ảnh'
    },

    // --- CÁC CỘT MỚI BỔ SUNG CHO TÍNH NĂNG FANPAGE ---
    is_anonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'True nếu người dùng chọn đăng bài ẩn danh'
    },
    liked_by: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Mảng ID user đã thả tim: [1, 2, 3]'
    },
    saved_by: { //  ĐÃ THÊM CỘT LƯU BÀI VIẾT VÀO ĐÂY
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Mảng ID user đã lưu bài viết: [1, 2, 3]'
    },
    comments_data: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Mảng các bình luận: [{ id, user_id, user_name, avatar_url, content, created_at }]'
    },
    reports_data: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Mảng các báo cáo: [{ user_id, reason, created_at }]'
    },
    // ------------------------------------------------

    // Trạng thái kiểm duyệt
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'hidden', 'rejected'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'pending=chờ duyệt, approved=hiển thị, hidden=bị ẩn, rejected=từ chối'
    },

    // Bảo vệ doanh thu: đánh dấu bài có từ khóa nhạy cảm
    has_sensitive_content: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'true=bài chứa từ khóa nhạy cảm, hiện nút redirect tư vấn'
    },
    has_emergency_content: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'true=bài chứa từ khóa khẩn cấp, hiện popup Video Call ngay'
    },

    // Disclaimer bắt buộc hiển thị
    disclaimer_shown: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Luôn true — "Nội dung mang tính tham khảo, không thay thế bác sĩ"'
    },

    // Ai duyệt bài
    approved_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'FK → users.id — owner/moderator/doctor duyệt'
    },
    approved_at: { type: DataTypes.DATE, allowNull: true },

    // Cached counters
    likes_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    comments_count: { type: DataTypes.INTEGER, defaultValue: 0 },

    is_pinned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Ghim bài lên đầu nhóm — chỉ owner/moderator'
    },

    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'group_posts',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  GroupPost.associate = (models) => {
    GroupPost.belongsTo(models.CommunityGroup, { foreignKey: 'group_id', as: 'group' });
    
    // Đặt tên 'author' cho người viết bài
    GroupPost.belongsTo(models.User, { foreignKey: 'author_id', as: 'author' });
    
    // Đặt tên 'approver' cho người duyệt bài
    GroupPost.belongsTo(models.User, { foreignKey: 'approved_by', as: 'approver' });
  };

  console.log(' Model GroupPost đã được định nghĩa.');
  return GroupPost;
};