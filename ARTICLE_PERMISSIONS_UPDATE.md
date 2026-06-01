# CẬP NHẬT HỆ THỐNG QUYỀN CHO QUẢN LÝ BÀI VIẾT

## 📋 TỔNG QUAN

Cập nhật hệ thống phân quyền cho chức năng **Quản lý Bài viết** với các cải tiến sau:

### ✨ Tính năng mới

1. **Manager Content có quyền như Admin**
   - Manager Content (rank='manager' && department='content') có FULL quyền trong module articles
   - Xem tất cả bài viết của tất cả người dùng
   - Tạo thuốc/bệnh lý trực tiếp (không qua đề xuất)
   - Duyệt bài viết, thuốc, bệnh lý

2. **Staff Content thường giữ nguyên quyền cũ**
   - Chỉ xem được bài viết của mình
   - Phải gửi đề xuất thuốc/bệnh lý (không tạo trực tiếp)
   - Gửi bài viết để phê duyệt cho Manager hoặc Admin

3. **Hệ thống đề xuất thuốc/bệnh lý**
   - Thêm routes cho đề xuất thuốc/bệnh lý
   - Quyền mới: `suggest_medicine`, `approve_medicine`, `create_medicine`
   - Quyền mới: `suggest_disease`, `approve_disease`, `create_disease`

4. **Bảo vệ routes với ProtectedRoute**
   - User không có quyền sẽ bị redirect về /404
   - Kiểm tra quyền cả ở frontend và backend

---

## 🔧 CÁC FILE ĐÃ THAY ĐỔI

### 1. **Backend - Middleware**

#### `server/middleware/roleMiddleware.js`

**Thay đổi:** Thêm logic đặc biệt cho Manager Content

```javascript
// Dòng ~190-210
default:
  if (permissions && typeof permissions === 'object') {
    const [module, action] = requiredPermission.split(':');
    
    // ✨ ĐẶC BIỆT: Manager Content có FULL quyền articles như Admin
    if (module === 'articles' && department === 'content' && rank === 'manager') {
      hasPermission = true;
      console.log(`🔓 Manager Content có full quyền articles:${action}`);
    } 
    // ✅ Kiểm tra quyền thông thường
    else if (permissions[module]) {
      if (Array.isArray(permissions[module])) {
        hasPermission = permissions[module].includes(action);
      } else if (permissions[module] === true) {
        hasPermission = true;
      }
    }
  }
```

**Lý do:** Manager Content cần quyền như Admin trong module articles

---

### 2. **Backend - Controller**

#### `server/controllers/articleController.js`

**Thay đổi 1:** Hàm `getArticles()` - Dòng ~530-590

```javascript
// 🔓 Check xem user có phải là Manager Content không
const isManager = await (async () => {
  if (user.role === 'admin') return true;
  if (user.role === 'staff') {
    const staff = await models.Staff.findOne({ where: { user_id: user.id } });
    return staff && staff.department === 'content' && staff.rank === 'manager';
  }
  return false;
})();

if (!isManager) {
  // 👤 Staff thường hoặc Doctor: Chỉ thấy bài của mình
  where.author_id = user.id;
} else {
  // 👑 Admin hoặc Manager Content: Thấy TẤT CẢ
  // Không giới hạn author_id
}
```

**Thay đổi 2:** Hàm `getArticleById()` - Dòng ~700-720

```javascript
// 🔐 PHÂN QUYỀN: Check xem user có quyền xem bài này không
const isManager = await (async () => {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'staff') {
    const staff = await models.Staff.findOne({ where: { user_id: req.user.id } });
    return staff && staff.department === 'content' && staff.rank === 'manager';
  }
  return false;
})();

// 👤 Staff thường/Doctor chỉ xem được bài của mình
// 👑 Admin/Manager Content xem được tất cả bài
if (!isManager && article.author_id !== req.user.id) {
  return res.status(403).json({ success: false, message: 'Bạn không có quyền xem bài viết này' });
}
```

**Lý do:** Manager Content cần xem tất cả bài viết để quản lý

---

### 3. **Backend - Routes**

#### `server/routes/articleRoutes.js`

**Thay đổi 1:** Thêm routes đề xuất thuốc (sau dòng ~107)

```javascript
// --- ĐỀ XUẤT THUỐC (MEDICINE SUGGESTIONS) ---

// 📋 XEM DANH SÁCH ĐỀ XUẤT THUỐC
router.get('/medicines/suggestions', authenticateToken, roleMiddleware('articles:view'), 
  articleController.getMedicineSuggestions);

// ✍️ GỬI ĐỀ XUẤT THUỐC MỚI - Yêu cầu quyền 'articles:suggest_medicine'
router.post('/medicines/suggestions', authenticateToken, roleMiddleware('articles:suggest_medicine'), 
  articleController.createMedicineSuggestion);

// ✅ DUYỆT/TỪ CHỐI ĐỀ XUẤT THUỐC - Yêu cầu quyền 'articles:approve_medicine'
router.put('/medicines/suggestions/:id/review', authenticateToken, roleMiddleware('articles:approve_medicine'), 
  articleController.reviewMedicineSuggestion);
```

**Thay đổi 2:** Thêm routes đề xuất bệnh lý (sau dòng ~120)

```javascript
// --- ĐỀ XUẤT BỆNH LÝ (DISEASE SUGGESTIONS) ---

// 📋 XEM DANH SÁCH ĐỀ XUẤT BỆNH LÝ
router.get('/diseases/suggestions', authenticateToken, roleMiddleware('articles:view'), 
  articleController.getDiseaseSuggestions);

// ✍️ GỬI ĐỀ XUẤT BỆNH LÝ MỚI - Yêu cầu quyền 'articles:suggest_disease'
router.post('/diseases/suggestions', authenticateToken, roleMiddleware('articles:suggest_disease'), 
  articleController.createDiseaseSuggestion);

// ✅ DUYỆT/TỪ CHỐI ĐỀ XUẤT BỆNH LÝ - Yêu cầu quyền 'articles:approve_disease'
router.put('/diseases/suggestions/:id/review', authenticateToken, roleMiddleware('articles:approve_disease'), 
  articleController.reviewDiseaseSuggestion);
```

**Thay đổi 3:** Cập nhật quyền tạo thuốc/bệnh lý trực tiếp (dòng ~58, ~90)

```javascript
// ➕ TẠO THUỐC MỚI - Yêu cầu quyền 'articles:create_medicine'
// 🔐 CHỈ Manager Content hoặc Admin mới được tạo thuốc trực tiếp
router.post('/medicines', authenticateToken, roleMiddleware('articles:create_medicine'), 
  articleController.createMedicine);

// ➕ TẠO BỆNH LÝ MỚI - Yêu cầu quyền 'articles:create_disease'
// 🔐 CHỈ Manager Content hoặc Admin mới được tạo bệnh lý trực tiếp
router.post('/diseases', authenticateToken, roleMiddleware('articles:create_disease'), 
  articleController.createDisease);
```

**Lý do:** Tách biệt quyền tạo trực tiếp vs đề xuất

---

### 4. **Frontend - Components**

#### `client/src/components/ProtectedRoute.js` (MỚI)

**Nội dung:** Component bảo vệ routes theo quyền

```javascript
const ProtectedRoute = ({ 
  requiredModule = null, 
  requiredPermission = null, 
  children, 
  redirectTo = '/404' 
}) => {
  const { user, canAccessModule, hasPermission, isAdmin } = usePermissions();

  // Admin có toàn quyền
  if (isAdmin) return children;

  // Kiểm tra quyền module
  if (requiredModule && !canAccessModule(requiredModule)) {
    return <Navigate to={redirectTo} replace />;
  }

  // Kiểm tra quyền cụ thể
  if (requiredPermission) {
    const [module, action] = requiredPermission.split(':');
    if (!hasPermission(module, action)) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return children;
};
```

**Lý do:** Bảo vệ routes khỏi truy cập trái phép

---

### 5. **Frontend - Pages**

#### `client/src/pages/ArticleManagementPage.js`

**Thay đổi 1:** Import usePermissions hook

```javascript
import usePermissions from '../hooks/usePermissions';
```

**Thay đổi 2:** Sử dụng hook và redirect

```javascript
const { user: authUser, canAccessModule, hasPermission, isAdmin } = usePermissions();

// 🔐 KIỂM TRA QUYỀN TRUY CẬP
useEffect(() => {
  if (authUser && !isAdmin && !canAccessModule('articles')) {
    console.warn('⚠️ User không có quyền truy cập Quản lý bài viết');
    navigate('/404');
    return;
  }
}, [authUser, isAdmin, canAccessModule, navigate]);
```

**Lý do:** Double-check quyền ở frontend

---

#### `client/src/pages/StaffManagementPage.js`

**Thay đổi:** Cập nhật PERMISSION_MODULES (dòng ~80-95)

```javascript
articles: {
  name: 'Quản lý bài viết',
  icon: <FaNewspaper />,
  permissions: [
    { key: 'view', label: 'Xem', description: 'Xem danh sách bài viết (Staff chỉ xem của mình, Manager xem tất cả)' },
    { key: 'create', label: 'Tạo', description: 'Viết bài mới' },
    { key: 'create_draft', label: 'Tạo nháp', description: 'Tạo bài viết nháp' },
    { key: 'edit', label: 'Sửa', description: 'Chỉnh sửa bài viết' },
    { key: 'delete', label: 'Xóa', description: 'Xóa bài viết' },
    { key: 'approve', label: 'Duyệt', description: 'Duyệt bài viết trước khi xuất bản' },
    { key: 'reject', label: 'Từ chối', description: 'Từ chối bài viết' },
    { key: 'suggest_medicine', label: 'Đề xuất thuốc', description: 'Đề xuất thêm thuốc mới' },
    { key: 'approve_medicine', label: 'Duyệt thuốc', description: 'Phê duyệt đề xuất thuốc (Manager)' },
    { key: 'create_medicine', label: 'Tạo thuốc', description: 'Tạo thuốc mới trực tiếp (Manager)' },
    { key: 'suggest_disease', label: 'Đề xuất bệnh lý', description: 'Đề xuất thêm bệnh lý mới' },
    { key: 'approve_disease', label: 'Duyệt bệnh lý', description: 'Phê duyệt đề xuất bệnh lý (Manager)' },
    { key: 'create_disease', label: 'Tạo bệnh lý', description: 'Tạo bệnh lý mới trực tiếp (Manager)' }
  ]
},
```

**Lý do:** Bổ sung quyền thuốc/bệnh lý vào giao diện phân quyền

---

#### `client/src/App.js`

**Thay đổi:** Cập nhật routes với ProtectedRoute mới

```javascript
{/* 🔐 QUẢN LÝ BÀI VIẾT - Yêu cầu quyền articles module */}
<Route path="/quan-ly-bai-viet" element={
  <ProtectedRoute requiredModule="articles">
    <ArticleManagementPage />
  </ProtectedRoute>
} />

<Route path="/phe-duyet-bai-viet/:id" element={
  <ProtectedRoute requiredPermission="articles:approve">
    <ArticleReviewPage />
  </ProtectedRoute>
} />
```

**Lý do:** Sử dụng ProtectedRoute mới với logic quyền chi tiết

---

## 📊 BẢNG PHÂN QUYỀN MỚI

| Quyền | Admin | Manager Content | Staff Content | Doctor |
|-------|-------|----------------|---------------|--------|
| **Xem tất cả bài viết** | ✅ | ✅ | ❌ (chỉ của mình) | ❌ (chỉ của mình) |
| **Tạo bài viết** | ✅ | ✅ | ✅ | ✅ |
| **Duyệt bài viết** | ✅ | ✅ | ❌ | ❌ |
| **Tạo thuốc trực tiếp** | ✅ | ✅ | ❌ | ❌ |
| **Đề xuất thuốc** | ✅ | ✅ | ✅ | ✅ |
| **Duyệt đề xuất thuốc** | ✅ | ✅ | ❌ | ❌ |
| **Tạo bệnh lý trực tiếp** | ✅ | ✅ | ❌ | ❌ |
| **Đề xuất bệnh lý** | ✅ | ✅ | ✅ | ✅ |
| **Duyệt đề xuất bệnh lý** | ✅ | ✅ | ❌ | ❌ |

---

## 🚀 HƯỚNG DẪN SỬ DỤNG

### Bước 1: Phân quyền cho Manager Content

1. Vào **Quản lý Nhân sự** (`/quan-ly-nhan-vien`)
2. Chọn phòng ban **Nội dung**
3. Chọn nhân viên → Tab **Quyền hạn**
4. Tích tất cả quyền trong module **Quản lý bài viết**:
   - ✅ view, create, create_draft, edit, delete
   - ✅ approve, reject
   - ✅ suggest_medicine, approve_medicine, create_medicine
   - ✅ suggest_disease, approve_disease, create_disease
5. Lưu thay đổi

### Bước 2: Phân quyền cho Staff Content thường

1. Chọn nhân viên Staff → Tab **Quyền hạn**
2. Tích các quyền cơ bản:
   - ✅ view, create, create_draft, edit
   - ✅ suggest_medicine, suggest_disease
3. **KHÔNG** tích:
   - ❌ approve, reject
   - ❌ create_medicine, approve_medicine
   - ❌ create_disease, approve_disease
4. Lưu thay đổi

### Bước 3: Test hệ thống

**Test Manager Content:**
- ✅ Login → Vào `/quan-ly-bai-viet`
- ✅ Thấy tất cả bài viết (cả của người khác)
- ✅ Tạo thuốc/bệnh lý trực tiếp (không qua đề xuất)
- ✅ Duyệt bài viết, thuốc, bệnh lý

**Test Staff Content:**
- ✅ Login → Vào `/quan-ly-bai-viet`
- ✅ Chỉ thấy bài viết của mình
- ✅ Gửi đề xuất thuốc/bệnh lý
- ❌ Không thấy nút "Tạo thuốc/bệnh lý trực tiếp"
- ❌ Không thấy nút "Duyệt"

**Test User không có quyền:**
- ✅ Login với user không có quyền articles
- ✅ Vào `/quan-ly-bai-viet` → Redirect về `/404`

---

## ⚠️ LƯU Ý

### Backend

1. **Middleware check quyền:** 
   - Manager Content được hardcode có full quyền articles
   - Logic trong `roleMiddleware.js` line ~195

2. **Controller check Manager:**
   ```javascript
   const staff = await models.Staff.findOne({ where: { user_id: user.id } });
   return staff && staff.department === 'content' && staff.rank === 'manager';
   ```

3. **Routes mới cần implement controller:**
   - `getMedicineSuggestions()` - Lấy danh sách đề xuất thuốc
   - `createMedicineSuggestion()` - Tạo đề xuất thuốc
   - `reviewMedicineSuggestion()` - Duyệt đề xuất thuốc
   - `getDiseaseSuggestions()` - Lấy danh sách đề xuất bệnh lý
   - `createDiseaseSuggestion()` - Tạo đề xuất bệnh lý
   - `reviewDiseaseSuggestion()` - Duyệt đề xuất bệnh lý

### Frontend

1. **usePermissions hook:**
   - Đọc permissions từ `localStorage.getItem('user')`
   - Cần logout/login lại nếu permissions thay đổi

2. **ProtectedRoute:**
   - Kiểm tra 2 loại: `requiredModule` và `requiredPermission`
   - Redirect về `/404` nếu không có quyền

3. **Double-check:**
   - Frontend: usePermissions hook + ProtectedRoute
   - Backend: roleMiddleware + controller logic

---

## 🐛 TROUBLESHOOTING

### Vấn đề 1: Manager Content không thấy tất cả bài viết

**Nguyên nhân:** Database chưa set rank='manager' hoặc department='content'

**Giải pháp:**
```sql
UPDATE staff SET rank='manager' WHERE id = <staff_id>;
UPDATE staff SET department='content' WHERE id = <staff_id>;
```

### Vấn đề 2: User bị redirect về /404 dù có quyền

**Nguyên nhân:** Permissions trong localStorage không đồng bộ với database

**Giải pháp:**
1. Logout
2. Login lại
3. Check localStorage: `JSON.parse(localStorage.getItem('user')).staff.permissions`

### Vấn đề 3: Routes suggestions trả về 404

**Nguyên nhân:** Chưa implement controller functions

**Giải pháp:**
Implement các function trong `articleController.js`:
- `getMedicineSuggestions`, `createMedicineSuggestion`, `reviewMedicineSuggestion`
- `getDiseaseSuggestions`, `createDiseaseSuggestion`, `reviewDiseaseSuggestion`

---

## 📝 CHECKLIST TRIỂN KHAI

- [x] Cập nhật `roleMiddleware.js` - Logic Manager Content
- [x] Cập nhật `articleController.js` - getArticles() và getArticleById()
- [x] Cập nhật `articleRoutes.js` - Thêm routes suggestions
- [x] Tạo `ProtectedRoute.js` component
- [x] Cập nhật `ArticleManagementPage.js` - usePermissions hook
- [x] Cập nhật `StaffManagementPage.js` - PERMISSION_MODULES
- [x] Cập nhật `App.js` - Sử dụng ProtectedRoute mới
- [ ] **TODO:** Implement controller functions cho suggestions
- [ ] **TODO:** Test toàn bộ flow với 3 roles (Admin, Manager, Staff)
- [ ] **TODO:** Cập nhật frontend UI để hiển thị nút "Đề xuất thuốc/bệnh lý"

---

## 📚 TÀI LIỆU LIÊN QUAN

- `server/PERMISSION_IMPLEMENTATION_GUIDE.md` - Hướng dẫn phân quyền backend
- `client/FRONTEND_PERMISSIONS_GUIDE.md` - Hướng dẫn phân quyền frontend
- `usePermissions.js` - Custom hook kiểm tra quyền

---

**Cập nhật:** 13/12/2024  
**Người thực hiện:** GitHub Copilot
