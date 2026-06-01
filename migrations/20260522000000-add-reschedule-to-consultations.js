'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('consultations', 'is_rescheduled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      after: 'cancelled_at'
    });
    await queryInterface.addColumn('consultations', 'rescheduled_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'is_rescheduled'
    });
    await queryInterface.addColumn('consultations', 'original_appointment_time', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'rescheduled_at'
    });
    await queryInterface.addColumn('consultations', 'reschedule_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'original_appointment_time'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('consultations', 'is_rescheduled');
    await queryInterface.removeColumn('consultations', 'rescheduled_at');
    await queryInterface.removeColumn('consultations', 'original_appointment_time');
    await queryInterface.removeColumn('consultations', 'reschedule_reason');
  }
};