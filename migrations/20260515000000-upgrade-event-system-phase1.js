'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Thêm cột cho bảng events
    await queryInterface.addColumn('events', 'offline_config', { type: Sequelize.JSON, allowNull: true });
    await queryInterface.addColumn('events', 'is_fee_required', { type: Sequelize.BOOLEAN, defaultValue: false });
    await queryInterface.addColumn('events', 'fee_amount', { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 });
    await queryInterface.addColumn('events', 'is_guest_allowed', { type: Sequelize.BOOLEAN, defaultValue: false });
    await queryInterface.addColumn('events', 'gift_config', { type: Sequelize.JSON, allowNull: true });

    // 2. Thêm cột cho bảng event_registrations
    await queryInterface.addColumn('event_registrations', 'checked_out_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('event_registrations', 'payment_id', { type: Sequelize.BIGINT, allowNull: true });
    await queryInterface.addColumn('event_registrations', 'gift_status', {
      type: Sequelize.ENUM('none', 'pending', 'distributed'),
      defaultValue: 'none'
    });
    await queryInterface.addColumn('event_registrations', 'gift_received_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('event_registrations', 'digital_signature', { type: Sequelize.TEXT('long'), allowNull: true });

    console.log('✅ Phase 1: Event System DB Upgraded Successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert events
    const eventCols = ['offline_config', 'is_fee_required', 'fee_amount', 'is_guest_allowed', 'gift_config'];
    for (const col of eventCols) {
      await queryInterface.removeColumn('events', col).catch(() => {});
    }

    // Revert event_registrations
    const regCols = ['checked_out_at', 'payment_id', 'gift_status', 'gift_received_at', 'digital_signature'];
    for (const col of regCols) {
      await queryInterface.removeColumn('event_registrations', col).catch(() => {});
    }
  }
};