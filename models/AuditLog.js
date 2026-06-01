const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    
    user_id: { type: DataTypes.BIGINT, allowNull: true },
    action_type: { 
      type: DataTypes.STRING(50), 
      allowNull: false, 
      comment: 'permission_change, staff_create, staff_update, staff_delete, login, logout, etc.' 
    },
    
    target_type: { 
      type: DataTypes.STRING(50), 
      allowNull: true,
      comment: 'staff, user, department, system'
    },
    target_id: { type: DataTypes.BIGINT, allowNull: true },
    target_name: { 
      type: DataTypes.STRING(255), 
      allowNull: true,
      comment: 'Name for quick display'
    },
    
    details: { 
      type: DataTypes.JSON, 
      allowNull: true,
      comment: 'Additional info: old_value, new_value, changes, etc.'
    },
    
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
    user_agent: { type: DataTypes.TEXT, allowNull: true },
    
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'audit_logs',
    timestamps: false,
    underscored: true
  });

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return AuditLog;
};