// ✅ TẠO FILE MỚI (chỉ chạy nếu bảng events đã tồn tại nhưng thiếu cột)
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('events');
    
    // Kiểm tra và thêm cột gallery nếu chưa có
    if (!tableInfo.gallery) {
      await queryInterface.addColumn('events', 'gallery', {
        type: Sequelize.JSON,
        defaultValue: [],
        comment: 'Mảng chứa URL ảnh album'
      });
    }

    // Kiểm tra và thêm cột location nếu chưa có
    if (!tableInfo.location) {
      await queryInterface.addColumn('events', 'location', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    console.log('✅ Events table updated successfully');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('events', 'gallery');
    await queryInterface.removeColumn('events', 'location');
  }
};