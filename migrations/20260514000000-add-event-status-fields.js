'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('events');

    if (!table.status) {
      await queryInterface.addColumn('events', 'status', {
        type: Sequelize.ENUM('draft','pending','approved','scheduled','ongoing','ended','cancelled','postponed'),
        defaultValue: 'draft'
      });
    }
    if (!table.event_category) {
      await queryInterface.addColumn('events', 'event_category', {
        type: Sequelize.ENUM('workshop','free_exam','blood_donation','livestream','webinar','vaccination','promotion','launch','charity','internal','minigame','course'),
        defaultValue: 'workshop'
      });
    }
    if (!table.format) {
      await queryInterface.addColumn('events', 'format', {
        type: Sequelize.ENUM('offline','online','hybrid'),
        defaultValue: 'offline'
      });
    }
    if (!table.online_config) {
      await queryInterface.addColumn('events', 'online_config', { type: Sequelize.JSON, allowNull: true });
    }
    if (!table.registration_limit) {
      await queryInterface.addColumn('events', 'registration_limit', { type: Sequelize.INTEGER, allowNull: true });
    }
    if (!table.registration_count) {
      await queryInterface.addColumn('events', 'registration_count', { type: Sequelize.INTEGER, defaultValue: 0 });
    }
    if (!table.registration_open_at) {
      await queryInterface.addColumn('events', 'registration_open_at', { type: Sequelize.DATE, allowNull: true });
    }
    if (!table.registration_close_at) {
      await queryInterface.addColumn('events', 'registration_close_at', { type: Sequelize.DATE, allowNull: true });
    }
    if (!table.priority) {
      await queryInterface.addColumn('events', 'priority', {
        type: Sequelize.ENUM('low','normal','high','urgent'),
        defaultValue: 'normal'
      });
    }
    if (!table.tags) {
      await queryInterface.addColumn('events', 'tags', { type: Sequelize.JSON, defaultValue: [] });
    }
    console.log('✅ Event status fields added');
  },
  down: async (queryInterface) => {
    const cols = ['status','event_category','format','online_config','registration_limit','registration_count','registration_open_at','registration_close_at','priority','tags'];
    for (const col of cols) {
      await queryInterface.removeColumn('events', col).catch(() => {});
    }
  }
};