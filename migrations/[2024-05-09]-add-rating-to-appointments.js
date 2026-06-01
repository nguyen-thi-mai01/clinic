/**
 * Migration: Reuse ConsultationFeedback for both Consultation & Appointment
 * ====================================================================
 * BƯỚC 2: OPTIMIZED - Reuse existing feedback table
 * Ngày: 2024-05-09
 * 
 * Lý do tối ưu:
 * - Thay vì tạo 6 columns mới trong appointments table
 * - Reuse bảng consultation_feedback (đã có rating, review, status, admin_note)
 * - Thêm 2 columns để phân loại: service_type, appointment_id
 * - Giảm từ 2 bảng feedback → 1 bảng chung
 * 
 * Strategy:
 * 1. Rename cột consultation_id → service_reference_id (generic)
 * HOẶC
 * 2. GIỮ consultation_id, THÊM appointment_id (nullable)
 *    + Thêm service_type ENUM('consultation', 'appointment')
 *    + Khi consultation_id NULL → dùng appointment_id
 * 
 * Chọn cách 2 vì: backward compatible, không cần rename cột cũ
 * 
 * ====================================================================
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('📋 Migration UP: OPTIMIZED - Add appointment support to consultation_feedback...');
    
    try {
      // 1. Thêm appointment_id (FK → appointments.id)
      await queryInterface.addColumn('consultation_feedback', 'appointment_id', {
        type: Sequelize.BIGINT,
        allowNull: true,  // Nullable vì consultation_id có thể được sử dụng
        references: { model: 'appointments', key: 'id' },
        onDelete: 'CASCADE',
        comment: '🔗 Link tới appointment (nullable, dùng khi consultation_id = NULL) [BƯỚC 2]'
      });
      console.log('✅ Thêm column: appointment_id');

      // 2. Thêm service_type để phân loại feedback
      await queryInterface.addColumn('consultation_feedback', 'service_type', {
        type: Sequelize.ENUM('consultation', 'appointment'),
        defaultValue: 'consultation',
        allowNull: false,
        comment: '📌 Loại dịch vụ: consultation=tư vấn online, appointment=khám tại viện [BƯỚC 2]'
      });
      console.log('✅ Thêm column: service_type');

      // 3. Add indexes để query nhanh
      await queryInterface.addIndex('consultation_feedback', ['appointment_id'], {
        name: 'idx_consultation_feedback_appointment_id'
      });
      console.log('✅ Thêm index: appointment_id');

      await queryInterface.addIndex('consultation_feedback', ['service_type'], {
        name: 'idx_consultation_feedback_service_type'
      });
      console.log('✅ Thêm index: service_type');

      // 4. Add composite index: (service_type, service_id) để query hiệu quả
      // Query pattern: SELECT * FROM consultation_feedback 
      //               WHERE service_type='appointment' AND appointment_id=X
      await queryInterface.addIndex('consultation_feedback', ['service_type', 'appointment_id'], {
        name: 'idx_consultation_feedback_service_composite'
      });
      console.log('✅ Thêm composite index: (service_type, appointment_id)');

      // 5. Add constraint: ít nhất 1 trong 2 (consultation_id hoặc appointment_id) phải có
      await queryInterface.sequelize.query(
        `ALTER TABLE consultation_feedback ADD CONSTRAINT check_service_reference 
         CHECK (consultation_id IS NOT NULL OR appointment_id IS NOT NULL)`
      );
      console.log('✅ Thêm CHECK constraint: ít nhất 1 service_reference phải có');

      console.log('✅ Migration UP thành công! [BƯỚC 2]');
      
    } catch (error) {
      console.error('❌ Migration UP thất bại:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('📋 Migration DOWN: Remove appointment support from consultation_feedback...');
    
    try {
      // 1. Drop constraint
      await queryInterface.sequelize.query(
        `ALTER TABLE consultation_feedback DROP CONSTRAINT check_service_reference`
      );
      console.log('✅ Xóa CHECK constraint');

      // 2. Drop indexes
      await queryInterface.removeIndex('consultation_feedback', 'idx_consultation_feedback_service_composite');
      console.log('✅ Xóa composite index');

      await queryInterface.removeIndex('consultation_feedback', 'idx_consultation_feedback_service_type');
      console.log('✅ Xóa index: service_type');

      await queryInterface.removeIndex('consultation_feedback', 'idx_consultation_feedback_appointment_id');
      console.log('✅ Xóa index: appointment_id');

      // 3. Drop columns (reverse order)
      await queryInterface.removeColumn('consultation_feedback', 'service_type');
      console.log('✅ Xóa column: service_type');

      await queryInterface.removeColumn('consultation_feedback', 'appointment_id');
      console.log('✅ Xóa column: appointment_id');

      console.log('✅ Migration DOWN thành công!');
      
    } catch (error) {
      console.error('❌ Migration DOWN thất bại:', error);
      throw error;
    }
  }
};

