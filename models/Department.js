// server/models/Department.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Department = sequelize.define('Department', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    code: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
      comment: 'Mã phòng ban: CLINICAL, SYSTEM, SUPPORT, FINANCE, CONTENT'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Tên phòng ban'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Mô tả chức năng phòng ban'
    },
    manager_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'Staff ID của trưởng phòng'
    },
    default_permissions: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Quyền mặc định cho nhân viên phòng ban này'
    },
    manager_permissions: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Quyền mặc định cho trưởng phòng'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
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
    tableName: 'departments',
    timestamps: true,
    underscored: true
  });

  Department.associate = (models) => {
    // NOTE: Không tạo foreign key với Staff.department vì department là ENUM
    // Chỉ dùng giá trị để query, không enforce ở DB level
    
    // Trưởng phòng
    Department.belongsTo(models.Staff, {
      foreignKey: 'manager_id',
      as: 'manager'
    });
  };

  console.log('SUCCESS: Model Department đã được định nghĩa.');
  return Department;
};
