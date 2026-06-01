# 📚 HƯỚNG DẪN HỆ THỐNG PHÂN QUYỀN DIỄN ĐÀN

## 🎯 Tổng quan

Hệ thống phân quyền diễn đàn được thiết kế đơn giản và rõ ràng với **5 quyền chính**. Chỉ có nhân viên từ phòng **Content** và **CSKH (Chăm sóc khách hàng)** được quản lý diễn đàn do tính chất nhạy cảm của thông tin y tế.

---

## 🔑 5 QUYỀN CHÍNH

### 1. **create_topic** - Tạo chủ đề
- **Mô tả**: Tạo topic mới trong diễn đàn
- **Ai có thể có**: Manager/Admin từ phòng Content và CSKH
- **Chức năng**:
  - Tạo topic với tên, mô tả, icon, màu sắc
  - Cấu hình chế độ duyệt bài (yêu cầu duyệt thủ công hoặc tự động duyệt)
  - Thiết lập thứ tự hiển thị

### 2. **edit_topic** - Sửa chủ đề
- **Mô tả**: Chỉnh sửa thông tin topic hiện có
- **Ai có thể có**: Manager/Admin từ phòng Content và CSKH
- **Chức năng**:
  - Sửa tên, mô tả topic
  - Thay đổi cấu hình duyệt bài
  - Cập nhật icon và màu sắc

### 3. **toggle_topic** - Ẩn/hiện chủ đề
- **Mô tả**: Thay đổi trạng thái hiển thị của topic
- **Ai có thể có**: Manager/Admin từ phòng Content và CSKH
- **Chức năng**:
  - Ẩn topic tạm thời (không xóa dữ liệu)
  - Hiện lại topic đã ẩn
  - Người dùng không thấy topic bị ẩn

### 4. **delete_topic** - Xóa chủ đề
- **Mô tả**: Xóa topic (soft delete - có thể khôi phục)
- **Ai có thể có**: Admin và Manager cấp cao
- **Chức năng**:
  - Xóa topic không còn sử dụng
  - Dữ liệu vẫn lưu trong database (deletedAt)
  - Có thể khôi phục nếu cần

### 5. **assign_moderators** - Phân công kiểm duyệt
- **Mô tả**: Chỉ định moderators cho mỗi topic
- **Ai có thể có**: Manager/Admin từ phòng Content và CSKH
- **Chức năng**:
  - Chọn tối đa 2 moderators cho mỗi topic
  - Moderators phải là staff từ phòng Content hoặc CSKH
  - Moderator được chỉ định sẽ quản lý topic đó

---

## 👥 VAI TRÒ MODERATOR

### Moderator là gì?
Moderator là nhân viên được **phân công quản lý một topic cụ thể**. Họ không cần quyền đặc biệt trong hệ thống permissions, chỉ cần được chỉ định trong topic.

### Trách nhiệm của Moderator:

#### 1. **Duyệt bài đăng mới** 📝
- Nhận thông báo khi có bài đăng mới trong topic của họ
- Xem xét nội dung bài viết
- Phê duyệt hoặc từ chối bài viết
- Đảm bảo thông tin y tế chính xác

#### 2. **Xử lý báo cáo** 🚩
- Nhận thông báo khi có user báo cáo bài viết trong topic
- Xem xét nội dung bị báo cáo
- Quyết định:
  - **Ẩn bài viết** nếu vi phạm nhẹ
  - **Xóa bài viết** nếu vi phạm nghiêm trọng
  - **Bỏ qua báo cáo** nếu không có vấn đề

### Làm thế nào để trở thành Moderator?
- Phải là staff thuộc phòng **Content** hoặc **CSKH**
- Được Manager/Admin **phân công** thông qua chức năng `assign_moderators`
- Một người có thể làm moderator cho nhiều topics
- Một topic có thể có tối đa 2 moderators

---

## 🔐 QUYỀN HẠN VÀ PHÒNG BAN

### Phòng Content (Nội dung)
- **Vai trò**: Quản lý nội dung y tế, kiểm tra tính chính xác
- **Quyền có thể được cấp**: Tất cả 5 quyền
- **Thường gặp**:
  - Manager Content: Có đủ 5 quyền
  - Staff Content: Được phân công làm moderator

### Phòng CSKH (Chăm sóc khách hàng)
- **Vai trò**: Hỗ trợ người dùng, xử lý khiếu nại
- **Quyền có thể được cấp**: Tất cả 5 quyền
- **Thường gặp**:
  - Manager CSKH: Có đủ 5 quyền
  - Staff CSKH: Được phân công làm moderator

### Admin (Ban Giám Đốc)
- **Quyền**: Có tất cả quyền mặc định
- **Vai trò**: Quản lý toàn bộ hệ thống

---

## 🚦 WORKFLOW HOẠT ĐỘNG

### 1. Setup Topic
```
Admin/Manager (có quyền create_topic)
  ↓
Tạo topic mới
  ↓
Cấu hình chế độ duyệt
  ↓
Chọn 2 moderators (nếu có quyền assign_moderators)
  ↓
Topic sẵn sàng hoạt động
```

### 2. Quản lý Topic
```
Manager (có quyền edit_topic, toggle_topic, delete_topic)
  ↓
Sửa thông tin topic (edit_topic)
Ẩn/hiện topic (toggle_topic)
Xóa topic không dùng (delete_topic)
```

### 3. Kiểm duyệt nội dung
```
User đăng bài
  ↓
Moderator nhận thông báo
  ↓
Xem xét nội dung
  ↓
Phê duyệt ✅ hoặc Từ chối ❌
```

### 4. Xử lý báo cáo
```
User báo cáo bài viết vi phạm
  ↓
Moderator nhận thông báo
  ↓
Kiểm tra nội dung bị báo cáo
  ↓
Quyết định: Ẩn / Xóa / Bỏ qua
```

---

## 📋 TRUY CẬP TRANG QUẢN LÝ DIỄN ĐÀN

### Điều kiện:
- Phải có **ít nhất 1 trong 5 quyền** forum
- HOẶC được phân công làm **moderator** cho ít nhất 1 topic

### Không cần quyền "view":
- Không có quyền riêng để "xem" trang quản lý
- Có bất kỳ quyền nào → Tự động có thể truy cập

---

## ⚙️ CẤU HÌNH TRONG CODE

### Frontend (StaffManagementPage.js)
```javascript
forum: {
  name: 'Diễn đàn',
  permissions: [
    { key: 'create_topic', label: 'Tạo topic' },
    { key: 'edit_topic', label: 'Sửa topic' },
    { key: 'toggle_topic', label: 'Ẩn/hiện topic' },
    { key: 'delete_topic', label: 'Xóa topic' },
    { key: 'assign_moderators', label: 'Phân công kiểm duyệt' }
  ]
}
```

### Backend Permission Check
```javascript
// server/utils/forumPermissions.js
const hasForumPermission = async (user, permission) => {
  // Admin có tất cả quyền
  if (user.role === 'admin') return true;
  
  // Staff phải kiểm tra permissions
  // Chỉ phòng Content và Support được quản lý forum
  const staff = await models.Staff.findOne({ where: { user_id: user.id } });
  if (staff.department !== 'content' && staff.department !== 'support') {
    return false;
  }
  
  // Kiểm tra quyền cụ thể
  return staff.permissions.forum.includes(permission);
}
```

---

## 🎓 BEST PRACTICES

### 1. Phân công Moderator
- ✅ Chọn người có kiến thức y tế
- ✅ Phân đều công việc (mỗi topic 2 người)
- ✅ Kết hợp Content + CSKH cho cân bằng
- ❌ Không phân công quá nhiều topics cho 1 người

### 2. Cấp quyền
- ✅ Manager có đủ 5 quyền để quản lý linh hoạt
- ✅ Staff thường chỉ cần làm moderator (không cần quyền)
- ❌ Không cấp quyền delete_topic cho quá nhiều người

### 3. Quản lý Topic
- ✅ Đặt tên topic rõ ràng, dễ hiểu
- ✅ Mô tả chi tiết phạm vi topic
- ✅ Chọn chế độ duyệt phù hợp (thủ công cho thông tin nhạy cảm)
- ❌ Không tạo quá nhiều topics trùng lặp

---

## ❓ FAQ

**Q: Moderator có cần quyền đặc biệt không?**
A: Không. Moderator chỉ cần được phân công trong topic, không cần quyền trong permissions system.

**Q: Một người có thể là moderator của bao nhiêu topics?**
A: Không giới hạn, nhưng nên cân nhắc khối lượng công việc.

**Q: Staff từ phòng Clinical có thể quản lý forum không?**
A: Không. Chỉ Content và CSKH mới được quản lý forum do tính chất công việc.

**Q: Nếu topic không có moderator thì sao?**
A: Admin và Manager vẫn có thể duyệt bài, nhưng nên phân công moderator để phân tán công việc.

**Q: Có thể xóa moderator khỏi topic không?**
A: Có, người có quyền `assign_moderators` có thể cập nhật danh sách moderators bất kỳ lúc nào.

**Q: Quyền edit_topic có cho phép thay đổi moderators không?**
A: Không. Phải có quyền `assign_moderators` riêng để thay đổi moderators.

---

## 🔧 TROUBLESHOOTING

### Vấn đề: Không thấy nút "Tạo Topic"
- Kiểm tra có quyền `create_topic` không
- Xác nhận department là `content` hoặc `support`

### Vấn đề: Không thể chọn moderators
- Kiểm tra có quyền `assign_moderators` không
- Xác nhận staff được chọn thuộc phòng Content/CSKH
- Kiểm tra staff có status `active` không

### Vấn đề: Moderator không nhận được thông báo
- Kiểm tra moderator có được lưu đúng trong `topic.moderatorIds` không
- Xác nhận hệ thống notification đã được setup

---

**Lưu ý quan trọng**: Do đây là hệ thống quản lý thông tin y tế, mọi thay đổi về permissions và moderators đều được ghi log trong audit system để truy vết.
