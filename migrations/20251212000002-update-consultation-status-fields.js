// server/migrations/20251212000002-update-consultation-status-fields.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Thêm cột medical_record_status
      await queryInterface.addColumn('consultations', 'medical_record_status', {
        type: Sequelize.ENUM('no_record', 'has_record'),
        allowNull: false,
        defaultValue: 'no_record',
        comment: 'no_record: Chưa có báo cáo tư vấn | has_record: Đã có báo cáo tư vấn'
      }, { transaction });

      // 2. Cập nhật medical_record_status dựa trên dữ liệu hiện có
      // Nếu consultation có ConsultationReport, set medical_record_status = 'has_record'
      await queryInterface.sequelize.query(`
        UPDATE consultations c
        INNER JOIN consultation_reports cr ON c.id = cr.consultation_id
        SET c.medical_record_status = 'has_record'
        WHERE cr.id IS NOT NULL
      `, { transaction });

      // 3. Cập nhật ENUM status (MySQL workaround: tạo cột mới, copy, drop cũ, rename)
      // Thêm 'upcoming' và 'passed' vào status
      await queryInterface.addColumn('consultations', 'status_new', {
        type: Sequelize.ENUM(
          'pending',
          'confirmed',
          'upcoming',
          'in_progress',
          'completed',
          'passed',
          'cancelled',
          'rejected',
          'expired'
        ),
        allowNull: false,
        defaultValue: 'pending'
      }, { transaction });

      // Copy dữ liệu từ status cũ sang status_new
      await queryInterface.sequelize.query(`
        UPDATE consultations SET status_new = status
      `, { transaction });

      // Drop cột status cũ
      await queryInterface.removeColumn('consultations', 'status', { transaction });

      // Rename status_new thành status
      await queryInterface.renameColumn('consultations', 'status_new', 'status', { transaction });

      // 4. Cập nhật ENUM payment_status (MySQL workaround)
      // Từ ('pending', 'paid', 'refunded', 'partial_refund')
      // Sang ('unpaid', 'paid_online', 'paid_at_clinic', 'not_required', 'refunded', 'partial_refund')
      await queryInterface.addColumn('consultations', 'payment_status_new', {
        type: Sequelize.ENUM(
          'unpaid',
          'paid_online',
          'paid_at_clinic',
          'not_required',
          'refunded',
          'partial_refund'
        ),
        allowNull: false,
        defaultValue: 'unpaid'
      }, { transaction });

      // Map giá trị cũ sang mới
      await queryInterface.sequelize.query(`
        UPDATE consultations 
        SET payment_status_new = CASE payment_status
          WHEN 'pending' THEN 'unpaid'
          WHEN 'paid' THEN 'paid_online'
          WHEN 'refunded' THEN 'refunded'
          WHEN 'partial_refund' THEN 'partial_refund'
          ELSE 'unpaid'
        END
      `, { transaction });

      // Drop cột payment_status cũ
      await queryInterface.removeColumn('consultations', 'payment_status', { transaction });

      // Rename payment_status_new thành payment_status
      await queryInterface.renameColumn('consultations', 'payment_status_new', 'payment_status', { transaction });

      // 5. Kiểm tra và thêm payment_method nếu chưa có
      const columns = await queryInterface.describeTable('consultations');
      if (!columns.payment_method) {
        await queryInterface.addColumn('consultations', 'payment_method', {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: 'momo, zalopay, vnpay, cash, bank_transfer, card, insurance'
        }, { transaction });
      }

      // 6. Kiểm tra và thêm paid_at nếu chưa có
      if (!columns.paid_at) {
        await queryInterface.addColumn('consultations', 'paid_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Thời điểm thanh toán thành công'
        }, { transaction });
      }

      await transaction.commit();
      console.log('✅ Migration completed: updated consultation status fields');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Xóa cột medical_record_status
      await queryInterface.removeColumn('consultations', 'medical_record_status', { transaction });

      // 2. Rollback status ENUM (remove 'upcoming' and 'passed')
      await queryInterface.addColumn('consultations', 'status_old', {
        type: Sequelize.ENUM(
          'pending',
          'confirmed',
          'in_progress',
          'completed',
          'cancelled',
          'rejected',
          'expired'
        ),
        allowNull: false,
        defaultValue: 'pending'
      }, { transaction });

      // Map giá trị mới về cũ (upcoming → confirmed, passed → completed)
      await queryInterface.sequelize.query(`
        UPDATE consultations 
        SET status_old = CASE status
          WHEN 'upcoming' THEN 'confirmed'
          WHEN 'passed' THEN 'completed'
          ELSE status
        END
      `, { transaction });

      await queryInterface.removeColumn('consultations', 'status', { transaction });
      await queryInterface.renameColumn('consultations', 'status_old', 'status', { transaction });

      // 3. Rollback payment_status ENUM
      await queryInterface.addColumn('consultations', 'payment_status_old', {
        type: Sequelize.ENUM('pending', 'paid', 'refunded', 'partial_refund'),
        allowNull: false,
        defaultValue: 'pending'
      }, { transaction });

      // Map giá trị mới về cũ
      await queryInterface.sequelize.query(`
        UPDATE consultations 
        SET payment_status_old = CASE payment_status
          WHEN 'unpaid' THEN 'pending'
          WHEN 'paid_online' THEN 'paid'
          WHEN 'paid_at_clinic' THEN 'paid'
          WHEN 'not_required' THEN 'pending'
          WHEN 'refunded' THEN 'refunded'
          WHEN 'partial_refund' THEN 'partial_refund'
          ELSE 'pending'
        END
      `, { transaction });

      await queryInterface.removeColumn('consultations', 'payment_status', { transaction });
      await queryInterface.renameColumn('consultations', 'payment_status_old', 'payment_status', { transaction });

      // 4. Có thể giữ payment_method và paid_at (không xóa để tránh mất dữ liệu)
      // Nếu muốn xóa hoàn toàn:
      // await queryInterface.removeColumn('consultations', 'payment_method', { transaction });
      // await queryInterface.removeColumn('consultations', 'paid_at', { transaction });

      await transaction.commit();
      console.log('✅ Rollback completed: reverted consultation status fields');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
