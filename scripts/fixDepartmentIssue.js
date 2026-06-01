// server/scripts/fixDepartmentIssue.js
/**
 * Script này sẽ:
 * 1. Drop bảng departments nếu tồn tại
 * 2. Sync lại Department model
 * 3. Kiểm tra và fix Staff.department nếu cần
 */

const { sequelize, models } = require('../config/db');

async function fixDepartmentIssue() {
  try {
    console.log('🔧 Bắt đầu fix lỗi Department...\n');

    // 1. Drop bảng departments nếu tồn tại
    console.log('📋 Kiểm tra bảng departments...');
    await sequelize.query('DROP TABLE IF EXISTS departments');
    console.log('✅ Đã xóa bảng departments (nếu có)\n');

    // 2. Sync lại Department model
    console.log('📋 Tạo lại bảng departments...');
    if (models.Department) {
      await models.Department.sync({ force: true });
      console.log('✅ Đã tạo lại bảng departments\n');
    } else {
      console.log('⚠️ Model Department không tồn tại\n');
    }

    // 3. Kiểm tra Staff.department
    console.log('📋 Kiểm tra Staff.department...');
    const [results] = await sequelize.query(`
      SHOW COLUMNS FROM staff WHERE Field = 'department'
    `);
    
    if (results.length > 0) {
      console.log('✅ Staff.department:', results[0].Type);
    }

    console.log('\n🎉 Hoàn tất! Hãy khởi động lại server.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

fixDepartmentIssue();
