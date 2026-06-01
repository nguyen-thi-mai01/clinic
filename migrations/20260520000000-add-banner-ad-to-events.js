'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('events');
    if (!table.is_banner_ad) {
      await queryInterface.addColumn('events', 'is_banner_ad', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      });
    }
    if (!table.banner_ad_config) {
      await queryInterface.addColumn('events', 'banner_ad_config', {
        type: Sequelize.JSON,
        allowNull: true
      });
    }
    console.log('✅ Banner ad fields added to events');
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('events', 'is_banner_ad').catch(() => {});
    await queryInterface.removeColumn('events', 'banner_ad_config').catch(() => {});
  }
};