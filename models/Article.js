// server/models/Article.js

/* ===== GHI CHÚ =====
Các trạng thái:
- draft: Bản nháp, staff có thể chỉnh sửa/xóa tự do
- pending: Đã gửi phê duyệt, chờ admin xử lý
- approved: Đã được admin phê duyệt, hiển thị public
- rejected: Admin từ chối
- hidden: Admin ẩn bài viết (do báo cáo hoặc vi phạm)
- request_edit: Staff yêu cầu chỉnh sửa bài đã duyệt
- request_rewrite: Admin yêu cầu viết lại hoàn toàn
*/

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Article = sequelize.define('Article', {
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true,
      comment: 'ID duy nhất của bài viết'
    },
    title: { 
      type: DataTypes.STRING(255), 
      allowNull: false,
      comment: 'Tiêu đề bài viết'
    },
    slug: { 
      type: DataTypes.STRING(255), 
      allowNull: false, 
      unique: true,
      comment: 'Slug duy nhất để truy cập bài viết'
    },
    content: { 
      type: DataTypes.TEXT('long'), 
      allowNull: false,
      comment: 'Nội dung HTML chi tiết của bài viết, bao gồm ảnh/video nhúng'
    },
    category_id: { 
      type: DataTypes.BIGINT,
      comment: 'ID của danh mục liên quan'
    },
    author_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      comment: 'ID tác giả (người viết)'
    },
    approved_by_id: { 
      type: DataTypes.BIGINT,
      comment: 'ID người phê duyệt cuối cùng (Admin/Manager)'
    },
    
    // === 3 CỘT MỚI: PHỤC VỤ THAM VẤN Y KHOA ===
    specialty_id: { 
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'ID Chuyên khoa (nếu bài viết yêu cầu tham vấn y khoa)'
    },
    is_medical_review_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Đánh dấu bài viết cần bác sĩ tham vấn'
    },
    medical_reviewer_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'ID User của Bác sĩ được phân công duyệt chuyên môn'
    },
    // ===========================================

    tags_json: { 
      type: DataTypes.JSON,
      comment: 'Danh sách từ khóa (tags)'
    },
    cover_image_url: { 
      type: DataTypes.STRING(255),
      comment: 'Đường dẫn ảnh bìa'
    },
    status: { 
      type: DataTypes.ENUM(
        'draft', 
        'pending_medical', // Trạng thái mới: Chờ bác sĩ duyệt chuyên môn
        'pending',         // Chờ Trưởng phòng/Admin duyệt
        'approved', 
        'rejected', 
        'hidden', 
        'request_edit', 
        'request_rewrite'
      ), 
      defaultValue: 'draft',
      comment: 'Trạng thái hiện tại của bài viết'
    },
    hidden_reason: { 
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Lý do bài viết bị ẩn (dành cho tác giả xem)'
    },
    entity_type: { 
      type: DataTypes.ENUM('medicine', 'disease'),
      comment: 'Loại thực thể liên kết (nếu có)'
    },
    entity_id: { 
      type: DataTypes.BIGINT,
      comment: 'ID của thực thể liên kết'
    },
    views: { 
      type: DataTypes.INTEGER, 
      defaultValue: 0,
      comment: 'Lượt xem'
    },
    published_at: { 
      type: DataTypes.DATE,
      comment: 'Thời gian xuất bản'
    },
    created_at: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW 
    },
    updated_at: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW 
    }
  }, {
    tableName: 'articles',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['category_id'] },
      { fields: ['author_id'] },
      { fields: ['status'] },
      { fields: ['slug'] },
      { fields: ['medical_reviewer_id'] },
      { fields: ['specialty_id'] }
    ]
  });

  Article.associate = (models) => {
    Article.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category' });
    Article.belongsTo(models.User, { foreignKey: 'author_id', as: 'author' });
    Article.belongsTo(models.User, { foreignKey: 'approved_by_id', as: 'approver' });
    
    // Quan hệ mới: Bác sĩ tham vấn & Chuyên khoa
    Article.belongsTo(models.User, { foreignKey: 'medical_reviewer_id', as: 'medical_reviewer' });
    if(models.Specialty) {
      Article.belongsTo(models.Specialty, { foreignKey: 'specialty_id', as: 'specialty' });
    }

    Article.belongsTo(models.Medicine, { foreignKey: 'entity_id', constraints: false, as: 'medicine' });
    Article.belongsTo(models.Disease, { foreignKey: 'entity_id', constraints: false, as: 'disease' });
    Article.hasMany(models.Interaction, { foreignKey: 'entity_id', constraints: false, scope: { entity_type: 'article' }, as: 'interactions' });
    Article.hasMany(models.ArticleComment, { foreignKey: 'article_id', as: 'comments' });
    Article.hasMany(models.ArticleReviewHistory, { foreignKey: 'article_id', as: 'review_history' });
  };
  console.log('SUCCESS: Model Article (Polymorphic) đã được định nghĩa.');
  return Article;
};