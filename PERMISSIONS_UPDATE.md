# CẬP NHẬT PHÂN QUYỀN HỆ THỐNG - PHÒNG IT

## 📋 TỔNG QUAN

Cập nhật hệ thống phân quyền cho **Phòng IT (System Department)** với các module mới và chi tiết hơn.

---

## 🔐 CÁC MODULE PHÂN QUYỀN MỚI

### 1. **SYSTEM_SETTINGS** (Cài đặt hệ thống)

#### Quyền cũ:
- `view` - Xem cấu hình
- `edit` - Sửa cài đặt

#### ✨ Quyền mới bổ sung:
- `edit_homepage` - Chỉnh sửa nội dung trang chủ
- `edit_about` - Chỉnh sửa trang giới thiệu
- `edit_contact` - Chỉnh sửa thông tin liên hệ
- `edit_privacy` - Chỉnh sửa chính sách bảo mật
- `edit_terms` - Chỉnh sửa điều khoản sử dụng
- `backup` - Sao lưu và khôi phục dữ liệu

#### Ý nghĩa:
- **Manager IT**: Có thể cấp quyền chỉnh sửa từng trang cụ thể cho staff
- **Staff IT**: Chỉ được chỉnh sửa các trang được giao

#### Ví dụ phân quyền:
```json
{
  "system_settings": [
    "view",
    "edit_homepage",
    "edit_about"
  ]
}
```
→ Staff này chỉ được sửa trang chủ và giới thiệu, KHÔNG được sửa chính sách/điều khoản

---

### 2. **SERVICES** (Dịch vụ y tế)

#### Quyền cũ:
- `view` - Xem danh sách
- `create` - Tạo mới
- `edit` - Chỉnh sửa
- `delete` - Xóa

#### ✨ Quyền mới bổ sung:
- `manage_categories` - Quản lý danh mục dịch vụ (service categories)

#### Ý nghĩa:
- Tách biệt quyền quản lý danh mục và dịch vụ
- Manager có thể cấp quyền tạo dịch vụ nhưng không cho sửa danh mục

---

### 3. **CONSULTATION_PRICING** (Gói tư vấn) - ✨ MỚI

#### Tất cả quyền:
- `view` - Xem danh sách gói tư vấn
- `create` - Thêm gói tư vấn mới
- `edit` - Chỉnh sửa gói tư vấn
- `delete` - Xóa gói tư vấn
- `set_price` - Thiết lập giá gói tư vấn

#### Ý nghĩa:
- Phân quyền riêng cho gói tư vấn (consultation pricing)
- Tách biệt với quyền `consultations` (quản lý yêu cầu tư vấn)
- `set_price` dành riêng cho Manager để kiểm soát giá cả

---

## 🗺️ MAPPING VỚI BACKEND

### Frontend Permission Keys
```javascript
// StaffManagementPage.js
const PERMISSION_GROUPS = {
  system_settings: {
    permissions: [
      { key: 'view', ... },
      { key: 'edit', ... },
      { key: 'edit_homepage', ... },
      { key: 'edit_about', ... },
      { key: 'edit_contact', ... },
      { key: 'edit_privacy', ... },
      { key: 'edit_terms', ... },
      { key: 'backup', ... }
    ]
  },
  services: {
    permissions: [
      { key: 'view', ... },
      { key: 'create', ... },
      { key: 'edit', ... },
      { key: 'delete', ... },
      { key: 'manage_categories', ... }
    ]
  },
  consultation_pricing: {
    permissions: [
      { key: 'view', ... },
      { key: 'create', ... },
      { key: 'edit', ... },
      { key: 'delete', ... },
      { key: 'set_price', ... }
    ]
  }
}
```

### Backend roleMiddleware Keys
```javascript
// server/middleware/roleMiddleware.js

// Cần thêm cases mới:
case 'system_settings:edit_homepage':
  if (department === 'system' && permissions.system_settings?.includes('edit_homepage')) {
    hasPermission = true;
  }
  break;

case 'system_settings:edit_about':
  // Tương tự...
  break;

case 'services:manage_categories':
  if (department === 'system' && permissions.services?.includes('manage_categories')) {
    hasPermission = true;
  }
  break;

case 'consultation_pricing:view':
case 'consultation_pricing:create':
case 'consultation_pricing:edit':
case 'consultation_pricing:delete':
case 'consultation_pricing:set_price':
  const [module, action] = requiredPermission.split(':');
  if (department === 'system' && permissions.consultation_pricing?.includes(action)) {
    hasPermission = true;
  }
  break;
```

---

## 📊 CẤU TRÚC DATABASE

### Bảng `staff` - Cột `permissions` (JSON)

#### Ví dụ Staff IT với đầy đủ quyền:
```json
{
  "appointments": ["view"],
  "system_settings": [
    "view",
    "edit",
    "edit_homepage",
    "edit_about",
    "edit_contact",
    "edit_privacy",
    "edit_terms",
    "backup"
  ],
  "services": [
    "view",
    "create",
    "edit",
    "delete",
    "manage_categories"
  ],
  "consultation_pricing": [
    "view",
    "create",
    "edit",
    "delete",
    "set_price"
  ]
}
```

#### Ví dụ Staff IT chỉ sửa trang tĩnh:
```json
{
  "system_settings": [
    "view",
    "edit_homepage",
    "edit_contact"
  ]
}
```

---

## 🔄 CÁC API ENDPOINT CẦN CẬP NHẬT

### 1. System Settings
```javascript
// server/routes/systemRoutes.js

// Trang tĩnh
router.put('/pages/homepage', 
  authenticateToken, 
  roleMiddleware('system_settings:edit_homepage'), 
  systemController.updateHomepage
);

router.put('/pages/about', 
  authenticateToken, 
  roleMiddleware('system_settings:edit_about'), 
  systemController.updateAbout
);

router.put('/pages/contact', 
  authenticateToken, 
  roleMiddleware('system_settings:edit_contact'), 
  systemController.updateContact
);

router.put('/pages/privacy', 
  authenticateToken, 
  roleMiddleware('system_settings:edit_privacy'), 
  systemController.updatePrivacy
);

router.put('/pages/terms', 
  authenticateToken, 
  roleMiddleware('system_settings:edit_terms'), 
  systemController.updateTerms
);

// Sao lưu
router.post('/backup', 
  authenticateToken, 
  roleMiddleware('system_settings:backup'), 
  systemController.createBackup
);
```

### 2. Services
```javascript
// server/routes/serviceRoutes.js

// Danh mục dịch vụ
router.get('/categories', 
  authenticateToken, 
  roleMiddleware('services:view'), 
  serviceCategoryController.getCategories
);

router.post('/categories', 
  authenticateToken, 
  roleMiddleware('services:manage_categories'), 
  serviceCategoryController.createCategory
);

router.put('/categories/:id', 
  authenticateToken, 
  roleMiddleware('services:manage_categories'), 
  serviceCategoryController.updateCategory
);

router.delete('/categories/:id', 
  authenticateToken, 
  roleMiddleware('services:manage_categories'), 
  serviceCategoryController.deleteCategory
);
```

### 3. Consultation Pricing (MỚI)
```javascript
// server/routes/consultationPricingRoutes.js

const express = require('express');
const router = express.Router();
const consultationPricingController = require('../controllers/consultationPricingController');
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Lấy danh sách gói tư vấn (Public)
router.get('/', consultationPricingController.getPricingPackages);

// Lấy chi tiết gói (Public)
router.get('/:id', consultationPricingController.getPricingPackageById);

// QUẢN LÝ (Chỉ staff System)
router.post('/', 
  authenticateToken, 
  roleMiddleware('consultation_pricing:create'), 
  consultationPricingController.createPackage
);

router.put('/:id', 
  authenticateToken, 
  roleMiddleware('consultation_pricing:edit'), 
  consultationPricingController.updatePackage
);

router.delete('/:id', 
  authenticateToken, 
  roleMiddleware('consultation_pricing:delete'), 
  consultationPricingController.deletePackage
);

// Cập nhật giá (Chỉ Manager)
router.put('/:id/price', 
  authenticateToken, 
  roleMiddleware('consultation_pricing:set_price'), 
  consultationPricingController.updatePrice
);

module.exports = router;
```

---

## 🎯 WORKFLOW PHÂN QUYỀN

### Scenario 1: Phân quyền Staff IT sửa trang tĩnh

1. **Manager IT** vào trang Quản lý nhân sự
2. Chọn staff cần phân quyền
3. Mở modal phân quyền, vào tab "Cài đặt hệ thống"
4. Chọn các quyền:
   - ✅ Xem
   - ✅ Sửa Trang chủ
   - ✅ Sửa Giới thiệu
   - ❌ Sửa Chính sách (không cho)
   - ❌ Sao lưu (không cho)
5. Lưu → Backend cập nhật `permissions.system_settings = ['view', 'edit_homepage', 'edit_about']`

### Scenario 2: Phân quyền Staff IT quản lý dịch vụ

1. Manager IT chọn staff
2. Vào tab "Dịch vụ y tế"
3. Chọn quyền:
   - ✅ Xem
   - ✅ Tạo
   - ✅ Sửa
   - ❌ Xóa (không cho)
   - ❌ Quản lý danh mục (không cho)
4. Lưu → `permissions.services = ['view', 'create', 'edit']`

### Scenario 3: Phân quyền Staff IT quản lý gói tư vấn

1. Manager IT chọn staff
2. Vào tab "Gói tư vấn"
3. Chọn quyền:
   - ✅ Xem
   - ✅ Tạo
   - ✅ Sửa
   - ❌ Xóa (không cho)
   - ❌ Định giá (chỉ Manager)
4. Lưu → `permissions.consultation_pricing = ['view', 'create', 'edit']`

---

## 📝 CHECKLIST TRIỂN KHAI

### Frontend
- [x] Cập nhật `PERMISSION_GROUPS` trong `StaffManagementPage.js`
- [ ] Tạo component `StaticPageEditor` cho system settings
- [ ] Tạo trang quản lý gói tư vấn `/admin/consultation-pricing`
- [ ] Cập nhật sidebar menu cho IT department

### Backend
- [ ] Cập nhật `roleMiddleware.js` với cases mới
- [ ] Tạo `consultationPricingController.js`
- [ ] Tạo `consultationPricingRoutes.js`
- [ ] Cập nhật `systemController.js` với các hàm update pages
- [ ] Thêm routes vào `app.js`

### Database
- [ ] Thêm seed data cho `consultation_pricing` table (nếu chưa có)
- [ ] Cập nhật permissions mẫu cho staff IT trong seed

### Testing
- [ ] Test phân quyền từng trang tĩnh
- [ ] Test CRUD gói tư vấn
- [ ] Test phân quyền manage_categories
- [ ] Test set_price chỉ Manager được dùng

---

## 🚀 BƯỚC TIẾP THEO

1. **Tạo ConsultationPricingController** (backend)
2. **Tạo ConsultationPricingPage** (frontend)
3. **Cập nhật roleMiddleware** với các case mới
4. **Test phân quyền chi tiết**

Bạn muốn tôi bắt đầu từ bước nào?
