# 🧪 HƯỚNG DẪN KIỂM TRA HỆ THỐNG PHÂN QUYỀN MANAGER CONTENT

## ✅ CHECKLIST TEST TOÀN BỘ HỆ THỐNG

### 📋 **PHASE 1: Chuẩn bị Database**

#### Step 1.1: Grant Permissions cho Manager Content
```bash
# Chạy SQL script
mysql -u root -p clinic_system < server/scripts/fix-manager-content-permissions.sql
```

**Expected Output:**
```
✅ Manager Content được cấp 13 quyền articles
✅ Verify query hiển thị permissions JSON đầy đủ
```

#### Step 1.2: Kiểm tra Notification System
```bash
mysql -u root -p clinic_system < server/scripts/test-notification-system.sql
```

**Expected Output:**
```
✅ STEP 1: Tìm thấy ít nhất 1 Manager Content
✅ STEP 2: Có thể chưa có notification (chưa test)
✅ STEP 4: Manager Content xuất hiện trong danh sách có quyền 'approve'
```

---

### 🖥️ **PHASE 2: Chuẩn bị Backend**

#### Step 2.1: Verify Code Changes
Kiểm tra các file đã được update:

**File 1: `roleMiddleware.js`**
```javascript
// Line ~195 - Phải có logic này:
if (module === 'articles' && department === 'content' && rank === 'manager') {
  hasPermission = true;
}
```

**File 2: `articleController.js`**
- Line ~67-143: Function `notifyManagersAndAdmins()` tồn tại
- Line ~936: `await notifyManagersAndAdmins(...)` (KO phải notifyAllAdmins)
- Line ~1086: `await notifyManagersAndAdmins(...)`
- Line ~1605: `await notifyManagersAndAdmins(...)`

#### Step 2.2: Restart Server
```bash
cd server
npm start
```

**Expected Console Output:**
```
✅ Server running on port 5000
✅ Database connected successfully
✅ Không có lỗi migration
```

---

### 💻 **PHASE 3: Test Frontend UI**

#### Step 3.1: Đăng nhập Manager Content
1. Mở browser: `http://localhost:3000`
2. Login với email Manager Content (từ SQL STEP 1)
3. Password: `password` (hoặc password đã seed)

**Expected:**
```
✅ Đăng nhập thành công
✅ Sidebar hiển thị menu "Quản lý bài viết"
✅ Không bị redirect về /404
```

#### Step 3.2: Kiểm tra Permissions trong localStorage
1. Mở DevTools (F12) → Tab "Console"
2. Chạy lệnh:
```javascript
JSON.parse(localStorage.getItem('user')).staff.permissions
```

**Expected Output:**
```json
{
  "articles": [
    "view", "create", "approve", "create_medicine", "create_disease",
    "edit_medicine", "edit_disease", "hide_medicine", "hide_disease",
    "delete_medicine", "delete_disease", "review_suggestion", 
    "view_suggestion"
  ]
}
```

**❌ Nếu thấy `{}` hoặc `null`:**
- Logout và login lại để refresh localStorage
- Kiểm tra lại database permissions

---

### 📝 **PHASE 4: Test Workflow Tạo & Phê Duyệt Bài Viết**

#### Test Case 1: Staff Content tạo bài viết mới

**Actor:** Staff Content (không phải Manager)

**Steps:**
1. Đăng nhập với Staff Content
2. Vào "Quản lý bài viết" → "Tạo bài viết mới"
3. Nhập:
   - Tiêu đề: "Test Article Approval System"
   - Danh mục: Tin tức
   - Nội dung: "This is a test article"
4. Click "Gửi phê duyệt"

**Expected Backend Logs:**
```
✓ Đã tạo thông báo cho user [Manager_User_ID]
✓ Đã gửi thông báo tới X người (admin + managers với quyền approve)
```

**Expected Database:**
```sql
-- Chạy query này ngay sau khi tạo bài viết:
SELECT * FROM notifications 
WHERE type = 'article' 
ORDER BY created_at DESC 
LIMIT 5;
```
```
✅ Có notification cho admin
✅ Có notification cho Manager Content
✅ Message: "[Staff Name] đã gửi bài viết mới "Test Article..." chờ phê duyệt"
```

---

#### Test Case 2: Manager Content nhận thông báo

**Actor:** Manager Content

**Steps:**
1. Đăng nhập với Manager Content
2. Kiểm tra icon thông báo (🔔) trên header
3. Click vào icon thông báo

**Expected:**
```
✅ Badge hiển thị số lượng thông báo chưa đọc (≥1)
✅ Thấy thông báo: "[Staff Name] đã gửi bài viết mới..."
✅ Click notification → redirect đến trang phê duyệt
```

**❌ Nếu không có thông báo:**
- Check console logs của server
- Chạy SQL test-notification-system.sql STEP 2
- Verify code đã update notifyManagersAndAdmins()

---

#### Test Case 3: Manager Content phê duyệt bài viết

**Actor:** Manager Content

**Steps:**
1. Vào "Quản lý bài viết" → Tab "Chờ phê duyệt"
2. Click vào bài viết "Test Article Approval System"
3. Kiểm tra UI có hiển thị nút "Duyệt" và "Từ chối"
4. Click "Duyệt"

**Expected:**
```
✅ Popup xác nhận xuất hiện
✅ Sau khi xác nhận: "Đã duyệt bài viết thành công"
✅ Bài viết chuyển sang status='approved'
✅ Staff Content nhận notification "Bài viết của bạn đã được phê duyệt"
```

**❌ Nếu không thấy nút "Duyệt":**
- Check `hasPermission('articles', 'approve')` trong DevTools Console:
```javascript
// Trong ArticleManagementPage, kiểm tra:
console.log(hasPermission('articles', 'approve')); // Phải là true
```
- Nếu `false`: Logout và login lại
- Nếu vẫn `false`: Check database permissions

---

#### Test Case 4: Manager Content từ chối bài viết

**Actor:** Manager Content

**Steps:**
1. Tạo bài viết mới với Staff Content
2. Đăng nhập Manager Content
3. Vào "Chờ phê duyệt" → Click bài viết
4. Click "Từ chối"
5. Nhập lý do: "Nội dung chưa đạt yêu cầu"
6. Xác nhận

**Expected:**
```
✅ Bài viết chuyển sang status='rejected'
✅ Staff Content nhận notification với lý do từ chối
✅ Staff Content có thể chỉnh sửa và gửi lại
```

---

### 🔍 **PHASE 5: Test Permission Restrictions**

#### Test Case 5: Staff Content thường KHÔNG thể duyệt

**Actor:** Staff Content (không phải Manager)

**Steps:**
1. Đăng nhập Staff Content (không phải Manager)
2. Vào "Quản lý bài viết" → Tab "Chờ phê duyệt"
3. Click vào bài viết pending

**Expected:**
```
✅ KHÔNG thấy nút "Duyệt" và "Từ chối"
✅ Chỉ thấy thông tin bài viết ở chế độ readonly
✅ Có thể thấy nút "Chỉnh sửa" nếu là tác giả
```

---

#### Test Case 6: Manager Content thấy TẤT CẢ bài viết

**Actor:** Manager Content

**Steps:**
1. Đăng nhập Manager Content
2. Vào "Quản lý bài viết" → Tab "Tất cả bài viết"

**Expected:**
```
✅ Thấy tất cả bài viết của mọi Staff Content
✅ Có thể filter theo status: draft, pending, approved, rejected
✅ Có thể search theo tiêu đề, tác giả
```

**vs Staff Content thường:**
```
✅ Chỉ thấy bài viết của chính mình
✅ Không thấy bài viết của Staff khác
```

---

#### Test Case 7: Manager Content tạo medicine/disease trực tiếp

**Actor:** Manager Content

**Steps:**
1. Đăng nhập Manager Content
2. Vào "Quản lý bài viết" → Tab "Quản lý thuốc"
3. Click "Thêm thuốc mới"
4. Nhập thông tin thuốc
5. Click "Lưu"

**Expected:**
```
✅ Thuốc được tạo trực tiếp (KHÔNG qua suggestions)
✅ Status ngay lập tức là active/visible
✅ Không cần phê duyệt
```

**vs Staff Content thường:**
```
✅ Click "Đề xuất thuốc mới"
✅ Thuốc vào bảng entity_suggestions với status='pending'
✅ Cần Manager/Admin phê duyệt
```

---

## 🐛 **TROUBLESHOOTING COMMON ISSUES**

### Issue 1: Manager Content không nhận notification

**Symptoms:**
- Staff tạo bài viết → Manager không thấy notification
- Admin nhận được notification bình thường

**Diagnosis:**
```sql
-- Check logs:
SELECT * FROM notifications 
WHERE type = 'article' 
AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE);
```

**Solutions:**
1. **Code chưa update:**
   ```bash
   grep -n "notifyManagersAndAdmins" server/controllers/articleController.js
   # Phải thấy ít nhất 3 occurrences (line ~936, ~1086, ~1605)
   ```
   - Nếu không thấy → Chưa update code đúng
   - Restart server sau khi update

2. **Permissions chưa có trong DB:**
   ```sql
   SELECT permissions FROM staff 
   WHERE department='content' AND rank='manager';
   ```
   - Nếu NULL hoặc `{}` → Chạy fix-manager-content-permissions.sql

3. **Cache localStorage cũ:**
   ```javascript
   // DevTools Console
   localStorage.clear();
   window.location.reload();
   ```
   - Login lại

---

### Issue 2: Manager Content bị redirect về /404

**Symptoms:**
- Click vào menu "Quản lý bài viết" → redirect /404
- Console error: "No permission to access this module"

**Diagnosis:**
```javascript
// DevTools Console
const user = JSON.parse(localStorage.getItem('user'));
console.log(user.staff.permissions);
```

**Solutions:**
1. **Permissions rỗng:**
   ```javascript
   // Expected: {articles: [...]}
   // Actual: {} hoặc null
   ```
   - Logout và login lại
   - Nếu vẫn rỗng → Check database permissions

2. **ProtectedRoute check failed:**
   - File: `client/src/components/ProtectedRoute.js`
   - Check `canAccessModule('articles')` logic
   - Verify usePermissions hook

---

### Issue 3: Nút "Duyệt" không hiển thị

**Symptoms:**
- Manager Content vào bài viết pending
- Không thấy button "Duyệt" và "Từ chối"

**Diagnosis:**
```javascript
// Trong ArticleManagementPage.js, thêm log:
console.log('Can approve:', hasPermission('articles', 'approve'));
console.log('Permissions:', permissions);
```

**Solutions:**
1. **Frontend permission check failed:**
   ```javascript
   // Expected: hasPermission('articles', 'approve') === true
   // Actual: false
   ```
   - Check localStorage permissions (Issue 2)
   - Verify usePermissions hook logic

2. **Component not rendering conditionally:**
   ```jsx
   {hasPermission('articles', 'approve') && (
     <Button onClick={handleApprove}>Duyệt</Button>
   )}
   ```
   - Verify JSX condition

---

### Issue 4: Staff thường vẫn thấy nút "Duyệt"

**Symptoms:**
- Staff Content (không phải Manager) thấy nút approve
- Staff có thể duyệt bài viết (không mong muốn)

**Solutions:**
1. **Over-permission:**
   ```sql
   -- Check if staff has approve permission
   SELECT email, permissions 
   FROM users u
   JOIN staff s ON u.id = s.user_id
   WHERE s.rank != 'manager';
   ```
   - Nếu thấy `"approve"` trong permissions → Remove nó

2. **Frontend check missing:**
   - Verify conditional rendering trong ArticleManagementPage.js

---

## 📊 **EXPECTED FINAL STATE**

### Database State:
```sql
-- Manager Content permissions:
{
  "articles": [
    "view", "create", "approve", "create_medicine", "create_disease",
    "edit_medicine", "edit_disease", "hide_medicine", "hide_disease",
    "delete_medicine", "delete_disease", "review_suggestion", 
    "view_suggestion"
  ]
}

-- Staff Content permissions (example):
{
  "articles": ["view", "create"]
}
```

### User Experience:

| Feature | Admin | Manager Content | Staff Content |
|---------|-------|-----------------|---------------|
| Tạo bài viết | ✅ | ✅ | ✅ |
| Xem bài viết của người khác | ✅ | ✅ | ❌ |
| Phê duyệt bài viết | ✅ | ✅ | ❌ |
| Tạo thuốc trực tiếp | ✅ | ✅ | ❌ (suggestions) |
| Nhận notification bài pending | ✅ | ✅ | ❌ |
| Ẩn/Xóa thuốc/bệnh lý | ✅ | ✅ | ❌ |

---

## 🎯 **SUCCESS CRITERIA**

Hệ thống được coi là hoạt động đúng khi:

✅ **Manager Content có đầy đủ 13 permissions** trong database  
✅ **Manager Content nhận notification** khi Staff gửi bài viết  
✅ **Manager Content thấy nút "Duyệt"** trong UI  
✅ **Manager Content duyệt được bài viết** thành công  
✅ **Staff Content không thấy nút "Duyệt"**  
✅ **Backend logs hiển thị:** "Đã gửi thông báo tới X người (admin + managers...)"  
✅ **Frontend không crash** khi click "Tạo bài viết"  
✅ **localStorage chứa permissions đầy đủ** sau login  

---

## 📁 **FILES CHANGED SUMMARY**

1. **Backend:**
   - `server/middleware/roleMiddleware.js` (Line ~195): Hardcoded Manager Content logic
   - `server/controllers/articleController.js` (Line ~67-143): Added `notifyManagersAndAdmins()`
   - `server/controllers/articleController.js` (Line ~936, ~1086, ~1605): Replace notifyAllAdmins
   - `server/scripts/fix-manager-content-permissions.sql`: Grant permissions
   - `server/scripts/test-notification-system.sql`: Test notifications

2. **Frontend:**
   - `client/src/hooks/usePermissions.js`: Permission checking hook
   - `client/src/components/ProtectedRoute.js`: Route protection
   - `client/src/pages/ArticleManagementPage.js`: CKEditor fixes + permission checks
   - `client/src/components/Sidebar.js`: Conditional menu rendering

---

## 🚀 **NEXT STEPS AFTER TESTING**

1. **Uncomment suggestion routes** (sau khi implement controllers):
   - `server/routes/articleRoutes.js` line ~115-143

2. **Add UI for medicine/disease suggestions**:
   - Tab "Đề xuất thuốc" trong ArticleManagementPage
   - Tab "Đề xuất bệnh lý" trong ArticleManagementPage

3. **Implement notification badge** in Header:
   - Count unread notifications
   - Show red badge number
   - Dropdown list when click

4. **Add audit logging**:
   - Log every approve/reject action
   - Track who approved what and when

---

**Created:** 2025-01-XX  
**Last Updated:** 2025-01-XX  
**Status:** ✅ Ready for Testing
