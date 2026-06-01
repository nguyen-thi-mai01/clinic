# 🔐 HƯỚNG DẪN HỆ THỐNG PHÂN QUYỀN CHI TIẾT

## ✅ TỔNG QUAN CẬP NHẬT

**Ngày cập nhật:** 13/12/2025  
**Trạng thái:** ✅ HOÀN THÀNH - Permissions THỰC SỰ HOẠT ĐỘNG!

### 🎯 Mục tiêu đã đạt được

- ✅ **PAYMENTS**: 8 routes được bảo vệ bởi permissions chi tiết
- ✅ **ARTICLES**: 15 routes chuyển sang permission check
- ✅ **FORUM**: 10 routes áp dụng phân quyền module
- ✅ **CONSULTATIONS**: 15 routes realtime với permission enforcement

**TỔNG CỘNG: 48 routes đã được bảo vệ bằng hệ thống permissions!**

---

## 📊 CHI TIẾT PERMISSIONS THEO MODULE

### 1. 💰 PAYMENTS (Thanh toán)

**Phòng ban:** Finance  
**Quyền hạn:**

| Quyền | Key | Mô tả | Routes áp dụng |
|-------|-----|-------|----------------|
| Xem | `payments:view` | Xem tất cả thanh toán, báo cáo doanh thu | `GET /payments/all`, `GET /payments/statistics/revenue` |
| Xác minh | `payments:verify` | Xác minh giao dịch thủ công | `PUT /payments/:id/verify-manual`, `GET /payments/:id/check-status` |
| Duyệt | `payments:approve` | Phê duyệt/từ chối thanh toán | `PUT /payments/:id/confirm`, `PUT /payments/:id/reject`, `PUT /payments/config` |
| Hoàn tiền | `payments:refund` | Xử lý yêu cầu hoàn tiền | `GET /payments/refunds` |

**Test case:**
```javascript
// Staff Finance (có quyền)
permissions: {
  payments: ['view', 'verify', 'approve', 'refund']
}
// ✅ GET /payments/all → 200 OK
// ✅ PUT /payments/123/verify-manual → 200 OK

// Staff Content (KHÔNG có quyền)
permissions: {
  articles: ['view', 'create', 'edit'],
  payments: [] // RỖNG
}
// ❌ GET /payments/all → 403 Forbidden
// ❌ PUT /payments/123/verify-manual → 403 Forbidden
```

---

### 2. 📰 ARTICLES (Quản lý bài viết)

**Phòng ban:** Content  
**Quyền hạn:**

| Quyền | Key | Mô tả | Routes áp dụng |
|-------|-----|-------|----------------|
| Xem | `articles:view` | Xem danh sách bài viết | `GET /articles`, `GET /articles/:id/review-history`, `GET /articles/suggestions` |
| Tạo | `articles:create` | Viết bài mới, tạo thuốc/bệnh lý | `POST /articles`, `POST /articles/medicines`, `POST /articles/diseases` |
| Tạo nháp | `articles:create_draft` | Tạo bài nháp, gửi đề xuất | `POST /articles/suggestions` |
| Sửa | `articles:edit` | Chỉnh sửa bài viết | `PUT /articles/:id`, `PUT /articles/medicines/:id`, `POST /articles/:id/hide` |
| Xóa | `articles:delete` | Xóa bài viết | `DELETE /articles/:id`, `DELETE /articles/medicines/:id` |
| Xuất bản | `articles:publish` | Xuất bản bài viết | (Thường kèm với approve) |
| Duyệt | `articles:approve` | Duyệt bài, duyệt đề xuất | `POST /articles/:id/review`, `PUT /articles/suggestions/:id/review` |

**Test case:**
```javascript
// Staff Content Manager (có full quyền)
permissions: {
  articles: ['view', 'create', 'edit', 'delete', 'approve']
}
// ✅ POST /articles → 201 Created
// ✅ POST /articles/123/review → 200 OK

// Staff Content (quyền hạn chế)
permissions: {
  articles: ['view', 'create_draft', 'edit']
}
// ✅ POST /articles/suggestions → 200 OK (Gửi đề xuất)
// ❌ POST /articles/123/review → 403 Forbidden (Không duyệt được)
```

---

### 3. 💬 FORUM (Diễn đàn)

**Phòng ban:** Support  
**Quyền hạn:**

| Quyền | Key | Mô tả | Routes áp dụng |
|-------|-----|-------|----------------|
| Xem | `forum:view` | Xem tất cả câu hỏi, báo cáo | `GET /forum/questions`, `GET /forum/reports` |
| Trả lời | `forum:reply` | Trả lời câu hỏi (thường dành cho Doctor) | (Tương lai) |
| Kiểm duyệt | `forum:moderate` | Duyệt câu hỏi, ghim câu trả lời | `PUT /forum/questions/:id/status`, `PUT /forum/answers/:id/pin` |
| Xóa | `forum:delete` | Xóa nội dung vi phạm | `DELETE /forum/questions/:id`, `DELETE /forum/answers/:id` |

**Test case:**
```javascript
// Staff Support Manager
permissions: {
  forum: ['view', 'moderate', 'delete']
}
// ✅ GET /forum/questions → 200 OK
// ✅ PUT /forum/questions/123/status → 200 OK (Duyệt)
// ✅ DELETE /forum/questions/456 → 200 OK (Xóa spam)

// Staff Finance (KHÔNG có quyền)
permissions: {
  payments: ['view', 'verify']
}
// ❌ GET /forum/questions → 403 Forbidden
```

---

### 4. 💡 CONSULTATIONS (Tư vấn trực tuyến)

**Phòng ban:** Support  
**Quyền hạn:**

| Quyền | Key | Mô tả | Routes áp dụng |
|-------|-----|-------|----------------|
| Xem | `consultations:view` | Xem danh sách tư vấn, giám sát realtime | `GET /consultations/admin/realtime/all`, `GET /consultations/admin/realtime/active` |
| Trả lời | `consultations:reply` | Gửi tin nhắn hệ thống | `POST /consultations/admin/realtime/:id/system-message` |
| Phân công | `consultations:assign` | Duyệt/từ chối tư vấn, cập nhật trạng thái | `PUT /consultations/:id/status`, `PUT /consultations/admin/realtime/:id/approve` |
| Đóng | `consultations:close` | Kết thúc phiên, xử lý sự cố | `PUT /consultations/admin/realtime/:id/force-end`, `PUT /consultations/admin/realtime/incidents/:id/resolve` |

**Test case:**
```javascript
// Staff Support
permissions: {
  consultations: ['view', 'reply', 'assign', 'close']
}
// ✅ GET /consultations/admin/realtime/all → 200 OK
// ✅ POST /consultations/admin/realtime/123/system-message → 200 OK
// ✅ PUT /consultations/admin/realtime/456/force-end → 200 OK

// Staff Clinical (KHÔNG có quyền)
permissions: {
  appointments: ['view', 'create'],
  schedules: ['view']
}
// ❌ GET /consultations/admin/realtime/all → 403 Forbidden
```

---

## 🔧 CÁCH SỬ DỤNG TRONG CODE

### 1. Thêm permission vào route mới

```javascript
const roleMiddleware = require('../middleware/roleMiddleware');

// ❌ TRƯỚC (SAI - Không check permissions JSON)
router.get('/payments/all', authorize('admin', 'staff'), paymentController.getAllPayments);

// ✅ SAU (ĐÚNG - Check permissions.payments.includes('view'))
router.get('/payments/all', authMiddleware, roleMiddleware('payments:view'), paymentController.getAllPayments);
```

### 2. Format permission string

```
<module>:<action>
```

**Ví dụ:**
- `payments:view` → Check `permissions.payments.includes('view')`
- `articles:create` → Check `permissions.articles.includes('create')`
- `forum:moderate` → Check `permissions.forum.includes('moderate')`

### 3. Middleware xử lý như thế nào?

**File:** `server/middleware/roleMiddleware.js`

```javascript
// Khi bạn gọi roleMiddleware('payments:view')
const [module, action] = 'payments:view'.split(':'); // ['payments', 'view']

// Middleware kiểm tra:
const permissions = user.Staff?.permissions || {}; // Lấy từ DB
const modulePermissions = permissions[module]; // permissions.payments

// Hỗ trợ 3 format:
// Format 1: Boolean
if (modulePermissions === true) return next(); // Có toàn quyền

// Format 2: Array (KHUYẾN KHÍCH)
if (Array.isArray(modulePermissions) && modulePermissions.includes(action)) {
  return next(); // ['view', 'verify'].includes('view') → true
}

// Format 3: Object
if (modulePermissions[action] === true) return next(); // {view: true}

// Nếu không có quyền → 403 Forbidden
```

---

## 📝 HƯỚNG DẪN CẬP NHẬT QUYỀN TRONG UI

### 1. Truy cập trang quản lý nhân sự

**URL:** `/staff-management`  
**Role:** Admin hoặc Manager

### 2. Chọn nhân viên và tab "Quyền hạn"

Hệ thống hiển thị tất cả module permissions từ `PERMISSION_MODULES`:

```javascript
const PERMISSION_MODULES = {
  payments: {
    name: 'Thanh toán',
    icon: <FaCreditCard />,
    permissions: [
      { key: 'view', label: 'Xem', description: 'Xem thông tin thanh toán' },
      { key: 'verify', label: 'Xác minh', description: 'Xác minh giao dịch' },
      { key: 'approve', label: 'Duyệt', description: 'Phê duyệt thanh toán' },
      { key: 'refund', label: 'Hoàn tiền', description: 'Xử lý hoàn tiền' }
    ]
  },
  // ...
}
```

### 3. Tick checkbox quyền muốn cấp

- ✅ Tick "Xem" → Staff có quyền `payments:view`
- ✅ Tick "Xác minh" → Staff có quyền `payments:verify`
- ❌ Không tick "Duyệt" → Staff KHÔNG có quyền `payments:approve`

### 4. Lưu thay đổi

API call: `PUT /staff/:id/permissions`

```json
{
  "permissions": {
    "payments": ["view", "verify"],
    "articles": []
  }
}
```

### 5. Kiểm tra kết quả

- Staff đăng nhập lại
- Thử truy cập route: `GET /payments/all`
- **Kết quả mong đợi:** ✅ 200 OK (vì có quyền `payments:view`)

---

## 🧪 TEST SCENARIOS

### Scenario 1: Staff Finance truy cập Articles

```bash
# Login as Staff Finance
POST /auth/login
{
  "username": "staff_finance",
  "password": "123456"
}

# Try to access articles
GET /articles
# ❌ Expected: 403 Forbidden
# Message: "Bạn không có quyền 'articles:view'"
```

### Scenario 2: Staff Content truy cập Payments

```bash
# Login as Staff Content
POST /auth/login
{
  "username": "staff_content",
  "password": "123456"
}

# Try to access payments
GET /payments/all
# ❌ Expected: 403 Forbidden
# Message: "Bạn không có quyền 'payments:view'"
```

### Scenario 3: Staff Finance xác minh thanh toán

```bash
# Login as Staff Finance (có quyền payments:verify)
POST /auth/login
{
  "username": "staff_finance",
  "password": "123456"
}

# Verify payment
PUT /payments/123/verify-manual
{
  "verified": true,
  "note": "Đã xác nhận chuyển khoản"
}
# ✅ Expected: 200 OK
# Message: "Xác minh thành công"
```

---

## 🚨 TROUBLESHOOTING

### Lỗi: "Bạn không có quyền truy cập"

**Nguyên nhân:**
1. Staff không có quyền trong module đó
2. Quyền đã bị thu hồi
3. Chưa đăng nhập lại sau khi cập nhật quyền

**Giải pháp:**
1. Kiểm tra `permissions` trong database:
   ```sql
   SELECT permissions FROM staff WHERE id = 1;
   ```
2. Xác nhận format đúng (Array, không phải Boolean):
   ```json
   {
     "payments": ["view", "verify"],
     "articles": []
   }
   ```
3. Đăng xuất và đăng nhập lại để load permissions mới

### Lỗi: "Middleware không hoạt động"

**Kiểm tra:**
1. File route đã import `roleMiddleware` chưa?
   ```javascript
   const roleMiddleware = require('../middleware/roleMiddleware');
   ```
2. Format permission string đúng chưa?
   ```javascript
   roleMiddleware('payments:view') // ✅ ĐÚNG
   roleMiddleware('payments_view') // ❌ SAI
   ```
3. Thứ tự middleware đúng chưa?
   ```javascript
   router.get('/all',
     authMiddleware,              // 1. Check đăng nhập
     roleMiddleware('payments:view'), // 2. Check quyền
     controller.getAllPayments    // 3. Execute
   );
   ```

---

## 📚 TÀI LIỆU THAM KHẢO

- **File middleware:** `server/middleware/roleMiddleware.js`
- **File config:** `server/config/departmentPermissions.js`
- **UI permissions:** `client/src/pages/StaffManagementPage.js` (PERMISSION_MODULES)
- **Audit logs:** `server/controllers/staffController.js` (getPermissionChanges)

---

## ✅ CHECKLIST KHI THÊM ROUTE MỚI

- [ ] Import `roleMiddleware` vào file route
- [ ] Thêm `roleMiddleware('module:action')` vào route
- [ ] Thêm permission vào `PERMISSION_MODULES` trong UI (nếu chưa có)
- [ ] Thêm permission vào template trong `departmentPermissions.js` (nếu chưa có)
- [ ] Test với staff có quyền → ✅ 200 OK
- [ ] Test với staff KHÔNG có quyền → ❌ 403 Forbidden
- [ ] Commit code và ghi chú trong CHANGELOG

---

**🎉 HOÀN TẤT! HỆ THỐNG PHÂN QUYỀN ĐÃ HOẠT ĐỘNG THỰC SỰ!**
