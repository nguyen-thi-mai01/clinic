// server/models/ArticleReviewHistory.js
/* ===== GHI CHÚ =====
Các action mới thêm:
- hide: Admin ẩn bài viết (vì báo cáo, vi phạm...)
- unhide: Admin hiện lại bài viết đã ẩn

Lưu ý: 
- Comment trao đổi được lưu riêng trong bảng article_comments
- Bảng này chỉ lưu các hành động phê duyệt chính
*/
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ArticleReviewHistory = sequelize.define('ArticleReviewHistory', {
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true,
      comment: 'ID lịch sử phê duyệt'
    },
    article_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      comment: 'ID bài viết'
    },
    reviewer_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      comment: 'ID người phê duyệt (admin)'
    },
    author_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      comment: 'ID tác giả bài viết (staff/doctor)'
    },
    action: { 
    type: DataTypes.ENUM(
      'submit',           // Staff gửi bài lần đầu
      'approve',          // Admin phê duyệt
      'reject',           // Admin từ chối
      'request_rewrite',  // Admin yêu cầu viết lại
      'resubmit',         // Staff gửi lại sau khi sửa
      'request_edit',     // Staff yêu cầu chỉnh sửa bài đã duyệt
      'allow_edit',       // Admin cho phép chỉnh sửa
      'deny_edit',        // Admin từ chối yêu cầu chỉnh sửa
      'hide',             // Admin ẩn bài viết
      'unhide'            // Admin hiện lại bài viết đã ẩn
    ),
    allowNull: false,
    comment: 'Hành động phê duyệt'
  },
    reason: { 
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Lý do từ chối/yêu cầu sửa (max 500 ký tự hiển thị)'
    },
    previous_status: { 
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Trạng thái trước khi thay đổi'
    },
    new_status: { 
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Trạng thái sau khi thay đổi'
    },
    metadata_json: { 
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Dữ liệu bổ sung: changes, version, etc.'
    },
    created_at: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW,
      comment: 'Thời gian tạo'
    }
  }, {
    tableName: 'article_review_history',
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ['article_id'] },
      { fields: ['reviewer_id'] },
      { fields: ['author_id'] },
      { fields: ['created_at'] }
    ],
    comment: 'Lưu lịch sử phê duyệt bài viết'
  });

  ArticleReviewHistory.associate = (models) => {
    // Liên kết với Article
    ArticleReviewHistory.belongsTo(models.Article, { 
      foreignKey: 'article_id',
      as: 'article',
      onDelete: 'CASCADE'
    });

    // Liên kết với User (reviewer - admin)
    ArticleReviewHistory.belongsTo(models.User, { 
      foreignKey: 'reviewer_id',
      as: 'reviewer'
    });

    // Liên kết với User (author - staff/doctor)
    ArticleReviewHistory.belongsTo(models.User, { 
      foreignKey: 'author_id',
      as: 'author'
    });
  };

  console.log('SUCCESS: Model ArticleReviewHistory đã được định nghĩa.');
  return ArticleReviewHistory;
};