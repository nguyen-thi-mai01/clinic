# 🔍 KIỂM TRA JWT TOKEN

## Bước 1: Mở Developer Tools

1. Mở trang web (đang đăng nhập)
2. Nhấn `F12` để mở Developer Tools
3. Chọn tab **Console**

## Bước 2: Kiểm tra token trong localStorage

Paste đoạn code này vào Console và nhấn Enter:

```javascript
// Lấy token từ localStorage
const token = localStorage.getItem('token');
console.log('🔑 Token:', token);

// Decode JWT token (không cần verify)
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

const payload = parseJwt(token);
console.log('📦 Token Payload:', payload);
console.log('🔐 Permissions:', payload.permissions);
console.log('🎯 Forum Permissions:', payload.permissions?.forum);
```

## Bước 3: Xem kết quả

Nếu thấy:
```javascript
🎯 Forum Permissions: undefined
// HOẶC
🎯 Forum Permissions: []
```

→ **Token cũ chưa có permissions forum!**

## Bước 4: Đăng xuất và đăng nhập lại

1. Nhấn nút **Đăng xuất** ở góc phải trên
2. Đăng nhập lại với tài khoản đã được cấp quyền
3. Chạy lại code ở Bước 2
4. Lần này sẽ thấy:
```javascript
🎯 Forum Permissions: ["create_topic", "edit_topic", "toggle_topic", "delete_topic", "assign_moderators"]
```

5. Vào trang **Quản lý diễn đàn** → Thành công! ✅

---

## 🚨 Nếu vẫn lỗi sau khi đăng nhập lại:

Có thể backend chưa gửi permissions trong token. Kiểm tra `authController.js`:

### Kiểm tra trong terminal backend:

Khi đăng nhập, bạn sẽ thấy log:
```
🔐 Login - Staff permissions: { forum: [...], articles: [...] }
```

Nếu KHÔNG thấy log này → Backend chưa query permissions khi tạo token.
