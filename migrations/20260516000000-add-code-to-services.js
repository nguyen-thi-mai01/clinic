// Migration: Thêm code field vào Service
// Mục đích: Lưu mã dịch vụ (ví dụ: SVC-001-KHTQ)
// Chạy: npx sequelize-cli db:migrate --name 20260516000000-add-code-to-services

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      console.log('[MIGRATION] 🟢 Bắt đầu thêm code field vào bảng services...');

      // Thêm cột code
      await queryInterface.addColumn(
        'services',
        'code',
        {
          type: Sequelize.STRING(50),
          allowNull: true,
          unique: true,
          comment: 'Mã dịch vụ, ví dụ: SVC-001-KHTQ, KHTQ-001',
          defaultValue: null
        },
        { transaction }
      );

      console.log('[MIGRATION] ✅ Đã thêm code field thành công');

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
      console.log('[MIGRATION] 🟡 Rollback: Xóa code field...');

      await queryInterface.removeColumn('services', 'code', { transaction });

      console.log('[MIGRATION] ✅ Rollback hoàn tất');
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('[MIGRATION] ❌ Lỗi rollback:', error.message);
      throw error;
    }
  }
};
