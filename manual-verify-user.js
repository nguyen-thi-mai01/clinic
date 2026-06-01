// server/manual-verify-user.js
// Script để kích hoạt user thủ công khi không gửi được email

require('dotenv').config();
const { sequelize, models } = require('./config/db');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function manualVerifyUser() {
  try {
    await sequelize.authenticate();
    console.log('✓ Kết nối database thành công\n');

    // Hiển thị danh sách user chưa xác thực
    const unverifiedUsers = await models.User.findAll({
      where: { is_verified: false },
      attributes: ['id', 'email', 'full_name', 'created_at'],
      order: [['created_at', 'DESC']]
    });

    if (unverifiedUsers.length === 0) {
      console.log('Không có user nào cần xác thực.\n');
      process.exit(0);
    }

    console.log('DANH SÁCH USER CHƯA XÁC THỰC:');
    console.log('================================');
    unverifiedUsers.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Tên: ${user.full_name || 'Chưa có'}`);
      console.log(`   Ngày đăng ký: ${user.created_at}`);
      console.log('');
    });

    rl.question('Nhập email cần kích hoạt (hoặc "all" để kích hoạt tất cả): ', async (answer) => {
      try {
        if (answer.toLowerCase() === 'all') {
          // Kích hoạt tất cả
          const result = await models.User.update(
            { 
              is_verified: true, 
              is_active: true,
              verification_token: null 
            },
            { where: { is_verified: false } }
          );
          console.log(`\n✓ Đã kích hoạt ${result[0]} user thành công!\n`);
        } else {
          // Kích hoạt user theo email
          const user = await models.User.findOne({ 
            where: { email: answer.trim() } 
          });

          if (!user) {
            console.log('\n✗ Không tìm thấy user với email này.\n');
            rl.close();
            process.exit(1);
          }

          user.is_verified = true;
          user.is_active = true;
          user.verification_token = null;
          await user.save();

          console.log(`\n✓ Đã kích hoạt user: ${user.email}`);
          console.log(`  ID: ${user.id}`);
          console.log(`  Tên: ${user.full_name || 'Chưa có'}`);
          console.log(`  User này có thể đăng nhập ngay bây giờ.\n`);
        }

        rl.close();
        process.exit(0);
      } catch (error) {
        console.error('\n✗ Lỗi:', error.message, '\n');
        rl.close();
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('✗ Lỗi kết nối database:', error.message);
    process.exit(1);
  }
}

manualVerifyUser();