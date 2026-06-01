const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Question = sequelize.define('Question', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    topicId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'topic_id',
      comment: 'CHỦ ĐỀ của câu hỏi (bắt buộc)'
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    authorId: { 
      type: DataTypes.BIGINT, 
      allowNull: true,  // Allow null in case user is deleted
      field: 'user_id'
    },
    specialtyId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'specialty_id'
    },
    tags: { 
      type: DataTypes.JSON,
      field: 'tags_json',
      defaultValue: []
    },
    images: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of image URLs uploaded with the question'
    },
    status: { 
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'hidden', 'reported'), 
      defaultValue: 'pending',
      comment: 'pending=chờ duyệt, approved=đã duyệt, rejected=từ chối, hidden=ẩn, reported=bị báo cáo'
    },
    viewsCount: { 
      type: DataTypes.INTEGER, 
      defaultValue: 0,
      field: 'views',
      comment: 'Cached counter - sync từ Interaction.count'
    },
    answersCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'answers_count',
      comment: 'Cached counter - sync từ Answer.count'
    },
    likesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'likes_count',
      comment: 'Cached counter - sync từ Interaction.count (type=like)'
    },
    sharesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'shares_count',
      comment: 'Cached counter - sync từ Interaction.count (type=share)'
    },
    savesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'saves_count',
      comment: 'Cached counter - sync từ Interaction.count (type=save)'
    },
    reportCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'report_count',
      comment: 'Số lần bị báo cáo - sync từ Report.count'
    },
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_anonymous',
      comment: 'Câu hỏi ẩn danh - chỉ admin/manager topic mới thấy tên thật'
    },
    anonymousCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'anonymous_code',
      comment: 'Mã ẩn danh random 5 ký tự (VD: A3X9K) - dùng khi isAnonymous=true'
    },
    specialtyIds: {
      type: DataTypes.JSON,
      defaultValue: [],
      field: 'specialty_ids',
      comment: 'Array of specialty IDs - có thể chọn nhiều chuyên khoa'
    },
    attachments: {
      type: DataTypes.JSON,
      defaultValue: [],
      field: 'attachments',
      comment: 'Array of file URLs - tối đa 5 files đính kèm'
    },
    isPinned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_pinned',
      comment: 'Câu hỏi được ghim lên đầu topic'
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason'
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'approved_at'
    },
    approvedBy: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'approved_by'
    },
    deletedAt: { 
      type: DataTypes.DATE,
      field: 'deleted_at'
    },
  }, {
    tableName: 'questions',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
  });

  Question.associate = (models) => {
    Question.belongsTo(models.Topic, { foreignKey: 'topicId', as: 'topic' });
    Question.belongsTo(models.User, { foreignKey: 'authorId', as: 'author' });
    Question.belongsTo(models.Specialty, { foreignKey: 'specialtyId', as: 'specialty' });
    Question.hasMany(models.Answer, { foreignKey: 'questionId', as: 'answers' });
    Question.hasMany(models.Interaction, { foreignKey: 'entity_id', constraints: false, scope: { entity_type: 'question' } });
  };

  console.log('SUCCESS: Model Question đã được định nghĩa.');
  return Question;
};