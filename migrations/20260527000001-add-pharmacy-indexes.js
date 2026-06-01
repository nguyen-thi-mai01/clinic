'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Index composite cho stock_transactions: query lịch sử theo thuốc + thời gian
    await queryInterface.addIndex('stock_transactions', ['medicine_id', 'created_at'], {
      name: 'idx_stock_tx_medicine_date'
    });

    // Index composite cho stock_transactions: query theo loại GD + thời gian (revenue report)
    await queryInterface.addIndex('stock_transactions', ['type', 'created_at'], {
      name: 'idx_stock_tx_type_date'
    });

    // Index composite cho medicine_batches: query cảnh báo hết hạn
    await queryInterface.addIndex('medicine_batches', ['expiry_date', 'status'], {
      name: 'idx_batch_expiry_status'
    });

    // Index composite cho medicine_batches: query FEFO (lấy lô theo thuốc + hạn gần nhất)
    await queryInterface.addIndex('medicine_batches', ['medicine_id', 'expiry_date', 'status'], {
      name: 'idx_batch_medicine_fefo'
    });

    // Index cho medicines: query tồn kho thấp / hết hàng
    await queryInterface.addIndex('medicines', ['stock_total', 'hidden'], {
      name: 'idx_medicine_stock_hidden'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('stock_transactions', 'idx_stock_tx_medicine_date');
    await queryInterface.removeIndex('stock_transactions', 'idx_stock_tx_type_date');
    await queryInterface.removeIndex('medicine_batches', 'idx_batch_expiry_status');
    await queryInterface.removeIndex('medicine_batches', 'idx_batch_medicine_fefo');
    await queryInterface.removeIndex('medicines', 'idx_medicine_stock_hidden');
  }
};