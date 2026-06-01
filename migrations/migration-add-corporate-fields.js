// Migration: Thêm corporate fields vào Service và Appointment
// Chạy: npx sequelize-cli db:migrate --name migration-add-corporate-fields

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      console.log('[MIGRATION] Bắt đầu thêm corporate fields...');

      // 1️⃣ Thêm cột vào bảng services
      console.log('[MIGRATION] Thêm is_corp và corp_opts vào bảng services...');
      await queryInterface.addColumn(
        'services',
        'is_corp',
        {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
          comment: 'Dịch vụ dành cho đặt lịch theo doanh nghiệp/sự kiện'
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'services',
        'corp_opts',
        {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Tùy chọn corporate: { window_days_limit, max_participants, price_per_person, requires_approval }'
        },
        { transaction }
      );

      // 2️⃣ Thêm cột vào bảng appointments
      console.log('[MIGRATION] Thêm corp_window và corp_data vào bảng appointments...');
      await queryInterface.addColumn(
        'appointments',
        'corp_window',
        {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'Mã cửa sổ đặt lịch doanh nghiệp (ví dụ: CW-2026-05-COMPANY001)'
        },
        { transaction }
      );

      await queryInterface.addColumn(
        'appointments',
        'corp_data',
        {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Thông tin doanh nghiệp: { corp_name, corp_id, corp_code, window_id, reg_user_id }'
        },
        { transaction }
      );

      // 3️⃣ Tạo index cho tìm kiếm nhanh
      console.log('[MIGRATION] Tạo index cho corporate fields...');
      await queryInterface.addIndex('appointments', ['corp_window'], {
        transaction,
        name: 'idx_appointments_corp_window'
      });

      await queryInterface.addIndex('services', ['is_corp'], {
        transaction,
        name: 'idx_services_is_corp'
      });

      await transaction.commit();
      console.log('[MIGRATION] ✅ Hoàn thành thêm corporate fields');
    } catch (error) {
      await transaction.rollback();
      console.error('[MIGRATION] ❌ Lỗi:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      console.log('[MIGRATION-DOWN] Bắt đầu rollback corporate fields...');

      // Xóa index
      await queryInterface.removeIndex('appointments', 'idx_appointments_corp_window', { transaction });
      await queryInterface.removeIndex('services', 'idx_services_is_corp', { transaction });

      // Xóa cột
      await queryInterface.removeColumn('services', 'is_corp', { transaction });
      await queryInterface.removeColumn('services', 'corp_opts', { transaction });
      await queryInterface.removeColumn('appointments', 'corp_window', { transaction });
      await queryInterface.removeColumn('appointments', 'corp_data', { transaction });

      await transaction.commit();
      console.log('[MIGRATION-DOWN] ✅ Rollback hoàn thành');
    } catch (error) {
      await transaction.rollback();
      console.error('[MIGRATION-DOWN] ❌ Lỗi:', error.message);
      throw error;
    }
  }
};
