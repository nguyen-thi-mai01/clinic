'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('specialties', 'icon', {
      type: Sequelize.STRING(100),
      defaultValue: 'FaStethoscope',
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('specialties', 'icon');
  }
};
