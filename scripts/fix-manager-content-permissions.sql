-- =====================================================
-- FIX PERMISSIONS CHO MANAGER CONTENT
-- =====================================================
-- Script này cấp FULL quyền articles cho Manager Content

-- 1. Kiểm tra Manager Content hiện tại
SELECT 
    s.id,
    s.code,
    s.department,
    s.rank,
    u.username,
    u.full_name,
    s.permissions
FROM staff s
JOIN users u ON s.user_id = u.id
WHERE s.department = 'content' AND s.rank = 'manager';

-- 2. Cấp FULL quyền articles cho Manager Content
UPDATE staff 
SET permissions = JSON_OBJECT(
  'articles', JSON_ARRAY(
    'view',           -- Xem bài viết (tất cả)
    'create',         -- Tạo bài viết
    'create_draft',   -- Tạo nháp
    'edit',           -- Sửa bài viết
    'delete',         -- Xóa bài viết
    'approve',        -- ✅ DUYỆT BÀI VIẾT
    'reject',         -- ✅ TỪ CHỐI BÀI VIẾT
    'suggest_medicine',   -- Đề xuất thuốc
    'approve_medicine',   -- ✅ DUYỆT ĐỀ XUẤT THUỐC
    'create_medicine',    -- ✅ TẠO THUỐC TRỰC TIẾP
    'suggest_disease',    -- Đề xuất bệnh lý
    'approve_disease',    -- ✅ DUYỆT ĐỀ XUẤT BỆNH LÝ
    'create_disease'      -- ✅ TẠO BỆNH LÝ TRỰC TIẾP
  )
)
WHERE department = 'content' AND rank = 'manager';

-- 3. Verify - Kiểm tra lại
SELECT 
    s.id,
    s.code,
    u.full_name,
    s.rank,
    JSON_EXTRACT(s.permissions, '$.articles') as articles_permissions
FROM staff s
JOIN users u ON s.user_id = u.id
WHERE s.department = 'content' AND s.rank = 'manager';

-- 4. QUAN TRỌNG: Kiểm tra user_id để gửi thông báo
-- Lấy danh sách user_id của Manager Content để gửi thông báo khi có bài mới
SELECT 
    s.id as staff_id,
    s.user_id,
    u.username,
    u.full_name,
    u.email
FROM staff s
JOIN users u ON s.user_id = u.id
WHERE s.department = 'content' 
  AND s.rank = 'manager'
  AND JSON_CONTAINS(s.permissions->'$.articles', '"approve"');
