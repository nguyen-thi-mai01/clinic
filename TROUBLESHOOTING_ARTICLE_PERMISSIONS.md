# 🐛 TROUBLESHOOTING: Lỗi khi Nhân viên Content tạo bài viết

## Lỗi: "Cannot read properties of null (reading 'model')"

### Nguyên nhân có thể:

1. **CKEditor chưa khởi tạo đầy đủ** ✅ ĐÃ FIX
   - Đã thêm null check trong `onReady` callback
   - File: `ArticleManagementPage.js` line ~2320

2. **Nhân viên chưa có permissions trong database** ⚠️ CẦN KIỂM TRA
   - Permissions phải được lưu trong bảng `staff` cột `permissions`
   - Format JSON: `{"articles": ["view", "create", ...]}`

3. **localStorage chưa có permissions** ⚠️ CẦN LOGOUT/LOGIN LẠI
   - Sau khi cấp quyền trong database, phải logout và login lại
   - localStorage sẽ cập nhật permissions mới

---

## Hướng dẫn Fix từng bước:

### Bước 1: Kiểm tra permissions trong Database

```sql
-- Chạy trong MySQL
SELECT id, code, department, rank, permissions 
FROM staff 
WHERE department = 'content';
```

**Kết quả mong đợi:**
- `permissions` column phải có giá trị JSON
- Ví dụ: `{"articles": ["view", "create", "edit"]}`

**Nếu NULL hoặc empty:**
```sql
-- Chạy script grant-article-permissions.sql
-- Hoặc cập nhật thủ công:
UPDATE staff 
SET permissions = JSON_OBJECT(
  'articles', JSON_ARRAY('view', 'create', 'create_draft', 'edit')
)
WHERE id = <staff_id>;
```

---

### Bước 2: Logout và Login lại

1. Vào trang web
2. Nhấn **Logout**
3. Login lại với tài khoản nhân viên content
4. Mở Developer Tools (F12) → Console
5. Chạy lệnh:
```javascript
const user = JSON.parse(localStorage.getItem('user'));
console.log('Permissions:', user.staff.permissions);
```

**Kết quả mong đợi:**
```json
{
  "articles": ["view", "create", "create_draft", "edit", ...]
}
```

**Nếu không có permissions:**
- Có thể API login chưa trả về `staff.permissions`
- Kiểm tra `server/controllers/userController.js` trong hàm `login()`
- Đảm bảo response có include `staff.permissions`

---

### Bước 3: Test tạo bài viết

1. Vào `/quan-ly-bai-viet`
2. Nhấn **"+ Tạo bài viết"**
3. Mở Developer Tools → Console
4. Xem có lỗi gì không

**Nếu vẫn lỗi "Cannot read properties of null":**
- Reload lại trang (Ctrl+R)
- Clear cache (Ctrl+Shift+R)
- Check console có log gì thêm

---

### Bước 4: Kiểm tra usePermissions hook

Mở Console và chạy:
```javascript
// Test hook trực tiếp
const user = JSON.parse(localStorage.getItem('user'));
console.log('User role:', user.role);
console.log('Staff permissions:', user.staff?.permissions);
console.log('Has articles:view?', user.staff?.permissions?.articles?.includes('view'));
```

**Kết quả mong đợi:**
```
User role: staff
Staff permissions: {articles: Array(6)}
Has articles:view? true
```

---

## Các lỗi khác có thể gặp:

### Lỗi 1: "User không có quyền truy cập Quản lý bài viết"

**Nguyên nhân:** Không có module `articles` trong permissions

**Fix:**
```sql
UPDATE staff 
SET permissions = JSON_OBJECT('articles', JSON_ARRAY('view', 'create'))
WHERE id = <staff_id>;
```
Sau đó logout/login lại.

---

### Lỗi 2: "403 Forbidden" khi gọi API

**Nguyên nhân:** Backend roleMiddleware từ chối request

**Fix:**
1. Kiểm tra permissions trong database (Bước 1)
2. Đảm bảo quyền match với route:
   - `POST /articles` cần quyền `articles:create`
   - `GET /articles` cần quyền `articles:view`
3. Check log server:
```
🔒 User <username> chỉ xem bài của mình
🔓 Manager Content xem tất cả bài viết
```

---

### Lỗi 3: CKEditor không hiển thị

**Nguyên nhân:** Toolbar element null

**Fix:** ✅ Đã fix trong commit mới nhất
- Thêm null check trong `onReady` callback
- File: `ArticleManagementPage.js` line ~2320

---

## Checklist đầy đủ:

- [ ] Database có permissions cho staff content
- [ ] Logout và login lại
- [ ] localStorage có `user.staff.permissions`
- [ ] Vào `/quan-ly-bai-viet` không bị redirect
- [ ] Nhấn "Tạo bài viết" modal hiển thị
- [ ] CKEditor toolbar hiển thị bình thường
- [ ] Có thể nhập content và submit

---

## Liên hệ debug:

Nếu vẫn lỗi, cung cấp thông tin sau:

1. **Console log đầy đủ:**
```javascript
// Chạy trong Console
const user = JSON.parse(localStorage.getItem('user'));
console.log('=== DEBUG INFO ===');
console.log('1. User role:', user.role);
console.log('2. Staff info:', user.staff);
console.log('3. Permissions:', user.staff?.permissions);
console.log('4. Has articles module?', 'articles' in (user.staff?.permissions || {}));
console.log('5. Articles permissions:', user.staff?.permissions?.articles);
```

2. **Database query:**
```sql
SELECT id, user_id, code, department, rank, permissions 
FROM staff 
WHERE user_id = <user_id>;
```

3. **Screenshot lỗi** trong Console (F12)

---

## Quick Fix Script (chạy trong MySQL):

```sql
-- Fix nhanh cho tất cả staff content
UPDATE staff 
SET permissions = CASE 
  WHEN rank = 'manager' THEN JSON_OBJECT(
    'articles', JSON_ARRAY('view', 'create', 'create_draft', 'edit', 'delete', 'approve', 'reject', 
                           'suggest_medicine', 'approve_medicine', 'create_medicine',
                           'suggest_disease', 'approve_disease', 'create_disease')
  )
  ELSE JSON_OBJECT(
    'articles', JSON_ARRAY('view', 'create', 'create_draft', 'edit', 
                           'suggest_medicine', 'suggest_disease')
  )
END
WHERE department = 'content';

-- Verify
SELECT code, rank, JSON_EXTRACT(permissions, '$.articles') as articles_perms
FROM staff 
WHERE department = 'content';
```

Sau khi chạy script, **BẮT BUỘC** logout và login lại! 🔄
