'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      action_type: {
        type: Sequelize.ENUM(
          'permission_change',
          'staff_create',
          'staff_update',
          'staff_delete',
          'login',
          'logout',
          'department_change',
          'work_status_change',
          'system_setting_change'
        ),
        allowNull: false
      },
      target_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Type of target: staff, user, department, system'
      },
      target_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID of affected entity'
      },
      target_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Name of affected entity for quick display'
      },
      details: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional details about the action'
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Indexes for better query performance
    await queryInterface.addIndex('audit_logs', ['user_id']);
    await queryInterface.addIndex('audit_logs', ['action_type']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
    await queryInterface.addIndex('audit_logs', ['target_type', 'target_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('audit_logs');
  }
};
