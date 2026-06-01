const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const GamePlay = sequelize.define('GamePlay', {
    id:             { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id:        { type: DataTypes.BIGINT, allowNull: false },
    wheel_event_id: { type: DataTypes.BIGINT, allowNull: true },
    promotion_id:   { type: DataTypes.BIGINT, allowNull: true },
    result:         { type: DataTypes.ENUM('win','miss'), allowNull: false },
    points_spent:   { type: DataTypes.INTEGER, defaultValue: 10 },
    reward_name:    { type: DataTypes.STRING },
  }, { tableName: 'game_plays', underscored: true });

  GamePlay.associate = (models) => {
    GamePlay.belongsTo(models.User,       { foreignKey: 'user_id',        as: 'user'       });
    GamePlay.belongsTo(models.WheelEvent, { foreignKey: 'wheel_event_id', as: 'wheelEvent' });
    GamePlay.belongsTo(models.Promotion,  { foreignKey: 'promotion_id',   as: 'promotion'  });
  };
  return GamePlay;
};