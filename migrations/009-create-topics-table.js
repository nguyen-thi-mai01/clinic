// server/migrations/009-create-topics-table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Kiểm tra xem bảng topics đã tồn tại chưa
    const tableExists = await queryInterface.showAllTables()
      .then(tables => tables.includes('topics') || tables.includes('Topics'));

    if (tableExists) {
      console.log('⚠️ Bảng topics đã tồn tại, bỏ qua tạo bảng.');
      return;
    }

    console.log('✅ Tạo bảng topics...');
    
    await queryInterface.createTable('topics', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Tên chủ đề (VD: "Sức khỏe tim mạch", "Dinh dưỡng")'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Mô tả chi tiết chủ đề'
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
        comment: 'URL-friendly slug'
      },
      specialty_ids: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: '[]',
        comment: 'Array of specialty IDs liên quan (có thể nhiều chuyên khoa)'
      },
      requires_approval: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Topic này có yêu cầu duyệt câu hỏi không?'
      },
      auto_approve: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Tự động duyệt câu hỏi trong topic này?'
      },
      moderator_ids: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: '[]',
        comment: 'Array of staff user_id được phân công kiểm duyệt (max 2)'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Topic có đang hoạt động không?'
      },
      questions_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cached counter - số câu hỏi trong topic'
      },
      icon: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Icon name (VD: "FaHeart", "FaAppleAlt")'
      },
      color: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Màu đại diện (VD: "#2ecc71")'
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Thứ tự hiển thị'
      },
      created_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'User ID tạo topic này'
      },
      updated_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'User ID cập nhật gần nhất'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });

    console.log('✅ Bảng topics đã được tạo thành công!');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('topics');
    console.log('✅ Đã xóa bảng topics');
  }
};
