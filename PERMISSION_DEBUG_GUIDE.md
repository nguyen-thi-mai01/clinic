# 🔍 PERMISSION SYSTEM DEBUG GUIDE

## 📋 Tình Huống
Staff được cấu hình quyền truy cập các module (services, consultations, consultation_pricing, system_settings) nhưng sau khi restart vẫn không thể truy cập các trang đó.

## 🎯 Kiểm Tra Đã Thực Hiện

### 1. ✅ Sidebar Logic - FIXED
- **Vấn đề cũ**: Có hàm `hasPermission` local override hook function
- **Đã sửa**: Xóa local function, dùng hook trực tiếp
- **Kết quả**: Sidebar đã hiện dropdown đúng

### 2. ✅ Route Protection - FIXED
- **Tạo mới**: Component `PermissionRoute` để check quyền ở route level
- **Implemented**: Wrap các route với `requiredModule` parameter
- **Kết quả**: Routes check quyền trước khi render

### 3. ✅ React Hooks Ordering - FIXED
- **Vấn đề**: Conditional return trước khi gọi hooks
- **Đã sửa**: Di chuyển tất cả hooks lên trên conditional returns
- **Kết quả**: Không còn error "hooks called conditionally"

### 4. ✅ Backend API Authorization - FIXED
- **Vấn đề**: Routes chỉ authorize cho 'admin'
- **Đã sửa**: Thay `authorize('admin')` → `authorize('admin', 'staff')`
- **Kết quả**: Staff có thể gọi API

### 5. ✅ Permission Check Logic - FIXED
- **Vấn đề**: Check permission 'view' cụ thể (không tồn tại)
- **Đã sửa**: Check ANY permission trong module (length > 0)
- **Kết quả**: canAccessModule đúng logic hơn

### 6. ✅ getProfile API - FIXED
- **Vấn đề**: F5 refresh mất permissions (getProfile không trả về)
- **Đã sửa**: Thêm `role_info.permissions` vào response
- **Kết quả**: Permissions persist sau F5

## 🔑 Module Key Mapping

### Frontend (StaffManagementPage.js)
```javascript
PERMISSION_MODULES = {
  services: {...},
  consultations: {...},
  consultation_pricing: {...},
  system_settings: {...},
  // ... other modules
}
```

### Backend (departmentPermissions.js)
```javascript
{
  services: ['create', 'edit', 'delete', ...],
  consultations: ['view', 'reply', 'assign', ...],
  consultation_pricing: ['create', 'edit', 'set_price', ...],
  system_settings: ['view', 'edit_home', ...]
}
```

### Routes (App.js)
```javascript
<PermissionRoute requiredModule="services">
<PermissionRoute requiredModule="consultations">
<PermissionRoute requiredModule="consultation_pricing">
<PermissionRoute requiredModule="system_settings">
```

### Sidebar (Sidebar.js)
```javascript
canAccessModule('services')
canAccessModule('consultations')
canAccessModule('consultation_pricing')
canAccessModule('system_settings')
```

✅ **Tất cả keys đều KHỚP NHAU!**

## 🧪 Debug Tools Đã Tạo

### 1. Browser Console Script
**File**: `DEBUG_PERMISSIONS_BROWSER_CONSOLE.js`

**Cách dùng**:
1. Copy toàn bộ nội dung file
2. Mở Developer Tools (F12)
3. Vào tab Console
4. Paste và Enter
5. Xem kết quả phân tích permissions

**Output**:
- User information
- Raw permissions object
- Module-by-module breakdown
- Critical modules check
- canAccessModule() logic test

### 2. Permission Debug Page
**Route**: `/debug-permissions`

**Features**:
- 👤 User Information Display
- 🔐 Raw Permissions Object (JSON)
- 🎯 Module Access Status Table
- 🧪 Specific Permission Tests
- 💾 LocalStorage User Data

**Access**: 
```
http://localhost:3000/debug-permissions
```

## 🔍 Cách Debug Tiếp Theo

### Bước 1: Kiểm tra permissions trong database
```sql
SELECT u.email, s.department, s.rank, s.permissions 
FROM users u
JOIN staff s ON u.id = s.user_id
WHERE s.rank = 'staff'
LIMIT 1;
```

### Bước 2: Kiểm tra localStorage
```javascript
// Trong browser console
console.log(JSON.parse(localStorage.getItem('user')));
```

### Bước 3: Truy cập Debug Page
```
http://localhost:3000/debug-permissions
```

### Bước 4: Xác định vấn đề
**Có 3 khả năng**:

#### A. Database không có permissions
**Triệu chứng**: `permissions: {}` hoặc `permissions: null`

**Giải pháp**:
1. Vào trang Quản lý nhân sự
2. Chọn staff cần phân quyền
3. Click "Phân quyền"
4. Tick các module cần thiết
5. Lưu lại

#### B. localStorage không có permissions
**Triệu chứng**: 
- Database có permissions
- localStorage không có `role_info.permissions`

**Giải pháp**:
1. Logout
2. Login lại
3. Check lại localStorage

#### C. Permission keys không khớp
**Triệu chứng**:
- Database: `{service: ['create']}` (thiếu 's')
- Frontend: check `services` (có 's')

**Giải pháp**:
1. Đồng bộ keys giữa frontend và backend
2. Update database với keys đúng
3. Test lại

## 🎯 Expected Behavior

### Khi Staff có quyền "services"
```javascript
// Database
{
  services: ['create', 'edit', 'delete', 'hide', 'manage_categories']
}

// localStorage (sau login)
{
  role: 'staff',
  role_info: {
    department: 'system',
    rank: 'staff',
    permissions: {
      services: ['create', 'edit', 'delete', 'hide', 'manage_categories']
    }
  }
}

// usePermissions hook
canAccessModule('services') // → true
hasPermission('services', 'create') // → true

// Sidebar
- Menu "Dịch vụ y tế" hiện ✅
- Dropdown "Quản lý dịch vụ" hiện ✅

// Route
/quan-ly-dich-vu → Accessible ✅
```

## 📊 Current Status

### ✅ Đã hoàn thành
1. Fixed Sidebar hasPermission logic
2. Created PermissionRoute component
3. Updated backend routes authorization
4. Fixed React hooks ordering
5. Fixed canAccessModule logic
6. Added role_info to getProfile API
7. Created Debug Tools (Browser script + Debug page)

### ⚠️ Cần kiểm tra
1. Permissions thực tế trong database
2. Permissions trong localStorage sau login
3. Module keys consistency (đã verify - đều khớp)

### 🔲 Chưa làm
- Test với staff account thực tế
- Verify permissions được lưu đúng vào database khi phân quyền
- Confirm bug đã được fix hoàn toàn

## 🚀 Next Steps

1. **User thực hiện**:
   - Login với staff account
   - Truy cập `/debug-permissions`
   - Copy kết quả và report lại

2. **Agent sẽ phân tích**:
   - Raw permissions object
   - Module access status
   - Xác định chính xác vấn đề còn lại

3. **Fix cuối cùng** (nếu cần):
   - Sửa database structure
   - Update seed data
   - Hoặc fix logic check permissions

## 📝 Notes

- Tất cả module keys đã được verify và KHỚP NHAU
- Permission system sử dụng 3 formats: Boolean, Array, Object
- Admin bypass tất cả checks với flag `permissions = 'admin'`
- Staff permissions lưu dạng JSON trong column `permissions` của table `staff`

## 🔗 Related Files

### Frontend
- `client/src/hooks/usePermissions.js` - Permission checking logic
- `client/src/components/common/PermissionRoute.js` - Route-level protection
- `client/src/components/common/Sidebar.js` - Menu visibility
- `client/src/pages/StaffManagementPage.js` - PERMISSION_MODULES definition
- `client/src/pages/PermissionDebugPage.js` - Debug UI

### Backend
- `server/config/departmentPermissions.js` - Default permissions
- `server/controllers/userController.js` - Login & getProfile
- `server/routes/serviceCategoryRoutes.js` - Example route authorization
- `server/middleware/authMiddleware.js` - authorize() function

### Debug
- `DEBUG_PERMISSIONS_BROWSER_CONSOLE.js` - Browser console script
- `client/src/pages/PermissionDebugPage.js` - Visual debug page
