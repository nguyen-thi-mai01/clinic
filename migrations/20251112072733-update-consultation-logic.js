'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.beginTransaction();
    try {
      console.log('Bắt đầu migration Logic B...');

      // === 1. Sửa bảng consultation_pricing ===

      // Xóa các cột Logic A (bảng giá theo bác sĩ)
      console.log('Xóa cột doctor_id khỏi consultation_pricing...');
      await queryInterface.removeColumn('consultation_pricing', 'doctor_id', { transaction });

      console.log('Xóa các cột giá cũ...');
      await queryInterface.removeColumn('consultation_pricing', 'chat_fee', { transaction });
      await queryInterface.removeColumn('consultation_pricing', 'video_fee', { transaction });
      await queryInterface.removeColumn('consultation_pricing', 'offline_fee', { transaction });

      console.log('Xóa các cột thời lượng cũ...');
      await queryInterface.removeColumn('consultation_pricing', 'chat_duration', { transaction });
      await queryInterface.removeColumn('consultation_pricing', 'video_duration', { transaction });
      await queryInterface.removeColumn('consultation_pricing', 'offline_duration', { transaction });

      console.log('Xóa các cột allow cũ...');
      await queryInterface.removeColumn('consultation_pricing', 'allow_chat', { transaction });
      await queryInterface.removeColumn('consultation_pricing', 'allow_video', { transaction });
      await queryInterface.removeColumn('consultation_pricing', 'allow_offline', { transaction });

      await queryInterface.removeColumn('consultation_pricing', 'working_hours', { transaction });

      // Thêm các cột Logic B (gói sản phẩm)
      console.log('Thêm các cột Logic B vào consultation_pricing...');
      await queryInterface.addColumn('consultation_pricing', 'package_type', {
        type: DataTypes.ENUM('chat', 'video', 'offline'),
        allowNull: false,
        defaultValue: 'chat',
        after: 'description'
      }, { transaction });

      await queryInterface.addColumn('consultation_pricing', 'duration_minutes', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
        after: 'package_type'
      }, { transaction });

      await queryInterface.addColumn('consultation_pricing', 'price', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 100000,
        after: 'duration_minutes'
      }, { transaction });

      // === 2. Sửa bảng consultations ===

      console.log('Thêm cột consultation_pricing_id vào consultations...');
      await queryInterface.addColumn('consultations', 'consultation_pricing_id', {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
          model: 'consultation_pricing',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        after: 'specialty_id'
      }, { transaction });

      await transaction.commit();
      console.log('Migration Logic B hoàn tất!');

    } catch (err) {
      await transaction.rollback();
      console.error('Migration thất bại:', err);
      throw err;
    }
  },

  async down (queryInterface, Sequelize) {
    // (Logic để rollback nếu cần, tạm thời có thể bỏ qua)
    console.log('Không hỗ trợ rollback tự động cho migration phức tạp này.');
  }
};