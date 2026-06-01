'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const columns = await queryInterface.describeTable('consultations');

      if (!columns.payment_due_at) {
        await queryInterface.addColumn(
          'consultations',
          'payment_due_at',
          {
            type: Sequelize.DATE,
            allowNull: true,
            comment: 'Hạn cuối cần hoàn tất thanh toán để giữ lịch tư vấn'
          },
          { transaction }
        );
      }

      await queryInterface.addIndex('consultations', ['payment_due_at'], {
        name: 'consultations_payment_due_at_idx',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex('consultations', 'consultations_payment_due_at_idx', { transaction });
      await queryInterface.removeColumn('consultations', 'payment_due_at', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
