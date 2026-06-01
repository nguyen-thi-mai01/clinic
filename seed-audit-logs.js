// server/seed-audit-logs.js
// Script để seed audit logs vào database

require('dotenv').config();
const { models, sequelize } = require('./config/db');

async function seedAuditLogs() {
  try {
    console.log('🔍 Bắt đầu seed Audit Logs...');

    // Đảm bảo DB đã connect
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Lấy tất cả users
    const users = await models.User.findAll({
      limit: 10,
      order: [['id', 'ASC']]
    });

    if (users.length === 0) {
      console.warn('⚠️ Không tìm thấy user nào trong database');
      process.exit(1);
    }

    console.log(`📝 Tìm thấy ${users.length} users để tạo audit logs`);

    // Lấy system settings
    const settings = await models.SystemSetting.findAll({ limit: 10 });
    console.log(`📋 Tìm thấy ${settings.length} system settings`);

    // Tạo audit logs mẫu
    const auditLogs = [];
    const actionTypes = ['system_update', 'content_update', 'settings_change', 'permission_change'];
    const targetTypes = ['SystemSetting', 'User', 'Staff', 'Content'];
    const pages = ['home', 'about', 'facilities', 'header-nav-footer', 'contact', 'privacy', 'terms'];

    // Tạo 100 audit logs
    for (let i = 0; i < 100; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const actionType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
      const targetType = targetTypes[Math.floor(Math.random() * targetTypes.length)];
      const page = pages[Math.floor(Math.random() * pages.length)];
      
      const setting = settings.length > 0 
        ? settings[Math.floor(Math.random() * settings.length)]
        : null;

      // Random date trong 60 ngày qua
      const daysAgo = Math.floor(Math.random() * 60);
      const hoursAgo = Math.floor(Math.random() * 24);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      createdAt.setHours(createdAt.getHours() - hoursAgo);

      auditLogs.push({
        user_id: user.id,
        action_type: actionType,
        target_type: targetType,
        target_id: setting ? setting.id : Math.floor(Math.random() * 100),
        target_name: page,
        details: {
          page: page,
          action: Math.random() > 0.5 ? 'update' : 'create',
          updated_fields: ['title', 'content', 'images', 'description'].slice(0, Math.floor(Math.random() * 4) + 1),
          timestamp: createdAt.toISOString(),
          changes: {
            field: Math.random() > 0.5 ? 'content' : 'title',
            before: 'Old value...',
            after: 'New value...'
          }
        },
        ip_address: `192.168.1.${Math.floor(Math.random() * 255)}`,
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        created_at: createdAt,
        updated_at: createdAt
      });
    }

    // Bulk create
    await models.AuditLog.bulkCreate(auditLogs);

    console.log(`✅ Đã tạo ${auditLogs.length} audit logs thành công!`);
    console.log(`📊 Thống kê:`);
    
    const stats = await models.AuditLog.findAll({
      attributes: [
        'action_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['action_type']
    });

    stats.forEach(stat => {
      console.log(`   - ${stat.action_type}: ${stat.get('count')} logs`);
    });

    process.exit(0);

  } catch (error) {
    console.error('❌ Lỗi khi seed audit logs:', error);
    process.exit(1);
  }
}

// Chạy seed
seedAuditLogs();
