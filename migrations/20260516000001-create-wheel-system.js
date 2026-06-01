'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Bảng sự kiện vòng quay (mỗi vòng quay = 1 event độc lập)
    await queryInterface.createTable('wheel_events', {
      id:            { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      name:          { type: Sequelize.STRING, allowNull: false },
      description:   { type: Sequelize.TEXT, allowNull: true },
      banner_url:    { type: Sequelize.STRING, allowNull: true },
      start_date:    { type: Sequelize.DATE, allowNull: false },
      end_date:      { type: Sequelize.DATE, allowNull: false },
      is_active:     { type: Sequelize.BOOLEAN, defaultValue: true },
      spins_per_day: { type: Sequelize.INTEGER, defaultValue: 3 },
      cost_per_spin: { type: Sequelize.INTEGER, defaultValue: 10 },
      created_at:    { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:    { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // Bảng lịch sử mỗi lần quay (lưu người, thời gian, kết quả)
    await queryInterface.createTable('game_plays', {
      id:            { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      user_id:       { type: Sequelize.BIGINT, allowNull: false },
      wheel_event_id:{ type: Sequelize.BIGINT, allowNull: true },
      promotion_id:  { type: Sequelize.BIGINT, allowNull: true, comment: 'null = miss' },
      result:        { type: Sequelize.ENUM('win','miss'), allowNull: false },
      points_spent:  { type: Sequelize.INTEGER, defaultValue: 10 },
      reward_name:   { type: Sequelize.STRING, allowNull: true },
      created_at:    { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:    { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    // Bảng phần thưởng của từng vòng quay
    await queryInterface.createTable('wheel_prizes', {
      id:             { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      wheel_event_id: { type: Sequelize.BIGINT, allowNull: false },
      promotion_id:   { type: Sequelize.BIGINT, allowNull: true, comment: 'null = ô mất lượt' },
      label:          { type: Sequelize.STRING, allowNull: false },
      probability:    { type: Sequelize.DECIMAL(5,2), defaultValue: 0 },
      quantity:       { type: Sequelize.INTEGER, defaultValue: -1, comment: '-1 = không giới hạn' },
      quantity_won:   { type: Sequelize.INTEGER, defaultValue: 0 },
      color:          { type: Sequelize.STRING(20), allowNull: true },
      is_miss:        { type: Sequelize.BOOLEAN, defaultValue: false },
      sort_order:     { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at:     { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:     { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('game_plays', ['user_id']);
    await queryInterface.addIndex('game_plays', ['wheel_event_id']);
    await queryInterface.addIndex('wheel_prizes', ['wheel_event_id']);
    console.log('✅ Wheel system tables created');
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('wheel_prizes');
    await queryInterface.dropTable('game_plays');
    await queryInterface.dropTable('wheel_events');
  }
};