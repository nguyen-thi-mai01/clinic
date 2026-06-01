# 🎉 FORUM UPGRADE COMPLETION GUIDE

## 📋 Tổng quan
Hệ thống diễn đàn đã được nâng cấp hoàn chỉnh với tính năng kiểm duyệt nội dung, phân công moderators và quản lý topic. Toàn bộ giao diện responsive, màu sắc pastel xanh lá/trắng đồng bộ với các trang khác.

---

## 🆕 CÁC TRANG MỚI

### 1️⃣ **Forum Moderation Page** - Kiểm duyệt diễn đàn
**URL**: `/kiem-duyet-dien-dan`  
**Quyền truy cập**: Staff CSKH được phân công + Admin  
**Chức năng**:
- ✅ Tab "Chờ duyệt": Xem danh sách câu hỏi pending
  - Duyệt câu hỏi (chỉ được duyệt question trong topic được phân công)
  - Từ chối với lý do cụ thể
  - Tìm kiếm, filter
- 🚩 Tab "Báo cáo": Xem và xử lý reports
  - Ẩn nội dung vi phạm
  - Xóa nội dung nghiêm trọng
  - Bỏ qua báo cáo không hợp lệ
  - Filter theo status: pending, reviewed, resolved, dismissed

**Component**: `client/src/pages/ForumModerationPage.js`  
**Style**: `client/src/pages/ForumModerationPage.css`

---

### 2️⃣ **Topic Management Page** - Quản lý Topics
**URL**: `/quan-ly-topic`  
**Quyền truy cập**: Admin only  
**Chức năng**:
- ➕ Tạo topic mới với config:
  - Tiêu đề, nội dung
  - Chuyên khoa (tùy chọn)
  - `requiresApproval`: Yêu cầu duyệt câu hỏi hay không
  - `autoApprove`: Tự động duyệt ngay hay cần staff duyệt thủ công
  - Chọn 2 moderators (tối đa)
- ✏️ Chỉnh sửa topic hiện có
- 🔍 Tìm kiếm topic

**Component**: `client/src/pages/TopicManagementPage.js`  
**Style**: `client/src/pages/TopicManagementPage.css`

---

### 3️⃣ **Forum Moderator Assignment** - Phân công Moderators
**URL**: `/phan-cong-moderator`  
**Quyền truy cập**: Admin only  
**Chức năng**:
- Xem danh sách tất cả topics
- Chọn topic → Phân công tối đa 2 staff CSKH làm moderator
- Giao diện split-screen:
  - Bên trái: Danh sách topics
  - Bên phải: Grid staff để chọn

**Component**: `client/src/pages/ForumModeratorAssignment.js`  
**Style**: `client/src/pages/ForumModeratorAssignment.css`

---

## 🛠️ CẬP NHẬT HỆ THỐNG CŨ

### Backend Updates:

#### 1. **Question Model** (`server/models/Question.js`)
**Thêm fields mới**:
```javascript
status: ENUM('pending', 'approved', 'rejected', 'hidden', 'reported')
moderatorIds: JSON array [userId1, userId2]
requiresApproval: BOOLEAN
autoApprove: BOOLEAN
reportCount: INTEGER
likesCount: INTEGER (cached)
sharesCount: INTEGER (cached)
savesCount: INTEGER (cached)
approvedAt: DATE
approvedBy: INTEGER
rejectionReason: TEXT
```

#### 2. **Forum Controller** (`server/controllers/forumController.js`)
**Functions mới**:
- `approveQuestion(req, res, next)` - Staff duyệt câu hỏi
- `rejectQuestion(req, res, next)` - Từ chối với lý do
- `getReports(req, res, next)` - Lấy danh sách reports (staff chỉ xem của topic mình)
- `handleReport(req, res, next)` - Xử lý report: hide/delete/dismiss
- `createOrUpdateTopic(req, res, next)` - Tạo/update topic với config

**Logic tự động duyệt** trong `createQuestion()`:
```javascript
if (parentQuestion.autoApprove) {
  status = 'approved';
} else if (!parentQuestion.requiresApproval) {
  status = 'approved';
} else {
  status = 'pending';
  // Send notifications to moderatorIds
}
```

#### 3. **Forum Routes** (`server/routes/forumRoutes.js`)
**Routes mới**:
```javascript
POST   /forum/topics                      // Tạo topic
PUT    /forum/topics/:id                  // Update topic
PUT    /forum/questions/:id/approve       // Duyệt
PUT    /forum/questions/:id/reject        // Từ chối
PUT    /forum/reports/:id/handle          // Xử lý report
```

#### 4. **Forum Service** (`client/src/services/forumService.js`)
**API functions mới**:
```javascript
createTopic(topicData)
updateTopic(id, topicData)
approveQuestion(questionId)
rejectQuestion(questionId, reason)
getReports({ page, limit, status })
handleReport(reportId, action, adminNote)
```

#### 5. **Staff Management** (`client/src/pages/StaffManagementPage.js`)
**Cập nhật forum permissions**:
```javascript
forum: {
  permissions: [
    'view',              // Xem tất cả câu hỏi
    'moderate',          // Duyệt/Từ chối
    'delete',            // Xóa nội dung
    'handle_reports',    // Xử lý báo cáo
    'manage_topics',     // Quản lý topic (Manager/Admin)
    'assign_moderators'  // Phân công (Manager/Admin)
  ]
}
```

---

## 🎨 THIẾT KẾ UI

### Màu sắc chủ đạo:
- **Primary Green**: `#4caf50`, `#66bb6a`, `#81c784`
- **Background**: `linear-gradient(135deg, #f0f9f4 0%, #e8f5e9 50%, #f0f9f4 100%)`
- **White**: `#ffffff` cho cards
- **Pastel Green**: `#e8f5e9` cho hover/active states
- **Border**: `#c8e6c9` cho inputs/borders

### Responsive Breakpoints:
- **Desktop**: > 1024px - Full layout
- **Tablet**: 768px - 1024px - Adjusted grid
- **Mobile**: < 768px - Single column, stacked components
- **Small Mobile**: < 480px - Compact spacing

### Icon Library:
- Sử dụng **React Icons** (`react-icons/fa`)
- Import: `import { FaIcon } from 'react-icons/fa'`

---

## 🔐 PHÂN QUYỀN

### Admin:
- ✅ Toàn quyền mọi tính năng
- Tạo/sửa topic
- Phân công moderators
- Xem/xử lý tất cả reports

### Manager CSKH:
- ✅ Tạo/sửa topic (nếu có permission)
- Phân công moderators
- Duyệt câu hỏi trong tất cả topics

### Staff CSKH:
- ✅ Chỉ duyệt câu hỏi trong topic được phân công
- Chỉ xem reports của topic được phân công
- Xử lý reports: hide/delete/dismiss

---

## 📱 WORKFLOW SỬ DỤNG

### Bước 1: Admin/Manager tạo Topic
1. Vào `/quan-ly-topic`
2. Click "Tạo Topic"
3. Nhập thông tin:
   - Tiêu đề: VD "Hỏi về Da liễu"
   - Nội dung mô tả
   - Chuyên khoa (tùy chọn)
   - ✅ Bật "Yêu cầu duyệt câu hỏi"
   - ❌ Tắt "Tự động duyệt" (nếu muốn staff duyệt thủ công)
   - Chọn 2 moderators
4. Lưu

### Bước 2: User đặt câu hỏi
1. User vào diễn đàn, chọn topic "Hỏi về Da liễu"
2. Đặt câu hỏi
3. Hệ thống:
   - Check `autoApprove` của topic
   - Nếu `false` → Status = 'pending'
   - Gửi notification cho 2 moderators

### Bước 3: Staff kiểm duyệt
1. Staff vào `/kiem-duyet-dien-dan`
2. Tab "Chờ duyệt" → Thấy câu hỏi mới
3. Click mở rộng → Đọc nội dung
4. Chọn:
   - ✅ Duyệt → Question hiển thị công khai
   - ❌ Từ chối → Nhập lý do, gửi thông báo cho user

### Bước 4: Xử lý Reports
1. User báo cáo nội dung vi phạm
2. Staff vào tab "Báo cáo"
3. Xem report → Chọn hành động:
   - 👁️ Ẩn: Nội dung bị ẩn (có thể khôi phục)
   - 🗑️ Xóa: Xóa vĩnh viễn
   - 🚫 Bỏ qua: Report không hợp lệ

---

## 🧪 TESTING CHECKLIST

### ✅ Backend:
- [ ] Topic tạo thành công với moderatorIds
- [ ] createQuestion check autoApprove đúng
- [ ] Notification gửi đến đúng moderators
- [ ] approveQuestion chỉ cho phép assigned staff
- [ ] getReports filter đúng theo staff assignment
- [ ] handleReport update status + ẩn/xóa content

### ✅ Frontend:
- [ ] ForumModerationPage load questions pending
- [ ] Approve/Reject hoạt động đúng
- [ ] Reports tab hiển thị đúng
- [ ] TopicManagementPage tạo/sửa topic
- [ ] Moderator selection giới hạn tối đa 2
- [ ] ForumModeratorAssignment UI hoạt động mượt
- [ ] Responsive trên mobile/tablet/desktop
- [ ] Icons hiển thị đúng (React Icons)

### ✅ Permission:
- [ ] Staff chỉ duyệt được question trong topic được phân
- [ ] Admin có full quyền
- [ ] Routes bảo vệ đúng role

---

## 🚀 DEPLOYMENT NOTES

### Migration cần chạy:
```sql
ALTER TABLE questions
ADD COLUMN moderator_ids JSON DEFAULT '[]',
ADD COLUMN requires_approval BOOLEAN DEFAULT true,
ADD COLUMN auto_approve BOOLEAN DEFAULT false,
ADD COLUMN report_count INTEGER DEFAULT 0,
ADD COLUMN likes_count INTEGER DEFAULT 0,
ADD COLUMN shares_count INTEGER DEFAULT 0,
ADD COLUMN saves_count INTEGER DEFAULT 0,
ADD COLUMN approved_at TIMESTAMP,
ADD COLUMN approved_by INTEGER REFERENCES users(id),
ADD COLUMN rejection_reason TEXT;
```

### Seed data (optional):
- Tạo 2-3 topics mẫu với config khác nhau
- Assign staff làm moderators
- Tạo vài questions pending để test

---

## 📞 HỖ TRỢ

### URLs quan trọng:
- Forum Moderation: `/kiem-duyet-dien-dan`
- Topic Management: `/quan-ly-topic`
- Moderator Assignment: `/phan-cong-moderator`
- Staff Management (permissions): `/quan-ly-nhan-vien`

### Files quan trọng:
**Backend**:
- `server/models/Question.js`
- `server/controllers/forumController.js`
- `server/routes/forumRoutes.js`

**Frontend**:
- `client/src/pages/ForumModerationPage.js` + `.css`
- `client/src/pages/TopicManagementPage.js` + `.css`
- `client/src/pages/ForumModeratorAssignment.js` + `.css`
- `client/src/services/forumService.js`
- `client/src/App.js` (routes)

---

## 🎊 FEATURES HIGHLIGHTS

✅ **Auto-approval workflow**: Topic config quyết định auto-duyệt  
✅ **Moderator notifications**: Gửi thông báo real-time  
✅ **Smart filtering**: Staff chỉ xem assigned topics  
✅ **Report management**: Hide/Delete/Dismiss actions  
✅ **Responsive design**: Hoạt động mượt trên mọi thiết bị  
✅ **Pastel green theme**: Đồng bộ với toàn hệ thống  
✅ **React Icons**: Không dùng emoji text  
✅ **Compact UI**: Kích thước item nhỏ gọn, không tràn màn hình  

---

🎉 **Hệ thống đã sẵn sàng sử dụng!**
