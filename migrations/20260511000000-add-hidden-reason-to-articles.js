// Migration: Thêm hidden_reason field vào Article
// Mục đích: Lưu lý do tại sao bài viết bị ẩn (để tác giả xem và biết cách sửa)

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      console.log('[MIGRATION] 🟢 Bắt đầu thêm hidden_reason field vào bảng articles...');

      // Thêm cột hidden_reason
      await queryInterface.addColumn(
        'articles',
        'hidden_reason',
        {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Lý do bài viết bị ẩn (dành cho tác giả xem)'
        },
        { transaction }
      );

      console.log('[MIGRATION] ✅ Đã thêm hidden_reason field thành công');

      await transaction.commit();
      console.log('[MIGRATION] ✅ Migration hoàn tất');
    } catch (error) {
      await transaction.rollback();
      console.error('[MIGRATION] ❌ Lỗi:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      console.log('[MIGRATION] 🟡 Rollback: Xóa hidden_reason field...');

      await queryInterface.removeColumn('articles', 'hidden_reason', { transaction });

      console.log('[MIGRATION] ✅ Rollback hoàn tất');
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('[MIGRATION] ❌ Lỗi rollback:', error.message);
      throw error;
    }
  }
};
