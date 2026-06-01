# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG PHÂN QUYỀN THEO PHÒNG BAN

## 📋 TỔNG QUAN

Hệ thống phân quyền mới cho phép:
- ✅ Quản lý nhân viên theo 5 phòng ban: Clinical, System, Support, Finance, Content
- ✅ Mỗi phòng ban có 1 manager và nhiều staff
- ✅ Manager có quyền phê duyệt đơn từ và phân quyền cho nhân viên trong phòng
- ✅ Admin thấy được tất cả phòng ban, manager chỉ thấy phòng mình quản lý
- ✅ Giao diện mới với tab theo phòng ban

## 📁 CÁC FILE ĐÃ TẠO/CẬP NHẬT

### Backend (Server)
1. **server/models/Department.js** - Model phòng ban
2. **server/config/departmentPermissions.js** - Định nghĩa quyền cho từng phòng ban
3. **server/config/departmentsSeed.js** - Seed data cho phòng ban
4. **server/controllers/staffController.js** - Cập nhật với các API mới
5. **server/routes/staffRoutes.js** - Thêm routes mới

### Frontend (Client)
1. **client/src/pages/StaffManagementPage_New.js** - Trang quản lý nhân viên mới
2. **client/src/pages/StaffManagementPage_New.css** - CSS cho trang mới
3. **client/src/components/common/Sidebar.js** - Thêm menu cho manager
4. **client/src/App.js** - Cập nhật routes

## 🚀 HƯỚNG DẪN CÀI ĐẶT

### Bước 1: Cập nhật Database

Tạo migration cho bảng departments (nếu cần):

```bash
cd server
npx sequelize-cli migration:generate --name create-departments-table
```

Hoặc chạy trực tiếp từ app.js bằng cách sync models:

```javascript
// Trong server/app.js, thêm:
const { models } = require('./config/db');
models.Department.sync({ alter: true });
```

### Bước 2: Seed Data Phòng Ban

Chạy script seed để tạo dữ liệu mẫu:

```javascript
// Tạo file server/scripts/seedDepartments.js
const { models } = require('../config/db');
const { seedDepartmentsAndPermissions } = require('../config/departmentsSeed');

async function runSeed() {
  try {
    await seedDepartmentsAndPermissions(models);
    console.log('✅ Seed hoàn tất!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi seed:', error);
    process.exit(1);
  }
}

runSeed();
```

Chạy:
```bash
node server/scripts/seedDepartments.js
```

### Bước 3: Tạo Users và Staff Mẫu

Đảm bảo đã có users với các username sau trong DB:
- clinicmanager, clinicstaff1, clinicstaff2
- systemmanager, systemstaff1
- supportmanager, supportstaff1, supportstaff2
- financemanager, financestaff1
- contentmanager, contentstaff1, contentstaff2

Nếu chưa có, tạo bằng register hoặc seed users.

### Bước 4: Khởi động Server

```bash
cd server
npm start
```

Kiểm tra:
- ✅ Server chạy không lỗi
- ✅ API `/api/staff/departments` trả về 5 phòng ban
- ✅ API `/api/staff/by-department/clinical` trả về danh sách nhân viên

### Bước 5: Khởi động Client

```bash
cd client
npm start
```

## 🧪 KIỂM TRA CHỨC NĂNG

### Test với Admin
1. Đăng nhập với tài khoản admin
2. Vào menu "Quản lý nhân viên"
3. Kiểm tra:
   - ✅ Thấy 5 tab phòng ban
   - ✅ Mỗi tab hiển thị đúng nhân viên
   - ✅ Có thể xem và chỉnh sửa permissions
   - ✅ Thấy statistics tổng quan

### Test với Manager
1. Đăng nhập với tài khoản manager (vd: clinicmanager)
2. Vào menu "Quản lý nhân viên" (dưới Dashboard)
3. Kiểm tra:
   - ✅ Chỉ thấy 1 tab (phòng của mình)
   - ✅ Thấy danh sách nhân viên trong phòng
   - ✅ Có thể xem và chỉnh sửa permissions của nhân viên
   - ✅ Không thấy menu của phòng khác

### Test với Staff Thường
1. Đăng nhập với tài khoản staff (vd: clinicstaff1)
2. Kiểm tra:
   - ✅ KHÔNG thấy menu "Quản lý nhân viên"
   - ✅ Chỉ thấy menu theo quyền của mình

## 📊 CẤU TRÚC PHÂN QUYỀN

### 1. Phòng Vận Hành Lâm Sàng (Clinical)

**Manager có thể:**
- Quản lý bác sĩ (xem, phân công, sửa lịch)
- Phê duyệt đơn xin nghỉ, tăng ca, đăng ký lịch
- Quản lý cuộc hẹn (xem, hủy, phê duyệt)
- Phân quyền cho nhân viên

**Staff có thể:**
- Xem và tạo cuộc hẹn
- Xem bác sĩ và lịch
- Xem bệnh nhân

### 2. Phòng Hệ Thống & IT (System)

**Manager có thể:**
- Quản lý cài đặt hệ thống
- Quản lý dịch vụ, chuyên khoa, danh mục
- Quản lý vai trò người dùng
- Chỉnh sửa trang chủ, giới thiệu
- Phê duyệt đơn từ của nhân viên
- Xem logs hệ thống

**Staff có thể:**
- Xem cài đặt hệ thống
- Xem dịch vụ, chuyên khoa

### 3. Phòng Chăm Sóc Khách Hàng (Support)

**Manager có thể:**
- Quản lý tư vấn (phân công, đóng)
- Quản lý diễn đàn (duyệt, xóa)
- Xem và chỉnh sửa thông tin bệnh nhân
- Phản hồi và phân tích feedback
- Phê duyệt đơn từ
- Phân quyền và giao chuyên mục cho nhân viên

**Staff có thể:**
- Xem và trả lời tư vấn
- Xem và trả lời diễn đàn

### 4. Phòng Tài Chính Kế Toán (Finance)

**Manager có thể:**
- Xác minh và phê duyệt thanh toán
- Xử lý hoàn tiền
- Tạo và xuất báo cáo tài chính
- Xem thống kê doanh thu, lợi nhuận
- Phê duyệt đơn từ
- Quản lý lương

**Staff có thể:**
- Xem thanh toán
- Xem hóa đơn
- Xem báo cáo

### 5. Phòng Nội Dung & Truyền Thông (Content)

**Manager có thể:**
- Tạo, chỉnh sửa, xóa, xuất bản bài viết
- Phê duyệt bài viết của nhân viên
- Quản lý danh mục và gán cho nhân viên
- Quản lý media
- Chỉnh sửa SEO và nội dung trang chủ
- Phê duyệt đơn từ
- Quản lý lịch xuất bản

**Staff có thể:**
- Tạo bản nháp bài viết (chờ duyệt)
- Xem danh mục
- Upload media

## 🔧 TÙY CHỈNH

### Thêm quyền mới

Chỉnh sửa file `server/config/departmentPermissions.js`:

```javascript
clinical: {
  manager_permissions: {
    // ... existing permissions
    new_module: ['view', 'edit', 'create']
  }
}
```

### Thêm phòng ban mới

1. Thêm vào `departmentPermissions.js`
2. Cập nhật `DEPARTMENTS` trong `StaffManagementPage_New.js`
3. Chạy lại seed

## 🐛 TROUBLESHOOTING

### Lỗi: "Cannot find module Department"
- Kiểm tra file `server/models/Department.js` đã tồn tại
- Restart server

### Manager không thấy menu "Quản lý nhân viên"
- Kiểm tra user.staff.rank === 'manager' trong localStorage
- Kiểm tra sidebar condition

### API trả về 404
- Kiểm tra routes đã được import trong `server/app.js`
- Kiểm tra middleware authentication

## 📝 GHI CHÚ

- Trang cũ `StaffManagementPage.js` vẫn được giữ lại để tham khảo
- Có thể xóa sau khi test hoàn tất
- Permissions được lưu dưới dạng JSON trong DB
- Có thể customize permissions cho từng nhân viên riêng lẻ

## 📧 HỖ TRỢ

Nếu có vấn đề, kiểm tra:
1. Console logs trong browser (F12)
2. Server logs
3. Database schema đã sync chưa
4. API endpoints response

---

✅ **HỆ THỐNG ĐÃ SẴN SÀNG SỬ DỤNG!**
