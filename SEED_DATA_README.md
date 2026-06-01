# 📋 HƯỚNG DẪN CẬP NHẬT DATABASE VÀ SEED DATA

## 🎯 Tổng quan các thay đổi

### 1. **Gói dịch vụ tư vấn (Consultation Pricing)**
- ✅ Thêm 11 gói dịch vụ từ miễn phí đến 200,000 VNĐ
- ✅ Gói miễn phí (0đ): Tự động chuyển trạng thái đã thanh toán
- ✅ Gói 50,000 VNĐ: Chat/Video/Offline cơ bản
- ✅ Gói 100,000 VNĐ: Nâng cao với kê đơn
- ✅ Gói 200,000 VNĐ: Premium với theo dõi

### 2. **Lịch làm việc tự động (Schedules)**
- ✅ Tạo lịch cho 7 ngày tiếp theo
- ✅ Ca sáng: 7:00 - 12:00
- ✅ Ca chiều: 13:00 - 20:00
- ✅ Tất cả bác sĩ đều có lịch

### 3. **Dữ liệu mẫu đa dạng**

#### **Appointments (20 mẫu)**
- Quá khứ: Completed/Cancelled
- Hôm nay: In-progress/Confirmed  
- Tương lai: Pending/Confirmed
- Các loại: Offline/Online/Emergency
- Payment: Unpaid/Paid/Refunded

#### **Consultations (25 mẫu)**
- Loại: Chat/Video/Offline
- Trạng thái: Pending → Completed/Cancelled
- Payment: Unpaid/Paid/Not_required/Refunded
- Kèm chat messages cho các cuộc tư vấn đang diễn ra

### 4. **Logic thanh toán miễn phí**
- Frontend: Tự động bỏ qua modal thanh toán khi gói = 0đ
- Backend: Set payment_status = 'not_required'
- Không tạo QR code, không cần xác nhận

## 🚀 CÁCH CHẠY

### **Cách 1: Chạy script tự động (Khuyến nghị)**
```batch
cd F:\VanLang\Nam3\HK2\_NCKH_\project\000\clinic-system-8\server
run-migrations.bat
```

### **Cách 2: Chạy từng lệnh**
```batch
# Bước 1: Chạy migrations
cd server
npx sequelize-cli db:migrate

# Bước 2: Khởi động server (seed data tự động chạy)
npm start
```

## 📊 Kết quả sau khi chạy

### **Database Tables Updated**
1. ✅ `consultation_pricing.doctor_codes` - JSON array
2. ✅ `payments.proof_image_url` - LONGTEXT (chứa base64)

### **Seed Data Created**
1. ✅ **11 gói dịch vụ tư vấn**
   - 2 gói miễn phí
   - 3 gói 50k
   - 2 gói 100k
   - 2 gói 200k
   - 1 gói tạm ngưng

2. ✅ **Lịch làm việc 7 ngày**
   - Tất cả bác sĩ
   - 2 ca/ngày (sáng + chiều)

3. ✅ **20 appointments đa dạng**
   - Quá khứ, hiện tại, tương lai
   - Đầy đủ trạng thái

4. ✅ **25 consultations đa dạng**
   - Chat/Video/Offline
   - Kèm chat messages
   - Mix payment statuses

## 🎯 Test các tính năng

### **Test 1: Đặt lịch tư vấn miễn phí**
1. Vào trang "Đặt lịch tư vấn"
2. Chọn gói miễn phí (0đ)
3. Điền thông tin và submit
4. ✅ **Kỳ vọng**: Tự động chuyển sang "Đã thanh toán", không qua trang payment

### **Test 2: Đặt lịch tư vấn có phí**
1. Chọn gói 50k/100k/200k
2. Điền thông tin
3. Chọn phương thức thanh toán
4. ✅ **Kỳ vọng**: Hiển thị QR code hoặc form thanh toán

### **Test 3: Quản lý gói dịch vụ (Admin)**
1. Vào trang quản lý gói tư vấn
2. Chọn bác sĩ theo chuyên khoa
3. Click "Chọn tất cả đã lọc"
4. ✅ **Kỳ vọng**: Chọn nhanh tất cả bác sĩ trong filter

### **Test 4: Lịch làm việc**
1. Chọn ngày đặt lịch
2. ✅ **Kỳ vọng**: Hiển thị slots từ 7h-12h và 13h-20h

### **Test 5: Upload ảnh biên lai**
1. Đặt lịch và chọn chuyển khoản
2. Upload ảnh biên lai
3. ✅ **Kỳ vọng**: Không lỗi "Data too long"

## 📝 Lưu ý quan trọng

### **Về Seed Data**
- ⚠️ Seed data chạy MỖI KHI khởi động server
- ⚠️ Không duplicate data (sử dụng `ignoreDuplicates: true`)
- ✅ Safe để restart server nhiều lần

### **Về Migrations**
- ⚠️ Chỉ cần chạy 1 lần
- ✅ Sequelize tự track đã chạy migration nào
- ✅ An toàn chạy nhiều lần (skip nếu đã có)

### **Về Database**
- 📦 2 migrations mới:
  - `20251212000004-add-doctor-codes-to-consultation-pricing.js`
  - `20251212000005-update-payment-proof-image-url.js`

## 🐛 Troubleshooting

### **Lỗi: "Data too long for column 'proof_image_url'"**
➡️ **Giải pháp**: Chạy migration 20251212000005

### **Lỗi: "Cannot find module './consultationPricingSeed'"**
➡️ **Giải pháp**: File đã tạo, restart terminal

### **Không thấy gói dịch vụ mới**
➡️ **Giải pháp**: Restart server để chạy seed

### **Lịch làm việc không hiển thị**
➡️ **Giải pháp**: Restart server để seed schedules

## ✅ Checklist hoàn thành

- [x] Tạo migration doctor_codes
- [x] Tạo migration proof_image_url
- [x] Tạo seed ConsultationPricing
- [x] Cập nhật seed Schedules (7 ngày, 2 ca)
- [x] Cập nhật seed Appointments (20 mẫu đa dạng)
- [x] Cập nhật seed Consultations (25 mẫu đa dạng)
- [x] Logic thanh toán miễn phí (Frontend)
- [x] Logic thanh toán miễn phí (Backend)
- [x] Tích hợp vào db.js

## 🎉 Hoàn tất!

Server đã sẵn sàng với:
- ✅ 11 gói dịch vụ tư vấn
- ✅ Lịch làm việc tự động 7 ngày
- ✅ 45 dữ liệu mẫu (20 appointments + 25 consultations)
- ✅ Thanh toán miễn phí tự động
- ✅ Upload ảnh biên lai không giới hạn
