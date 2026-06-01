// server/test-env.js
const path = require('path');
require('dotenv').config({ 
  path: path.join(__dirname, '../.env') 
});

console.log('=== KIỂM TRA FILE .ENV ===\n');

console.log('Đường dẫn .env:', path.join(__dirname, '../.env'));
console.log('\nCác biến môi trường:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '✓ Có' : '✗ Không có');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✓ Có' : '✗ Không có');
console.log('GMAIL_USER:', process.env.GMAIL_USER);
console.log('GMAIL_PASS:', process.env.GMAIL_PASS ? '✓ Có' : '✗ Không có');
console.log('CLIENT_URL:', process.env.CLIENT_URL);

if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
  console.log('\n✗ LỖI: Gmail chưa được cấu hình!');
  console.log('Vui lòng kiểm tra file .env');
} else {
  console.log('\n✓ Gmail đã được cấu hình');
}