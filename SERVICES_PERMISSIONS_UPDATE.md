# CẬP NHẬT PHÂN QUYỀN DỊCH VỤ & TƯ VẤN

**Ngày:** 14/12/2025  
**Mục tiêu:** Thêm permission check chi tiết cho 2 module: **Dịch vụ y tế** và **Gói tư vấn**

---

## 📋 TỔNG QUAN

### **Module được cập nhật:**
1. ✅ **Dịch vụ y tế** (Services)
2. ✅ **Gói tư vấn** (Consultation Pricing)

### **Các quyền đã cập nhật:**
- ❌ **Bỏ quyền "Xem"** - IT staff mặc định có thể xem
- ✅ **Tạo** - Thêm mới dịch vụ/gói
- ✅ **Sửa** - Chỉnh sửa thông tin
- ✅ **Xóa** - Xóa khỏi hệ thống  
- ✅ **Ẩn/Hiện** - Ẩn hoặc hiện trên website (mới thêm)
- ✅ **Định giá** - Thiết lập giá (chỉ cho Consultation Pricing)
- ✅ **Quản lý danh mục** - Tạo/sửa/xóa danh mục (chỉ cho Services)

---

## 🔧 BACKEND CHANGES

### **1. Middleware (roleMiddleware.js)**

**Thêm 10 cases permission mới:**

#### Services Module:
```javascript
case 'SERVICE_CREATE':        // Tạo dịch vụ
case 'SERVICE_EDIT':          // Sửa dịch vụ
case 'SERVICE_DELETE':        // Xóa dịch vụ
case 'SERVICE_HIDE':          // Ẩn/hiện dịch vụ
case 'SERVICE_MANAGE_CATEGORIES': // Quản lý danh mục
```

#### Consultation Pricing Module:
```javascript
case 'CONSULTATION_PRICING_CREATE':    // Tạo gói
case 'CONSULTATION_PRICING_EDIT':      // Sửa gói
case 'CONSULTATION_PRICING_DELETE':    // Xóa gói
case 'CONSULTATION_PRICING_HIDE':      // Ẩn/hiện gói
case 'CONSULTATION_PRICING_SET_PRICE': // Định giá
```

**Departments có quyền:**
- **Services**: `system` (IT department)
- **Consultation Pricing**: `system`, `support` (IT & Support departments)

---

### **2. Staff Controller (staffController.js)**

**Cập nhật PERMISSION_MODULES:**

```javascript
services: { 
  name: 'Dịch vụ y tế', 
  permissions: { 
    create: 'Tạo dịch vụ', 
    edit: 'Sửa dịch vụ', 
    delete: 'Xóa dịch vụ', 
    hide: 'Ẩn/Hiện dịch vụ',
    manage_categories: 'Quản lý danh mục' 
  } 
},
consultation_pricing: { 
  name: 'Gói tư vấn', 
  permissions: { 
    create: 'Tạo gói', 
    edit: 'Sửa gói', 
    delete: 'Xóa gói', 
    hide: 'Ẩn/Hiện gói',
    set_price: 'Định giá' 
  } 
}
```

---

### **3. Routes**

#### **serviceRoutes.js**
```javascript
// Thay vì authorize('admin'), giờ check permission:
router.get('/admin/all', authenticateToken, 
  (req, res, next) => {
    if (req.user.role === 'admin') return next();
    return roleMiddleware('SERVICE_VIEW')(req, res, next);
  },
  serviceController.getServicesForAdmin
);

router.post('/', authenticateToken, roleMiddleware('SERVICE_CREATE'), ...);
router.put('/:id', authenticateToken, roleMiddleware('SERVICE_EDIT'), ...);
router.delete('/:id', authenticateToken, roleMiddleware('SERVICE_DELETE'), ...);
```

#### **consultationRoutes.js**
```javascript
router.get('/admin/packages', authMiddleware, 
  roleMiddleware('CONSULTATION_PRICING_VIEW'), ...);

router.post('/admin/packages', authMiddleware, 
  roleMiddleware('CONSULTATION_PRICING_CREATE'), ...);

router.put('/admin/packages/:id', authMiddleware, 
  roleMiddleware('CONSULTATION_PRICING_EDIT'), ...);

router.delete('/admin/packages/:id', authMiddleware, 
  roleMiddleware('CONSULTATION_PRICING_DELETE'), ...);
```

---

## 🎨 FRONTEND CHANGES

### **1. StaffManagementPage.js**

**Cập nhật danh sách permissions hiển thị:**

```javascript
services: {
  name: 'Dịch vụ y tế',
  icon: <FaTools />,
  permissions: [
    { key: 'create', label: 'Tạo dịch vụ', description: 'Thêm dịch vụ y tế mới' },
    { key: 'edit', label: 'Sửa dịch vụ', description: 'Chỉnh sửa thông tin dịch vụ' },
    { key: 'delete', label: 'Xóa dịch vụ', description: 'Xóa dịch vụ khỏi hệ thống' },
    { key: 'hide', label: 'Ẩn/Hiện dịch vụ', description: 'Ẩn hoặc hiện dịch vụ trên website' },
    { key: 'manage_categories', label: 'Quản lý danh mục', description: 'Tạo/sửa/xóa danh mục dịch vụ' }
  ]
},
consultation_pricing: {
  name: 'Gói tư vấn',
  icon: <FaLightbulb />,
  permissions: [
    { key: 'create', label: 'Tạo gói', description: 'Thêm gói tư vấn mới' },
    { key: 'edit', label: 'Sửa gói', description: 'Chỉnh sửa thông tin gói tư vấn' },
    { key: 'delete', label: 'Xóa gói', description: 'Xóa gói tư vấn' },
    { key: 'hide', label: 'Ẩn/Hiện gói', description: 'Ẩn hoặc hiện gói trên website' },
    { key: 'set_price', label: 'Định giá', description: 'Thiết lập và thay đổi giá gói' }
  ]
}
```

---

### **2. Sidebar.js**

**Thêm permission check cho submenu:**

```javascript
{canAccessModule('services') && (
  <MenuDropdown icon={FaBriefcaseMedical} label="Quản lý Dịch vụ">
    {hasPermission('services', 'manage_categories') && (
      <Link to="/quan-ly-danh-muc-dich-vu">
        <span className="sidebar-submenu-dot">•</span> Danh mục Dịch vụ
      </Link>
    )}
    {(hasPermission('services', 'create') || hasPermission('services', 'edit') || 
      hasPermission('services', 'delete') || hasPermission('services', 'hide')) && (
      <Link to="/quan-ly-dich-vu">
        <span className="sidebar-submenu-dot">•</span> Dịch vụ
      </Link>
    )}
  </MenuDropdown>
)}
```

**⚠️ Lưu ý:** Admin sidebar không cần check vì admin có full quyền.

---

### **3. ServiceManagementPage.js**

**Thêm permission checks:**

```javascript
const { user } = useAuth();
const isAdmin = user?.role === 'admin';

const hasPermission = (module, permission) => {
  if (isAdmin) return true;
  if (!user?.role_info?.permissions) return false;
  const modulePerms = user.role_info.permissions[module];
  if (!modulePerms) return false;
  return Array.isArray(modulePerms) ? modulePerms.includes(permission) : false;
};

const canCreate = isAdmin || hasPermission('services', 'create');
const canEdit = isAdmin || hasPermission('services', 'edit');
const canDelete = isAdmin || hasPermission('services', 'delete');
const canHide = isAdmin || hasPermission('services', 'hide');
const canManageCategories = isAdmin || hasPermission('services', 'manage_categories');
```

**Conditional rendering cho buttons:**

```javascript
{/* Header - Nút Thêm dịch vụ */}
{canCreate && (
  <button onClick={handleOpenCreateModal}>
    <FaPlus /> Thêm dịch vụ
  </button>
)}

{/* Table Actions */}
<div className="servicemgmt-actions">
  <Link to={`/dich-vu/${service.id}`}>
    <FaEye />  {/* Xem - Luôn hiện */}
  </Link>
  {canEdit && (
    <button onClick={() => handleOpenEditModal(service.id)}>
      <FaEdit />  {/* Sửa */}
    </button>
  )}
  {canDelete && (
    <button onClick={() => handleDelete(service.id)}>
      <FaTrashAlt />  {/* Xóa */}
    </button>
  )}
</div>

{/* Bulk Actions */}
{canHide && (
  <>
    <button onClick={() => handleBulkStatusChange('active')}>
      <FaCheckCircle /> Kích hoạt
    </button>
    <button onClick={() => handleBulkStatusChange('inactive')}>
      <FaEyeSlash /> Tạm ngưng
    </button>
  </>
)}
{canDelete && (
  <button onClick={handleBulkDelete}>
    <FaTrashAlt /> Xóa
  </button>
)}
```

---

### **4. ConsultationPackageManagement.js**

**Permission checks tương tự:**

```javascript
const canCreate = isAdmin || hasPermission('consultation_pricing', 'create');
const canEdit = isAdmin || hasPermission('consultation_pricing', 'edit');
const canDelete = isAdmin || hasPermission('consultation_pricing', 'delete');
const canHide = isAdmin || hasPermission('consultation_pricing', 'hide');
const canSetPrice = isAdmin || hasPermission('consultation_pricing', 'set_price');
```

**Conditional rendering:**

```javascript
{/* Header - Nút Thêm gói */}
{canCreate && (
  <button onClick={() => setShowCreateModal(true)}>
    <FaPlus /> Thêm mới
  </button>
)}

{/* Status Badge - Toggle nếu có quyền hide */}
{canHide ? (
  <button className="cpm-status-badge" onClick={() => handleToggleStatus(pkg)}>
    {pkg.is_active ? 'Hoạt động' : 'Đã tắt'}
  </button>
) : (
  <div className="cpm-status-badge">
    {pkg.is_active ? 'Hoạt động' : 'Đã tắt'}
  </div>
)}

{/* Table Actions */}
<div className="cpm-actions">
  <Link to={`/dich-vu?tab=consultation`}>
    <FaEye />  {/* Xem - Luôn hiện */}
  </Link>
  {canEdit && (
    <button onClick={() => openEditModal(pkg)}>
      <FaEdit />
    </button>
  )}
  {canDelete && (
    <button onClick={() => handleDeletePackage(pkg)}>
      <FaTrash />
    </button>
  )}
</div>
```

---

## 🗄️ DATABASE

**Không cần thêm trường mới!** Cả 2 model đã có sẵn:

- **Service**: `status` (ENUM: 'active', 'inactive')
- **ConsultationPricing**: `is_active` (BOOLEAN)

---

## ✅ TESTING CHECKLIST

### **Backend:**
- [ ] Tạo staff IT với quyền `services.create`
- [ ] Test tạo dịch vụ → Thành công
- [ ] Test sửa dịch vụ không có quyền → 403 Forbidden
- [ ] Test xóa dịch vụ với quyền `services.delete` → Thành công
- [ ] Tương tự cho consultation_pricing

### **Frontend:**
- [ ] Login với staff có quyền `services.create` only
- [ ] Sidebar hiện "Dịch vụ" nhưng không hiện "Danh mục Dịch vụ"
- [ ] Trang ServiceManagement hiện nút "Thêm dịch vụ"
- [ ] Table không hiện nút Sửa/Xóa
- [ ] Nút "Kích hoạt/Tạm ngưng" không hiện
- [ ] Tương tự test cho consultation_pricing

---

## 📝 LƯU Ý QUAN TRỌNG

1. **Admin luôn có full quyền** - Không cần check permission
2. **IT Staff mặc định xem được** - Không cần quyền `view`
3. **Support Department** cũng có thể quản lý Consultation Pricing
4. **Chức năng Hide/Show đã có sẵn** - Chỉ thêm permission check
5. **Sidebar Staff** cần check quyền chi tiết
6. **Sidebar Admin** không cần check (admin full quyền)

---

## 🚀 NEXT STEPS

Sau khi test xong 2 module này, tiếp tục rà soát:

1. ✅ Dịch vụ y tế (Services) - DONE
2. ✅ Gói tư vấn (Consultation Pricing) - DONE
3. ⏳ Bài viết (Articles)
4. ⏳ Diễn đàn (Forum)
5. ⏳ Lịch hẹn (Appointments)
6. ⏳ Thanh toán (Payments)
7. ⏳ Nhân sự (Staff Management)

---

**Hoàn thành bởi:** GitHub Copilot  
**Kiểm tra lỗi:** ✅ No compilation errors
