'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('event_registrations', {
      id:             { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      event_id:       { type: Sequelize.BIGINT, allowNull: false },
      user_id:        { type: Sequelize.BIGINT, allowNull: true },
      guest_name:     { type: Sequelize.STRING, allowNull: true },
      guest_email:    { type: Sequelize.STRING, allowNull: true },
      guest_phone:    { type: Sequelize.STRING, allowNull: true },
      attendee_count: { type: Sequelize.INTEGER, defaultValue: 1 },
      qr_code:        { type: Sequelize.STRING, unique: true },
      checked_in:     { type: Sequelize.BOOLEAN, defaultValue: false },
      checked_in_at:  { type: Sequelize.DATE, allowNull: true },
      status:         { type: Sequelize.ENUM('registered','confirmed','cancelled','waitlist','attended','no_show'), defaultValue: 'registered' },
      notes:          { type: Sequelize.TEXT, allowNull: true },
      created_at:     { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:     { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('event_registrations', ['event_id']);
    await queryInterface.addIndex('event_registrations', ['user_id']);
    await queryInterface.addIndex('event_registrations', ['qr_code']);
    console.log('✅ event_registrations table created');
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('event_registrations');
  }
};