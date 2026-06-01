// server/models/ConsultationReport.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ConsultationReport = sequelize.define('ConsultationReport', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    
    consultation_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'consultations',
        key: 'id'
      }
    },
    
    reporter_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Người báo cáo (bác sĩ hoặc bệnh nhân)'
    },
    
    report_type: {
  type: DataTypes.ENUM(
    'technical',
    'behavior', 
    'emergency',
    'security',
    'no_video',
    'no_audio',
    'connection_lost',
    'poor_quality',
    'network_issue',
    'server_error',
    'other'
  ),
    allowNull: false,
    defaultValue: 'other',
    comment: 'Loại sự cố báo cáo'
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Mô tả chi tiết sự cố'
  },

  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false,
    defaultValue: 'medium',
    comment: 'Mức độ ưu tiên'
  },

  status: {
    type: DataTypes.ENUM('pending', 'acknowledged', 'investigating', 'resolved', 'wont_fix', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
    comment: 'Trạng thái xử lý báo cáo'
  },
    
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Ghi chú của admin khi xử lý'
    },
    
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    resolved_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
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
    tableName: 'consultation_reports',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['consultation_id'] },
      { fields: ['reporter_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] }
    ]
  });

  ConsultationReport.associate = (models) => {
    ConsultationReport.belongsTo(models.Consultation, {
      foreignKey: 'consultation_id',
      as: 'consultation'
    });
    
    ConsultationReport.belongsTo(models.User, {
      foreignKey: 'reporter_id',
      as: 'reporter'
    });
    
    ConsultationReport.belongsTo(models.User, {
      foreignKey: 'resolved_by',
      as: 'resolver'
    });
  };

  return ConsultationReport;
};