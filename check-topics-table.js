// Script kiểm tra bảng topics
require('dotenv').config();
const { sequelize, models } = require('./config/db');

async function checkTopicsTable() {
  try {
    console.log('🔍 Kiểm tra bảng topics...');
    
    // 1. Kiểm tra model có tồn tại không
    console.log('1. Topic model exists?', !!models.Topic);
    
    // 2. Kiểm tra bảng có tồn tại trong DB không
    const [tables] = await sequelize.query(`SHOW TABLES LIKE 'topics'`);
    console.log('2. Table exists in DB?', tables.length > 0);
    
    if (tables.length > 0) {
      // 3. Xem cấu trúc bảng
      const [columns] = await sequelize.query(`DESCRIBE topics`);
      console.log('3. Table structure:');
      console.table(columns);
      
      // 4. Đếm số record
      const [count] = await sequelize.query(`SELECT COUNT(*) as total FROM topics`);
      console.log('4. Total records:', count[0].total);
      
      // 5. Thử query bằng Sequelize
      console.log('5. Trying Sequelize query...');
      const topics = await models.Topic.findAll({ limit: 5 });
      console.log('   Success! Found', topics.length, 'topics');
      console.log('   Sample:', topics[0]?.toJSON());
    } else {
      console.log('❌ Bảng topics chưa tồn tại! Đang tạo...');
      await models.Topic.sync({ force: false });
      console.log('✅ Đã tạo bảng topics');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

checkTopicsTable();
