const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Report = sequelize.define('Report', {
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true 
    },
    reporterId: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      field: 'reporter_id',
      comment: 'ID của người báo cáo'
    },
    entityType: {
      type: DataTypes.ENUM('question', 'answer'),
      allowNull: false,
      field: 'entity_type',
      comment: 'Loại nội dung bị báo cáo'
    },
    entityId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'entity_id',
      comment: 'ID của câu hỏi hoặc câu trả lời'
    },
    reason: {
      type: DataTypes.ENUM(
        'spam',
        'inappropriate',
        'misleading',
        'offensive',
        'other'
      ),
      allowNull: false,
      comment: 'Lý do báo cáo'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Mô tả chi tiết về vấn đề'
    },
    status: {
      type: DataTypes.ENUM('pending', 'reviewed', 'resolved', 'dismissed'),
      defaultValue: 'pending',
      comment: 'Trạng thái xử lý: pending=chờ xử lý, reviewed=đã xem, resolved=đã giải quyết, dismissed=bỏ qua'
    },
    reviewedBy: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'reviewed_by',
      comment: 'ID admin xem xét'
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at'
    },
    adminNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'admin_note',
      comment: 'Ghi chú của admin'
    },
  }, {
    tableName: 'reports',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Report.associate = (models) => {
    Report.belongsTo(models.User, { 
      foreignKey: 'reporterId', 
      as: 'reporter' 
    });
    Report.belongsTo(models.User, { 
      foreignKey: 'reviewedBy', 
      as: 'reviewer' 
    });
    Report.belongsTo(models.Question, {
      foreignKey: 'entityId',
      constraints: false,
      as: 'question'
    });
    Report.belongsTo(models.Answer, {
      foreignKey: 'entityId',
      constraints: false,
      as: 'answer'
    });
  };

  console.log('SUCCESS: Model Report đã được định nghĩa.');
  return Report;
};
