// server/models/WorkShiftConfig.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WorkShiftConfig = sequelize.define('WorkShiftConfig', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    shift_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'morning, afternoon, evening, night' // Cập nhật thêm night
    },
    display_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Ca sáng, Ca chiều, Ca tối'
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: 'VD: 07:00:00'
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: 'VD: 12:00:00'
    },
    days_of_week: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [1, 2, 3, 4, 5, 6],
      comment: 'Array: [1,2,3,4,5,6] - Thứ 2-7, CN=0'
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
    tableName: 'work_shift_config',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['shift_name'] },
      { fields: ['is_active'] }
    ]
  });

  // No associations needed - standalone config table

  // Static method để lấy config active
  WorkShiftConfig.getActiveShifts = async function() {
    return await this.findAll({
      where: { is_active: true },
      order: [['start_time', 'ASC']]
    });
  };

  console.log('SUCCESS: Model WorkShiftConfig đã được định nghĩa.');
  return WorkShiftConfig;
};