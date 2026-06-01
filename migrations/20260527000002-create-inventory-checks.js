'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Bảng phiên kiểm kê
    await queryInterface.createTable('inventory_checks', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      checked_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'FK → users.id'
      },
      checked_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      status: {
        type: Sequelize.ENUM('draft', 'completed'),
        defaultValue: 'draft',
        comment: 'draft=đang kiểm kê | completed=đã hoàn tất'
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      total_items: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      discrepancy_items: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Số mục có sai lệch'
      },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    // Bảng chi tiết từng dòng kiểm kê
    await queryInterface.createTable('inventory_check_items', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      check_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        comment: 'FK → inventory_checks.id'
      },
      medicine_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        comment: 'FK → medicines.id'
      },
      batch_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'FK → medicine_batches.id'
      },
      system_qty: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Số lượng hệ thống tại thời điểm kiểm kê'
      },
      actual_qty: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Số lượng thực tế đếm được'
      },
      diff: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'actual_qty - system_qty (âm = thiếu, dương = thừa)'
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    // Index cho check_items
    await queryInterface.addIndex('inventory_check_items', ['check_id'], {
      name: 'idx_check_items_check_id'
    });
    await queryInterface.addIndex('inventory_check_items', ['medicine_id'], {
      name: 'idx_check_items_medicine_id'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('inventory_check_items');
    await queryInterface.dropTable('inventory_checks');
  }
};