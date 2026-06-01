// server/migrations/20251212000001-update-appointment-status-fields.js
// Migration để cập nhật các trường trạng thái của Appointment

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1. Backup dữ liệu cũ vào bảng tạm (optional, để rollback nếu cần)
      // await queryInterface.sequelize.query(`CREATE TABLE appointments_backup AS SELECT * FROM appointments`, { transaction });

      // 2. Thêm cột medical_record_status trước
      await queryInterface.addColumn('appointments', 'medical_record_status', {
        type: Sequelize.ENUM('no_record', 'has_record'),
        allowNull: false,
        defaultValue: 'no_record',
        comment: 'Trạng thái hồ sơ y tế'
      }, { transaction });

      // 3. Cập nhật medical_record_status dựa trên dữ liệu hiện có
      // Nếu appointment có MedicalRecord thì set has_record
      await queryInterface.sequelize.query(`
        UPDATE appointments a
        INNER JOIN medical_records mr ON a.id = mr.appointment_id
        SET a.medical_record_status = 'has_record'
        WHERE mr.id IS NOT NULL
      `, { transaction });

      // 4. Sửa ENUM status - thêm 'upcoming' và 'passed'
      // Lưu ý: MySQL không cho phép ALTER ENUM trực tiếp, phải dùng workaround
      
      // Bước 4a: Tạo cột tạm với ENUM mới
      await queryInterface.addColumn('appointments', 'status_new', {
        type: Sequelize.ENUM('pending', 'confirmed', 'upcoming', 'in_progress', 'completed', 'passed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      }, { transaction });

      // Bước 4b: Copy dữ liệu từ cột cũ sang cột mới
      await queryInterface.sequelize.query(`
        UPDATE appointments 
        SET status_new = status
      `, { transaction });

      // Bước 4c: Xóa cột cũ
      await queryInterface.removeColumn('appointments', 'status', { transaction });

      // Bước 4d: Đổi tên cột mới thành 'status'
      await queryInterface.renameColumn('appointments', 'status_new', 'status', { transaction });

      // 5. Sửa ENUM payment_status - đơn giản hóa
      await queryInterface.addColumn('appointments', 'payment_status_new', {
        type: Sequelize.ENUM('unpaid', 'paid_online', 'paid_at_clinic', 'not_required'),
        allowNull: false,
        defaultValue: 'unpaid'
      }, { transaction });

      // Map giá trị cũ sang mới
      await queryInterface.sequelize.query(`
        UPDATE appointments 
        SET payment_status_new = CASE 
          WHEN payment_status = 'pending' THEN 'unpaid'
          WHEN payment_status = 'paid' THEN 'paid_online'
          WHEN payment_status = 'paid_at_clinic' THEN 'paid_at_clinic'
          WHEN payment_status = 'not_required' THEN 'not_required'
          WHEN payment_status = 'failed' THEN 'unpaid'
          WHEN payment_status = 'refunded' THEN 'unpaid'
          ELSE 'unpaid'
        END
      `, { transaction });

      await queryInterface.removeColumn('appointments', 'payment_status', { transaction });
      await queryInterface.renameColumn('appointments', 'payment_status_new', 'payment_status', { transaction });

      // 6. Đảm bảo payment_method và paid_at đã tồn tại (đã thêm trước đó)
      // Kiểm tra xem cột đã tồn tại chưa
      const tableDescription = await queryInterface.describeTable('appointments');
      
      if (!tableDescription.payment_method) {
        await queryInterface.addColumn('appointments', 'payment_method', {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'Phương thức thanh toán'
        }, { transaction });
      }

      if (!tableDescription.paid_at) {
        await queryInterface.addColumn('appointments', 'paid_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Thời điểm thanh toán'
        }, { transaction });
      }

      await transaction.commit();
      console.log('✅ Migration completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Rollback: khôi phục về trạng thái cũ
      
      // 1. Xóa medical_record_status
      await queryInterface.removeColumn('appointments', 'medical_record_status', { transaction });

      // 2. Khôi phục status về ENUM cũ
      await queryInterface.addColumn('appointments', 'status_old', {
        type: Sequelize.ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      }, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE appointments 
        SET status_old = CASE 
          WHEN status IN ('upcoming', 'passed') THEN 'completed'
          ELSE status
        END
      `, { transaction });

      await queryInterface.removeColumn('appointments', 'status', { transaction });
      await queryInterface.renameColumn('appointments', 'status_old', 'status', { transaction });

      // 3. Khôi phục payment_status
      await queryInterface.addColumn('appointments', 'payment_status_old', {
        type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded', 'paid_at_clinic', 'not_required'),
        allowNull: false,
        defaultValue: 'pending'
      }, { transaction });

      await queryInterface.sequelize.query(`
        UPDATE appointments 
        SET payment_status_old = CASE 
          WHEN payment_status = 'unpaid' THEN 'pending'
          WHEN payment_status = 'paid_online' THEN 'paid'
          WHEN payment_status = 'paid_at_clinic' THEN 'paid_at_clinic'
          WHEN payment_status = 'not_required' THEN 'not_required'
          ELSE 'pending'
        END
      `, { transaction });

      await queryInterface.removeColumn('appointments', 'payment_status', { transaction });
      await queryInterface.renameColumn('appointments', 'payment_status_old', 'payment_status', { transaction });

      await transaction.commit();
      console.log('✅ Rollback completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
