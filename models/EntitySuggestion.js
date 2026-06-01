// server/models/EntitySuggestion.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EntitySuggestion = sequelize.define('EntitySuggestion', {
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true,
      comment: 'ID đề xuất'
    },
    entity_type: { 
      type: DataTypes.ENUM('medicine', 'disease'), 
      allowNull: false,
      comment: 'Loại đề xuất: thuốc hoặc bệnh lý'
    },
    entity_id: { 
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'ID thuốc/bệnh lý (NULL nếu đề xuất thêm mới)'
    },
    user_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      comment: 'ID người đề xuất (staff/doctor)'
    },
    suggestion_type: { 
      type: DataTypes.ENUM('create', 'update'), 
      allowNull: false,
      comment: 'Loại: thêm mới hoặc cập nhật'
    },
    suggested_data: { 
      type: DataTypes.JSON, 
      allowNull: false,
      comment: 'Dữ liệu đề xuất dạng JSON'
    },
    reason: { 
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Lý do đề xuất (bắt buộc với update)'
    },
    status: { 
      type: DataTypes.ENUM('pending', 'approved', 'rejected'), 
      defaultValue: 'pending',
      comment: 'Trạng thái: chờ duyệt, chấp thuận, từ chối'
    },
    admin_id: { 
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'ID admin xử lý'
    },
    admin_note: { 
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Ghi chú của admin khi xử lý'
    },
    created_at: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW,
      comment: 'Thời gian tạo'
    },
    updated_at: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW,
      comment: 'Thời gian cập nhật'
    }
  }, {
    tableName: 'entity_suggestions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['entity_type'] },
      { fields: ['status'] },
      { fields: ['user_id'] },
      { fields: ['admin_id'] },
      { fields: ['entity_type', 'entity_id'] }
    ],
    comment: 'Bảng lưu đề xuất thêm/sửa thuốc và bệnh lý'
  });

  EntitySuggestion.associate = (models) => {
    // Liên kết với User (người đề xuất)
    EntitySuggestion.belongsTo(models.User, { 
      foreignKey: 'user_id',
      as: 'user'
    });

    // Liên kết với User (admin xử lý)
    EntitySuggestion.belongsTo(models.User, { 
      foreignKey: 'admin_id',
      as: 'admin'
    });

    // Liên kết đa hình với Medicine
    EntitySuggestion.belongsTo(models.Medicine, { 
      foreignKey: 'entity_id',
      constraints: false,
      as: 'medicine'
    });

    // Liên kết đa hình với Disease
    EntitySuggestion.belongsTo(models.Disease, { 
      foreignKey: 'entity_id',
      constraints: false,
      as: 'disease'
    });
  };

  console.log('SUCCESS: Model EntitySuggestion đã được định nghĩa.');
  return EntitySuggestion;
};