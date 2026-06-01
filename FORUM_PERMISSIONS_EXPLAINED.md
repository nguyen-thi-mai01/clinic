# 📚 HỆ THỐNG PHÂN QUYỀN DIỄN ĐÀN - PHÂN TÁCH RÕ RÀNG

## 🎯 MÔ HÌNH 2 LOẠI QUYỀN

### ✅ NHÓM 1: QUYỀN QUẢN LÝ TOPIC (Admin/Manager)
Dành cho việc **quản lý cấu trúc** diễn đàn:

1. **`create_topic`** - Tạo topic mới
2. **`edit_topic`** - Sửa thông tin topic (tên, mô tả, cấu hình)
3. **`toggle_topic`** - Ẩn/hiện topic
4. **`delete_topic`** - Xóa topic (soft delete)

→ **Ai có:** Admin và Manager (rank=manager)

---

### ✅ NHÓM 2: QUYỀN KIỂM DUYỆT CÂU HỎI (Staff được phân công)
Dành cho việc **kiểm duyệt nội dung**:

**`moderate_questions`** - Kiểm duyệt câu hỏi
- Phê duyệt câu hỏi mới
- Từ chối câu hỏi không phù hợp
- Ẩn/xóa câu hỏi vi phạm
- Xử lý báo cáo (reports) từ người dùng

→ **Ai có:** Staff được Admin/Manager cấp quyền trong StaffManagementPage

---

## 🔒 LUỒNG PHÂN QUYỀN 2 CẤP

### CẤP 1: CẤP QUYỀN `moderate_questions` (StaffManagementPage)
**Ai thực hiện:** Admin hoặc Manager  
**Mục đích:** Cho phép staff được chọn làm moderator

#### Điều kiện:
1. ✅ Thuộc phòng ban: `content` (Nội dung) HOẶC `support` (CSKH)  
2. ✅ Admin/Manager check quyền `moderate_questions` trong phân quyền forum
3. ✅ Lưu vào database: `staff.permissions.forum = ['moderate_questions']`

#### Ví dụ:
```json
// Staff A - KHÔNG có quyền
{
  "forum": []  // ❌ Không vào được trang, không thấy menu
}

// Staff B - CÓ quyền kiểm duyệt
{
  "forum": ["moderate_questions"]  // ✅ Xuất hiện trong danh sách moderator
}

// Manager C - Full quyền (cả quản lý topic + kiểm duyệt)
{
  "forum": ["create_topic", "edit_topic", "toggle_topic", "delete_topic", "moderate_questions"]
}
```

#### Kết quả:
- Staff B **vẫn chưa thấy câu hỏi nào** (chưa được phân công topic cụ thể)
- Staff B **thấy menu "Quản lý diễn đàn"** trên sidebar
- Staff B **vào được trang** nhưng danh sách câu hỏi = RỖNG

---

### CẤP 2: PHÂN CÔNG MODERATOR CHO TOPIC (ForumManagementPage)
**Ai thực hiện:** Admin, Manager (có quyền `create_topic`)

#### Quy trình:
1. **Tạo Topic mới:**
   - Nhập: Tên topic, Mô tả, Chế độ duyệt (tự động/thủ công)
   - **Chọn 2 moderator** từ danh sách staff có quyền `moderate_questions`
   - Danh sách chỉ hiển thị: Staff thuộc Content + CSKH, có quyền `moderate_questions`, đang active
   - Lưu vào database: `topic.moderatorIds = [userId1, userId2]`

2. **Kết quả:**
   - Moderator A được chọn → Thấy **CHỈ** câu hỏi thuộc topic này
   - Moderator A có thể: Duyệt/Từ chối/Ẩn/Xóa câu hỏi trong topic của mình
   - Moderator A thấy **CHỈ** báo cáo từ topic của mình

---

## 🔒 MA TRẬN QUYỀN XEM DỮ LIỆU

| Vai trò | Thấy menu | Vào trang | Xem câu hỏi | Phê duyệt | Tạo topic | Sửa/Xóa topic |
|---------|-----------|-----------|-------------|-----------|-----------|---------------|
| **Admin** | ✅ Luôn | ✅ Luôn | ✅ Tất cả | ✅ Tất cả | ✅ Có | ✅ Có |
| **Manager (Content/CSKH)** | ✅ Luôn | ✅ Luôn | ✅ Tất cả | ✅ Tất cả | ✅ Có | ✅ Có |
| **Staff có `moderate_questions`** | ✅ Có | ✅ Có | ✅ Chỉ topics được phân công | ✅ Chỉ của mình | ❌ Không | ❌ Không |
| **Staff KHÔNG có quyền** | ❌ Không | ❌ Không | ❌ Không | ❌ Không | ❌ Không | ❌ Không |

---

## 🔄 TÌNH HUỐNG THỰC TẾ

### Tình huống 1: Staff mới vào làm
```
1. Admin tạo tài khoản staff → Phòng: Content
2. ❌ Staff chưa có quyền → Không thấy menu "Quản lý diễn đàn"
3. Manager vào StaffManagementPage → Check quyền "Kiểm duyệt câu hỏi" cho staff
4. ✅ Staff bây giờ thấy menu, nhưng vào thì trang RỖNG
5. Manager tạo topic "Sức khỏe tổng quát" → Chọn Staff làm moderator
6. ✅ Staff bây giờ thấy câu hỏi thuộc topic "Sức khỏe tổng quát"
```

### Tình huống 2: Staff quản lý nhiều topic
```
1. Staff A được phân công làm moderator cho:
   - Topic "Sức khỏe tổng quát" (topicId: 1)
   - Topic "Dinh dưỡng" (topicId: 2)

2. Khi vào trang Quản lý Diễn đàn:
   ✅ Thấy câu hỏi có topicId = 1 HOẶC topicId = 2
   ❌ Không thấy câu hỏi của topic khác

3. Tab "Báo cáo":
   ✅ Chỉ thấy reports từ câu hỏi thuộc 2 topics trên
```

### Tình huống 3: Thu hồi quyền
```
1. Manager bỏ check quyền "Kiểm duyệt câu hỏi" của Staff A
2. ❌ Staff A không còn thấy menu "Quản lý diễn đàn"
3. ❌ Nếu Staff A đã là moderator của topic → Vẫn bị loại ra
4. ✅ Admin/Manager có thể vào topic để gỡ Staff A ra khỏi moderatorIds
```

---

## 🛠️ BACKEND IMPLEMENTATION

### 1. Middleware kiểm tra quyền truy cập (roleMiddleware.js)
```javascript
case 'SUPPORT_FORUM':
  // Cho phép truy cập trang nếu có ÍT NHẤT 1 quyền forum
  if (department === 'support' || department === 'content') {
    if (permissions.forum && permissions.forum.length > 0) {
      hasPermission = true;  // ✅ Vào được trang
    }
  }
  break;
```

### 2. API lấy câu hỏi (forumController.js - getAllQuestions)
```javascript
// Admin/Manager → Thấy tất cả
// Staff → Chỉ thấy topics được phân công
if (req.user.role === 'staff') {
  const allTopics = await models.Topic.findAll();
  const assignedTopicIds = allTopics
    .filter(topic => topic.moderatorIds.includes(req.user.id))
    .map(t => t.id);
  
  if (assignedTopicIds.length > 0) {
    where.topicId = { [Op.in]: assignedTopicIds };
  } else {
    where.id = -1;  // Không thấy gì
  }
}
```

### 3. API lấy danh sách staff cho moderator (staffController.js - getAllStaff)
```javascript
// Filter staff có quyền moderate_questions
// Frontend tự filter:
staffList.filter(s => {
  const permissions = s.permissions?.forum || [];
  return permissions.includes('moderate_questions');
})
```

---

## ❓ CÂU HỎI THƯỜNG GẶP

### Q1: Staff có quyền `moderate_questions` nhưng không thấy câu hỏi?
**A:** Đúng rồi! Quyền `moderate_questions` chỉ cho phép **xuất hiện trong danh sách chọn moderator**. Staff phải được Admin/Manager **chỉ định làm moderator cho topic cụ thể** mới thấy câu hỏi.

### Q2: Tại sao tách riêng quyền quản lý topic và kiểm duyệt câu hỏi?
**A:** 
- **Quản lý topic** (create/edit/delete): Công việc cấu trúc, strategy → Dành cho Manager/Admin
- **Kiểm duyệt câu hỏi** (approve/reject/hide): Công việc thường xuyên, operational → Dành cho Staff

### Q3: Staff có thể tạo topic không?
**A:** Không! Chỉ Admin và Manager (có quyền `create_topic`) mới tạo được. Staff chỉ kiểm duyệt câu hỏi trong topics được phân công.

### Q4: Làm sao để Staff thấy tất cả câu hỏi?
**A:** Không thể! Chỉ Admin và Manager mới thấy tất cả. Staff luôn bị giới hạn trong topics họ quản lý.

### Q5: Nếu topic không có moderator thì sao?
**A:** 
- Chỉ Admin/Manager thấy câu hỏi của topic đó
- Staff không ai thấy → Cần phân công moderator

---

## 🎓 KẾT LUẬN

### ✅ Ưu điểm của mô hình này:
1. **Phân công rõ ràng:** Manager quản lý cấu trúc, Staff kiểm duyệt nội dung
2. **Bảo mật:** Staff chỉ thấy dữ liệu họ được phân công
3. **Linh hoạt:** Dễ dàng thêm/bớt moderator cho topic
4. **Scalable:** Có thể mở rộng thêm nhiều quyền khác

### ⚠️ Lưu ý:
- **Không có backdoor!** Mọi kiểm tra đều ở backend
- **2 cấp độ:** Quyền module (StaffManagementPage) → Phân công topic (ForumManagementPage)
- **Manager luôn có full quyền** (không cần check permissions chi tiết)
