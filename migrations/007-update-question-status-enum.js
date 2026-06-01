// server/migrations/007-update-question-status-enum.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Migration 007: Updating Question status ENUM...');

      // Bước 1: Tạm thời update các status cũ sang giá trị hợp lệ mới
      await queryInterface.sequelize.query(`
        UPDATE questions 
        SET status = CASE 
          WHEN status = 'open' THEN 'approved'
          WHEN status = 'closed' THEN 'approved'
          WHEN status = 'hidden' THEN 'hidden'
          ELSE 'approved'
        END
        WHERE status IN ('open', 'closed');
      `, { transaction });

      // Bước 2: Thay đổi column definition với ENUM mới
      await queryInterface.changeColumn('questions', 'status', {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'hidden', 'reported'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'pending=chờ duyệt, approved=đã duyệt, rejected=từ chối, hidden=ẩn, reported=bị báo cáo'
      }, { transaction });

      // Bước 3: Thêm các columns mới cho forum moderation
      const tableDescription = await queryInterface.describeTable('questions');

      if (!tableDescription.requires_approval) {
        await queryInterface.addColumn('questions', 'requires_approval', {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          comment: 'Topic này có cần phê duyệt không? (Admin/Manager set)'
        }, { transaction });
      }

      if (!tableDescription.auto_approve) {
        await queryInterface.addColumn('questions', 'auto_approve', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          comment: 'Duyệt tự động? (Admin/Manager set)'
        }, { transaction });
      }

      if (!tableDescription.moderator_ids) {
        await queryInterface.addColumn('questions', 'moderator_ids', {
          type: Sequelize.JSON,
          defaultValue: '[]',
          comment: 'Array of staff IDs được phân công kiểm duyệt topic này (max 2)'
        }, { transaction });
      }

      if (!tableDescription.report_count) {
        await queryInterface.addColumn('questions', 'report_count', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          comment: 'Số lần bị báo cáo'
        }, { transaction });
      }

      if (!tableDescription.likes_count) {
        await queryInterface.addColumn('questions', 'likes_count', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          comment: 'Cached counter - sync từ Interaction'
        }, { transaction });
      }

      if (!tableDescription.shares_count) {
        await queryInterface.addColumn('questions', 'shares_count', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          comment: 'Cached counter - sync từ Interaction'
        }, { transaction });
      }

      if (!tableDescription.saves_count) {
        await queryInterface.addColumn('questions', 'saves_count', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          comment: 'Cached counter - sync từ Interaction'
        }, { transaction });
      }

      if (!tableDescription.rejection_reason) {
        await queryInterface.addColumn('questions', 'rejection_reason', {
          type: Sequelize.TEXT,
          allowNull: true
        }, { transaction });
      }

      if (!tableDescription.approved_at) {
        await queryInterface.addColumn('questions', 'approved_at', {
          type: Sequelize.DATE,
          allowNull: true
        }, { transaction });
      }

      if (!tableDescription.approved_by) {
        await queryInterface.addColumn('questions', 'approved_by', {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          }
        }, { transaction });
      }

      await transaction.commit();
      console.log('✅ Migration 007: Question status ENUM updated successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration 007 failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Reverting Migration 007...');

      // Revert status to old ENUM
      await queryInterface.changeColumn('questions', 'status', {
        type: Sequelize.ENUM('open', 'closed', 'hidden'),
        allowNull: false,
        defaultValue: 'open'
      }, { transaction });

      // Remove added columns
      const tableDescription = await queryInterface.describeTable('questions');
      
      if (tableDescription.requires_approval) {
        await queryInterface.removeColumn('questions', 'requires_approval', { transaction });
      }
      if (tableDescription.auto_approve) {
        await queryInterface.removeColumn('questions', 'auto_approve', { transaction });
      }
      if (tableDescription.moderator_ids) {
        await queryInterface.removeColumn('questions', 'moderator_ids', { transaction });
      }
      if (tableDescription.report_count) {
        await queryInterface.removeColumn('questions', 'report_count', { transaction });
      }
      if (tableDescription.likes_count) {
        await queryInterface.removeColumn('questions', 'likes_count', { transaction });
      }
      if (tableDescription.shares_count) {
        await queryInterface.removeColumn('questions', 'shares_count', { transaction });
      }
      if (tableDescription.saves_count) {
        await queryInterface.removeColumn('questions', 'saves_count', { transaction });
      }
      if (tableDescription.rejection_reason) {
        await queryInterface.removeColumn('questions', 'rejection_reason', { transaction });
      }
      if (tableDescription.approved_at) {
        await queryInterface.removeColumn('questions', 'approved_at', { transaction });
      }
      if (tableDescription.approved_by) {
        await queryInterface.removeColumn('questions', 'approved_by', { transaction });
      }

      await transaction.commit();
      console.log('✅ Migration 007 reverted');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Revert Migration 007 failed:', error);
      throw error;
    }
  }
};
