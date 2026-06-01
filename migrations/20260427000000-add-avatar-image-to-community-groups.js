'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Kiểm tra xem cột avatar_image đã tồn tại chưa
      const table = await queryInterface.describeTable('community_groups', { transaction });
      
      if (!table.avatar_image) {
        console.log('✅ Thêm cột avatar_image vào bảng community_groups...');
        await queryInterface.addColumn('community_groups', 'avatar_image', {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: 'URL ảnh đại diện nhóm (avatar, khác ảnh bìa)',
        }, { transaction });
      } else {
        console.log('⚠️ Cột avatar_image đã tồn tại, bỏ qua.');
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const table = await queryInterface.describeTable('community_groups', { transaction });
      
      if (table.avatar_image) {
        console.log('🔙 Xóa cột avatar_image từ bảng community_groups...');
        await queryInterface.removeColumn('community_groups', 'avatar_image', { transaction });
      }
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
