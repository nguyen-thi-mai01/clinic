'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Đổi proof_image_url từ VARCHAR sang LONGTEXT để chứa base64
    await queryInterface.changeColumn('payments', 'proof_image_url', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'URL hoặc base64 của ảnh biên lai'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Rollback về VARCHAR(500)
    await queryInterface.changeColumn('payments', 'proof_image_url', {
      type: Sequelize.STRING(500),
      allowNull: true
    });
  }
};
