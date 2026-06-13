'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('consultation_pricing', 'image_url', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'description'
    });
    await queryInterface.addColumn('consultation_pricing', 'features', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      after: 'image_url'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('consultation_pricing', 'image_url');
    await queryInterface.removeColumn('consultation_pricing', 'features');
  }
};