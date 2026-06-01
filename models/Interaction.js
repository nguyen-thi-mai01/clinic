// server/models/Interaction.js - Enhanced Version
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Interaction = sequelize.define('Interaction', {
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true 
    },
    user_id: { 
      type: DataTypes.BIGINT,
      allowNull: true, // Cho phép null để tracking lượt xem ẩn danh
      comment: 'ID người dùng thực hiện tương tác'
    },
    entity_type: { 
      type: DataTypes.ENUM('article', 'question', 'answer', 'medicine', 'disease'), 
      allowNull: false,
      comment: 'Loại nội dung được tương tác'
    },
    entity_id: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      comment: 'ID của nội dung được tương tác'
    },
    interaction_type: { 
      type: DataTypes.ENUM('view', 'like', 'share', 'save', 'report', 'bookmark', 'comment'), 
      allowNull: false,
      comment: 'Loại tương tác: xem, thích, chia sẻ, lưu, báo cáo, đánh dấu, bình luận'
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP address để tracking view từ người dùng ẩn danh'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Thông tin trình duyệt'
    },
    reason: { 
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Lý do báo cáo hoặc ghi chú'
    },
    metadata_json: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Dữ liệu bổ sung: platform chia sẻ, vị trí share, thời gian xem...'
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
    tableName: 'interactions',
    timestamps: true,
    underscored: true,
    indexes: [
      // Index cho query nhanh theo entity
      { fields: ['entity_type', 'entity_id'] },
      // Index cho query theo user
      { fields: ['user_id'] },
      // Index cho query theo loại tương tác
      { fields: ['interaction_type'] },
      // Index unique để tránh duplicate (trừ view)
      { 
        unique: true, 
        fields: ['user_id', 'entity_type', 'entity_id', 'interaction_type'],
        name: 'unique_user_interaction',
        where: {
          interaction_type: { [sequelize.Sequelize.Op.ne]: 'view' },
          user_id: { [sequelize.Sequelize.Op.ne]: null }
        }
      },
      // Index cho tracking view theo IP (tránh spam view)
      {
        fields: ['ip_address', 'entity_type', 'entity_id', 'interaction_type'],
        name: 'idx_ip_entity_interaction'
      }
    ]
  });

  Interaction.associate = (models) => {
    Interaction.belongsTo(models.User, { 
      foreignKey: 'user_id',
      as: 'user'
    });
    
    // Polymorphic associations
    Interaction.belongsTo(models.Article, { 
      foreignKey: 'entity_id', 
      constraints: false, 
      scope: { entity_type: 'article' },
      as: 'article'
    });
    
    Interaction.belongsTo(models.Question, { 
      foreignKey: 'entity_id', 
      constraints: false, 
      scope: { entity_type: 'question' },
      as: 'question'
    });
    
    Interaction.belongsTo(models.Answer, { 
      foreignKey: 'entity_id', 
      constraints: false, 
      scope: { entity_type: 'answer' },
      as: 'answer'
    });
    
    Interaction.belongsTo(models.Medicine, { 
      foreignKey: 'entity_id', 
      constraints: false, 
      scope: { entity_type: 'medicine' },
      as: 'medicine'
    });
    
    Interaction.belongsTo(models.Disease, { 
      foreignKey: 'entity_id', 
      constraints: false, 
      scope: { entity_type: 'disease' },
      as: 'disease'
    });
  };

  // Helper methods
  Interaction.getStats = async function(entityType, entityId) {
    const stats = await this.findAll({
      where: { 
        entity_type: entityType, 
        entity_id: entityId 
      },
      attributes: [
        'interaction_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['interaction_type']
    });

    return stats.reduce((acc, stat) => {
      acc[stat.interaction_type] = parseInt(stat.dataValues.count);
      return acc;
    }, {});
  };

  console.log('SUCCESS: Model Interaction (Enhanced) đã được định nghĩa.');
  return Interaction;
};