// server/migrations/20251212000004-add-doctor-codes-to-consultation-pricing.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('consultation_pricing', 'doctor_codes', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Danh sách CODE bác sĩ thực hiện dịch vụ tư vấn [DR00001, DR00002] - Tương tự services.doctor_codes'
    });
    
    console.log('✅ Đã thêm cột doctor_codes vào bảng consultation_pricing');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('consultation_pricing', 'doctor_codes');
    console.log('✅ Đã xóa cột doctor_codes khỏi bảng consultation_pricing');
  }
};
