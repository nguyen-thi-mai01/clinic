const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const WheelEvent = sequelize.define('WheelEvent', {
    id:            { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    name:          { type: DataTypes.STRING, allowNull: false },
    description:   { type: DataTypes.TEXT },
    banner_url:    { type: DataTypes.STRING },
    start_date:    { type: DataTypes.DATE, allowNull: false },
    end_date:      { type: DataTypes.DATE, allowNull: false },
    is_active:     { type: DataTypes.BOOLEAN, defaultValue: true },
    spins_per_day: { type: DataTypes.INTEGER, defaultValue: 3 },
    cost_per_spin: { type: DataTypes.INTEGER, defaultValue: 10 },
  }, { tableName: 'wheel_events', underscored: true });

  WheelEvent.associate = (models) => {
    WheelEvent.hasMany(models.WheelPrize, { foreignKey: 'wheel_event_id', as: 'prizes' });
    WheelEvent.hasMany(models.GamePlay,   { foreignKey: 'wheel_event_id', as: 'plays'  });
  };
  return WheelEvent;
};