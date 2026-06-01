// server/migrations/008-update-questions-for-anonymous-and-multi-specialty.js
const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Running migration 008: Update Questions for Anonymous & Multi-Specialty...');
    
    try {
      // 1. Thêm cột anonymous_code
      await queryInterface.addColumn('questions', 'anonymous_code', {
        type: DataTypes.STRING(10),
        allowNull: true,
        comment: 'Mã ẩn danh random 5 ký tự'
      });
      console.log('  ✅ Added anonymous_code column');

      // 2. Thêm cột specialty_ids (JSON array)
      await queryInterface.addColumn('questions', 'specialty_ids', {
        type: DataTypes.JSON,
        defaultValue: '[]',
        comment: 'Array of specialty IDs - có thể chọn nhiều'
      });
      console.log('  ✅ Added specialty_ids column');

      // 3. Thêm cột attachments (JSON array)
      await queryInterface.addColumn('questions', 'attachments', {
        type: DataTypes.JSON,
        defaultValue: '[]',
        comment: 'Array of file URLs - tối đa 5 files'
      });
      console.log('  ✅ Added attachments column');

      // 4. Migrate dữ liệu cũ: Copy specialty_id sang specialty_ids array
      const [questions] = await queryInterface.sequelize.query(
        'SELECT id, specialty_id FROM questions WHERE specialty_id IS NOT NULL'
      );
      
      for (const q of questions) {
        await queryInterface.sequelize.query(
          `UPDATE questions SET specialty_ids = JSON_ARRAY(?) WHERE id = ?`,
          { replacements: [q.specialty_id, q.id] }
        );
      }
      console.log(`  ✅ Migrated ${questions.length} questions with specialty data`);

      // 5. Cập nhật comment cho is_anonymous
      await queryInterface.changeColumn('questions', 'is_anonymous', {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Câu hỏi ẩn danh - chỉ admin/manager topic mới thấy tên thật'
      });
      console.log('  ✅ Updated is_anonymous column comment');

      console.log('✅ Migration 008 completed successfully!');
    } catch (error) {
      console.error('❌ Migration 008 failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rolling back migration 008...');
    
    try {
      await queryInterface.removeColumn('questions', 'anonymous_code');
      await queryInterface.removeColumn('questions', 'specialty_ids');
      await queryInterface.removeColumn('questions', 'attachments');
      
      console.log('✅ Migration 008 rolled back successfully!');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
