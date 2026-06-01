// server/migrations/20251212000003-enhance-staff-permissions.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Thêm cột permissions (JSON) để lưu quyền chi tiết
      await queryInterface.addColumn('staff', 'permissions', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {},
        comment: 'Quyền chi tiết: { "appointments": ["view", "edit"], "payments": ["view"] }'
      }, { transaction });

      // 2. Thêm cột job_description
      await queryInterface.addColumn('staff', 'job_description', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Mô tả công việc chi tiết'
      }, { transaction });

      // 3. Thêm cột access_level
      await queryInterface.addColumn('staff', 'access_level', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Cấp độ truy cập: 1=Nhân viên thường, 2=Nhân viên cao cấp, 3=Trưởng phòng, 4=Phó giám đốc, 5=Giám đốc'
      }, { transaction });

      // 4. Cập nhật dữ liệu mẫu cho staff hiện có
      // Set access_level cho manager
      await queryInterface.sequelize.query(`
        UPDATE staff 
        SET access_level = 3,
            job_description = CASE department
              WHEN 'clinical' THEN 'Quản lý vận hành lịch hẹn, phân công bác sĩ, giải quyết tranh chấp'
              WHEN 'system' THEN 'Quản lý hệ thống, cấu hình, backup dữ liệu, bảo mật'
              WHEN 'support' THEN 'Chăm sóc khách hàng, xử lý khiếu nại, hỗ trợ người dùng'
              WHEN 'finance' THEN 'Quản lý tài chính, thanh toán, đối soát, báo cáo doanh thu'
              WHEN 'content' THEN 'Quản lý nội dung, duyệt bài viết, quản lý diễn đàn'
              ELSE 'Nhân viên văn phòng'
            END,
            permissions = CASE department
              WHEN 'clinical' THEN JSON_OBJECT(
                'appointments', JSON_ARRAY('view', 'create', 'edit', 'delete', 'confirm'),
                'schedules', JSON_ARRAY('view', 'create', 'edit'),
                'doctors', JSON_ARRAY('view', 'assign')
              )
              WHEN 'system' THEN JSON_OBJECT(
                'system_settings', JSON_ARRAY('view', 'edit'),
                'services', JSON_ARRAY('view', 'create', 'edit', 'delete'),
                'specialties', JSON_ARRAY('view', 'create', 'edit'),
                'users', JSON_ARRAY('view', 'edit')
              )
              WHEN 'support' THEN JSON_OBJECT(
                'appointments', JSON_ARRAY('view', 'edit'),
                'consultations', JSON_ARRAY('view', 'monitor'),
                'patients', JSON_ARRAY('view', 'contact')
              )
              WHEN 'finance' THEN JSON_OBJECT(
                'payments', JSON_ARRAY('view', 'verify', 'refund'),
                'appointments', JSON_ARRAY('view'),
                'reports', JSON_ARRAY('view', 'export')
              )
              WHEN 'content' THEN JSON_OBJECT(
                'articles', JSON_ARRAY('view', 'create', 'edit', 'approve', 'delete'),
                'forum', JSON_ARRAY('view', 'moderate'),
                'categories', JSON_ARRAY('view', 'edit')
              )
              ELSE JSON_OBJECT()
            END
        WHERE rank = 'manager'
      `, { transaction });

      // Set access_level cho staff thường
      await queryInterface.sequelize.query(`
        UPDATE staff 
        SET access_level = 1,
            job_description = CASE department
              WHEN 'clinical' THEN 'Hỗ trợ xử lý lịch hẹn, liên lạc bệnh nhân, cập nhật thông tin'
              WHEN 'system' THEN 'Hỗ trợ kỹ thuật, bảo trì hệ thống, xử lý lỗi'
              WHEN 'support' THEN 'Tiếp nhận yêu cầu, tư vấn qua điện thoại/chat'
              WHEN 'finance' THEN 'Kiểm tra thanh toán, đối soát giao dịch'
              WHEN 'content' THEN 'Soạn thảo bài viết, kiểm duyệt nội dung'
              ELSE 'Nhân viên hỗ trợ'
            END,
            permissions = CASE department
              WHEN 'clinical' THEN JSON_OBJECT(
                'appointments', JSON_ARRAY('view', 'edit'),
                'schedules', JSON_ARRAY('view')
              )
              WHEN 'system' THEN JSON_OBJECT(
                'services', JSON_ARRAY('view'),
                'users', JSON_ARRAY('view')
              )
              WHEN 'support' THEN JSON_OBJECT(
                'appointments', JSON_ARRAY('view'),
                'consultations', JSON_ARRAY('view')
              )
              WHEN 'finance' THEN JSON_OBJECT(
                'payments', JSON_ARRAY('view'),
                'appointments', JSON_ARRAY('view')
              )
              WHEN 'content' THEN JSON_OBJECT(
                'articles', JSON_ARRAY('view', 'create', 'edit')
              )
              ELSE JSON_OBJECT()
            END
        WHERE rank = 'staff' OR rank IS NULL
      `, { transaction });

      await transaction.commit();
      console.log('✅ Migration completed: enhanced staff permissions');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeColumn('staff', 'permissions', { transaction });
      await queryInterface.removeColumn('staff', 'job_description', { transaction });
      await queryInterface.removeColumn('staff', 'access_level', { transaction });

      await transaction.commit();
      console.log('✅ Rollback completed: removed staff permission columns');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
