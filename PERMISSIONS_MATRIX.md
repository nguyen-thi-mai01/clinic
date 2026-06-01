# MA TRẬN PHÂN QUYỀN HỆ THỐNG

##  Tổng quan

Hệ thống có 4 role chính: **Admin**, **Doctor**, **Patient**, **Staff** (chia thành 5 departments)

---

##  CHI TIẾT PHÂN QUYỀN

### 1. ADMIN (Quản trị viên)

**Quyền truy cập:**  **TOÀN BỘ HỆ THỐNG**

-  Quản lý người dùng (tạo, sửa, xóa, khóa tài khoản)
-  Quản lý nhân viên, bác sĩ, bệnh nhân
-  Cài đặt hệ thống
-  Xem tất cả thống kê, báo cáo
-  Quản lý thanh toán, hoàn tiền
-  Quản lý nội dung, duyệt bài viết
-  Toàn quyền với tất cả module

**Routes không giới hạn**

---

### 2. DOCTOR (Bác sĩ)

####  **Được phép truy cập:**

| Module | Routes | Mô tả |
|--------|--------|-------|
| **Lịch hẹn** | `GET /appointments/doctor/my-appointments` | Xem lịch hẹn được phân công |
| **Tư vấn** | `GET /consultations/my-consultations` | Xem tư vấn của mình |
| **Hồ sơ bệnh nhân** | `GET /medical-records/:id` | Xem hồ sơ bệnh nhân được phân công |
| | `POST /medical-records` | Tạo hồ sơ y tế sau khám |
| | `PUT /medical-records/:id` | Cập nhật hồ sơ |
| **Bài viết y khoa** | `POST /articles` | Viết bài (trạng thái: `draft`, chờ admin duyệt) |
| | `PUT /articles/:id` | Sửa bài của mình |
| | `GET /articles/my-articles` | Xem bài viết của mình |
| **Diễn đàn** | `POST /forum/questions/:id/answers` | Trả lời câu hỏi |
| | `PUT /forum/answers/:id/verify` | Xác thực câu trả lời |
| | `PUT /forum/answers/:id/pin` | Ghim câu trả lời |
| **Lịch làm việc** | `GET /schedules/my-schedules` | Xem lịch làm việc của mình |
| | `PUT /schedules/:id` | Cập nhật trạng thái ca làm |

####  **KHÔNG được phép:**

-  Quản lý nhân viên (`/staff`)
-  Quản lý bác sĩ khác (`/doctors/all`)
-  Xem tất cả lịch hẹn (`/appointments/admin/all`)
-  Quản lý thanh toán (`/payments/all`)
-  Thống kê hệ thống (`/statistics`)
-  Cài đặt hệ thống (`/system-settings`)
-  Duyệt bài viết (`/articles/approve`)
-  Xem doanh thu (`/payments/statistics/revenue`)

**Lý do:** Bác sĩ chỉ tập trung vào công việc chuyên môn, không tham gia quản trị hệ thống.

---

### 3. PATIENT (Bệnh nhân)

####  **Được phép truy cập:**

| Module | Routes | Mô tả |
|--------|--------|-------|
| **Lịch hẹn** | `POST /appointments` | Đặt lịch hẹn |
| | `GET /appointments/my-appointments` | Xem lịch hẹn của mình |
| | `PUT /appointments/:id/cancel` | Hủy lịch hẹn |
| **Thanh toán** | `POST /payments/create` | Tạo thanh toán |
| | `GET /payments/my-payments` | Xem thanh toán của mình |
| | `GET /payments/:id/check-status` | Kiểm tra trạng thái |
| **Hồ sơ y tế** | `GET /medical-records/my-records` | Xem hồ sơ y tế của mình |
| **Tư vấn** | `POST /consultations` | Tạo yêu cầu tư vấn |
| | `GET /consultations/my-consultations` | Xem tư vấn của mình |
| **Diễn đàn** | `POST /forum/questions` | Đặt câu hỏi |
| | `GET /forum/questions` | Xem câu hỏi |
| | `PUT /forum/answers/:id/vote` | Vote câu trả lời |
| **Bài viết** | `GET /articles` | Đọc bài viết y khoa (công khai) |

####  **KHÔNG được phép:**

-  **TẤT CẢ trang quản trị** (routes có `/admin`, `/staff`, `/doctor`)
-  Xem hồ sơ bệnh nhân khác
-  Xem lịch hẹn của người khác
-  Xác minh thanh toán

**Lý do:** Bảo mật thông tin cá nhân, bệnh nhân chỉ quản lý dữ liệu của chính mình.

---

### 4. STAFF (Nhân viên) - Phụ thuộc DEPARTMENT

Staff được phân quyền theo **5 phòng ban**:

---

#### A. 🏥 **CLINICAL (Vận hành Lâm sàng)**

**Vai trò:** Điều phối lịch hẹn, phân công bác sĩ

| Permission Code | Routes | Quyền |
|----------------|--------|-------|
| `CLINICAL_ACCESS` | `GET /appointments/admin/all` |  Xem tất cả lịch hẹn |
| | `GET /appointments/staff/managed` |  Xem lịch của bác sĩ được quản lý |
| `CLINICAL_ASSIGN_DOCTORS` | `PUT /staff/:id/assign-doctors` |  Phân công bác sĩ |
| | `GET /schedules` |  Xem lịch làm việc bác sĩ |
| | `POST /schedules` |  Tạo ca làm việc |
| `CLINICAL_MANAGE_ALL` | `PUT /appointments/:id/status` |  Duyệt/từ chối lịch hẹn (chỉ Manager) |

**Không được:**
-  Thanh toán (`/payments`)
-  Cài đặt hệ thống (`/system-settings`)
-  Quản lý bài viết (`/articles/admin`)

---

#### B. 💻 **SYSTEM (Hệ thống & IT)**

**Vai trò:** Cấu hình hệ thống, quản lý dịch vụ

| Permission Code | Routes | Quyền |
|----------------|--------|-------|
| `SYSTEM_CONFIG` | `GET /system-settings` |  Xem cài đặt |
| | `PUT /system-settings/:page` |  Cập nhật cài đặt |
| `SYSTEM_MANAGE_SERVICES` | `GET /services` |  Quản lý dịch vụ |
| | `POST /services` |  Tạo dịch vụ |
| | `PUT /services/:id` |  Sửa dịch vụ |
| | `DELETE /services/:id` |  Xóa dịch vụ |
| | `GET /specialties` |  Quản lý chuyên khoa |
| | `POST /specialties` |  Tạo chuyên khoa |

**Không được:**
-  Thanh toán (`/payments`)
-  Lịch hẹn (`/appointments`)
-  Nội dung (`/articles`)

---

#### C. 💬 **SUPPORT (Chăm sóc Khách hàng)**

**Vai trò:** Hỗ trợ tư vấn, diễn đàn

| Permission Code | Routes | Quyền |
|----------------|--------|-------|
| `SUPPORT_CONSULTATIONS` | `GET /consultations/admin/all` |  Xem tất cả tư vấn |
| | `PUT /consultations/:id/status` |  Cập nhật trạng thái tư vấn |
| `SUPPORT_FORUM` | `GET /forum/questions` |  Quản lý diễn đàn |
| | `PUT /forum/questions/:id/status` |  Duyệt/ẩn câu hỏi |
| | `DELETE /forum/questions/:id` |  Xóa câu hỏi vi phạm |
| | `DELETE /forum/answers/:id` |  Xóa câu trả lời |
| | `GET /forum/reports` |  Xem báo cáo vi phạm |
| **Read-only** | `GET /appointments/admin/all` |  Xem lịch hẹn (chỉ đọc) |

**Không được:**
-  Thanh toán (`/payments`)
-  Cài đặt hệ thống (`/system-settings`)
-  Phân công bác sĩ

---

#### D. 💰 **FINANCE (Tài chính Kế toán)**

**Vai trò:** Quản lý thanh toán, doanh thu

| Permission Code | Routes | Quyền |
|----------------|--------|-------|
| `FINANCE_VIEW_PAYMENTS` | `GET /payments/all` |  Xem tất cả thanh toán |
| `FINANCE_VERIFY` | `PUT /payments/:id/confirm` |  Xác nhận thanh toán (Manager) |
| | `PUT /payments/:id/reject` |  Từ chối thanh toán (Manager) |
| `FINANCE_REFUND` | `GET /payments/refunds` |  Xem yêu cầu hoàn tiền |
| | `PUT /payments/:id/refund` |  Hoàn tiền (Manager) |
| `FINANCE_REPORTS` | `GET /payments/statistics/revenue` |  Báo cáo doanh thu |
| | `GET /statistics/revenue` |  Thống kê tài chính |
| **Read-only** | `GET /appointments/admin/all` |  Xem lịch hẹn (để đối chiếu) |

**Không được:**
-  Cài đặt hệ thống (`/system-settings`)
-  Quản lý nội dung (`/articles`)
-  Phân công bác sĩ

---

#### E. 💊 **PHARMACY (Kho thuốc & Bán thuốc)**

**Vai trò:** Quản lý tồn kho thuốc, nhập kho theo lô, bán lẻ và bán theo đơn

| Permission Code | Routes | Quyền |
|----------------|--------|-------|
| `PHARMACY_VIEW` | `GET /pharmacy/stock` | Xem tồn kho thuốc |
| | `GET /pharmacy/medicines` | Tìm thuốc để bán / nhập kho |
| | `GET /pharmacy/stock/:id/batches` | Xem chi tiết lô thuốc |
| `PHARMACY_IMPORT` | `POST /pharmacy/stock/import` | Nhập kho thuốc theo lô |
| `PHARMACY_EXPORT_RETAIL` | `POST /pharmacy/retail` | Bán lẻ thuốc cho khách |
| `PHARMACY_EXPORT_PRESCRIPTION` | `POST /pharmacy/sell-prescription` | Xuất thuốc theo đơn đã lưu |
| `PHARMACY_TRANSACTIONS` | `GET /pharmacy/stock/transactions` | Xem lịch sử nhập xuất |
| `PHARMACY_ALERTS` | `GET /pharmacy/stock/alerts` | Xem cảnh báo hết hàng / tồn thấp / sắp hết hạn |
| `PHARMACY_SUPPLIERS` | `GET /pharmacy/suppliers` | Quản lý nhà cung cấp |
| | `POST /pharmacy/suppliers` | Thêm nhà cung cấp |
| | `PUT /pharmacy/suppliers/:id` | Sửa nhà cung cấp |
| | `DELETE /pharmacy/suppliers/:id` | Xóa nhà cung cấp |
| `PHARMACY_ADJUST` | `POST /pharmacy/stock/adjust` | Điều chỉnh tồn kho sau kiểm kê |

**Không được:**
-  Cài đặt hệ thống (`/system-settings`)
-  Quản lý nội dung (`/articles`)
-  Phân công bác sĩ

---

#### F. ✍️ **CONTENT (Nội dung & Marketing)**

**Vai trò:** Quản lý bài viết, diễn đàn

| Permission Code | Routes | Quyền |
|----------------|--------|-------|
| `CONTENT_MANAGE_ARTICLES` | `GET /articles/admin/all` |  Xem tất cả bài viết |
| | `POST /articles` |  Tạo bài viết |
| | `PUT /articles/:id` |  Sửa bài viết |
| `CONTENT_APPROVE` | `PUT /articles/:id/approve` |  Duyệt bài (Manager) |
| | `PUT /articles/:id/reject` |  Từ chối bài (Manager) |
| `SUPPORT_FORUM` | `GET /forum/questions` |  Quản lý diễn đàn |
| | `PUT /forum/questions/:id/status` |  Kiểm duyệt câu hỏi |
| **Medicines/Diseases** | `GET /articles/medicines` |  Quản lý thuốc/bệnh |
| | `POST /articles/medicines` |  Thêm thuốc |
| | `POST /articles/diseases` |  Thêm bệnh |

**Không được:**
-  Thanh toán (`/payments`)
-  Lịch hẹn (`/appointments`)
-  Cài đặt hệ thống (`/system-settings`)

---

## 📊 BẢNG TỔNG KẾT

| Module | Admin | Doctor | Patient | Clinical | System | Support | Finance | Content |
|--------|-------|--------|---------|----------|--------|---------|---------|---------|
| **Quản lý Users** |  |  |  |  |  |  |  |  |
| **Lịch hẹn (Tất cả)** |  |  |  |  |  | 👁️ | 👁️ |  |
| **Lịch hẹn (Của mình)** |  |  |  |  |  |  |  |  |
| **Thanh toán** |  |  | 👤 |  |  |  |  |  |
| **Hồ sơ Y tế** |  | 👥 | 👤 |  |  |  |  |  |
| **Cài đặt Hệ thống** |  |  |  |  |  |  |  |  |
| **Dịch vụ/Chuyên khoa** |  |  |  |  |  |  |  |  |
| **Bài viết (Duyệt)** |  |  |  |  |  |  |  |  |
| **Bài viết (Viết)** |  |  |  |  |  |  |  |  |
| **Diễn đàn (Quản lý)** |  |  |  |  |  |  |  |  |
| **Diễn đàn (Trả lời)** |  |  |  |  |  |  |  |  |
| **Tư vấn trực tuyến** |  |  |  |  |  |  |  |  |
| **Kho thuốc** |  |  |  |  |  |  |  |  |
| **Phân công Bác sĩ** |  |  |  |  |  |  |  |  |
| **Thống kê/Báo cáo** |  |  |  |  |  |  |  |  |

**Ký hiệu:**
-  Toàn quyền
- 👁️ Chỉ xem (Read-only)
- 👤 Chỉ của chính mình
- 👥 Chỉ bệnh nhân được phân công
-  Không được phép

---

## 🔒 LƯU Ý BẢO MẬT

### 1. Nguyên tắc Least Privilege
- Mỗi role chỉ có quyền **tối thiểu cần thiết** để thực hiện công việc
- Bác sĩ không thể xem thanh toán → Tránh xung đột lợi ích
- Bệnh nhân không thể xem dữ liệu người khác → Bảo mật HIPAA

### 2. Phân quyền Staff theo Department
- Clinical không được xem Finance → Tách biệt nhiệm vụ
- IT không được duyệt bài viết → Kiểm soát nội dung
- Finance không được sửa lịch hẹn → Minh bạch tài chính

### 3. Rank trong Department
- **Staff**: Nhân viên thường → Quyền hạn hạn chế
- **Manager**: Quản lý → Thêm quyền duyệt, xóa, xác minh

### 4. Kiểm tra 2 lớp
- **Layer 1**: roleMiddleware kiểm tra Permission Code
- **Layer 2**: Controller kiểm tra ownership (VD: bệnh nhân chỉ xem HSYT của mình)

---

## 🛠️ Cách sử dụng trong Routes

```javascript
// Ví dụ: Chỉ Clinical Staff mới được phân công bác sĩ
router.put('/staff/:id/assign-doctors',
  authenticateToken,
  roleMiddleware('CLINICAL_ASSIGN_DOCTORS', ['admin', 'staff']),
  staffController.assignDoctors
);

// Ví dụ: Chỉ Finance Manager mới được hoàn tiền
router.put('/payments/:id/refund',
  authenticateToken,
  roleMiddleware('FINANCE_REFUND', ['admin']),
  paymentController.refundPayment
);
```

---

## 📝 TODO: Cập nhật Routes

Cần review lại các routes sau để đảm bảo bảo mật:

1.  `/appointments/admin/all` - Đã giới hạn cho Clinical + Finance (read-only)
2.  `/payments/all` - Đã giới hạn cho Finance
3.  `/system-settings` - Đã giới hạn cho System
4. ⚠️ `/articles/approve` - Cần thêm `CONTENT_APPROVE`
5. ⚠️ `/forum/admin/*` - Cần thêm `SUPPORT_FORUM`

---

**Ngày cập nhật:** 2025-12-12  
**Version:** 1.0  
**Người tạo:** System Administrator
