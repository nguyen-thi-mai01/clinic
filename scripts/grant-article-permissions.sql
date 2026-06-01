-- SQL Script: Cấp quyền cho Staff Content
-- Chạy script này trong MySQL để cấp quyền đầy đủ cho nhân viên content

-- 1. Tìm staff content cần cấp quyền (thay <staff_id> bằng ID thực tế)
SELECT id, code, department, rank, permissions 
FROM staff 
WHERE department = 'content';

-- 2. Cấp quyền cho Manager Content (có thể tạo/duyệt thuốc/bệnh lý)
UPDATE staff 
SET permissions = JSON_OBJECT(
  'articles', JSON_ARRAY('view', 'create', 'create_draft', 'edit', 'delete', 'approve', 'reject', 'suggest_medicine', 'approve_medicine', 'create_medicine', 'suggest_disease', 'approve_disease', 'create_disease')
)
WHERE department = 'content' AND rank = 'manager';

-- 3. Cấp quyền cho Staff Content thường (chỉ đề xuất, không duyệt)
UPDATE staff 
SET permissions = JSON_OBJECT(
  'articles', JSON_ARRAY('view', 'create', 'create_draft', 'edit', 'suggest_medicine', 'suggest_disease')
)
WHERE department = 'content' AND rank = 'staff';

-- 4. Kiểm tra lại
SELECT id, code, department, rank, 
       JSON_EXTRACT(permissions, '$.articles') as articles_permissions
FROM staff 
WHERE department = 'content';

-- 5. Nếu muốn cấp quyền cho 1 staff cụ thể (thay <staff_id>)
UPDATE staff 
SET permissions = JSON_OBJECT(
  'articles', JSON_ARRAY('view', 'create', 'create_draft', 'edit', 'suggest_medicine', 'suggest_disease')
)
WHERE id = <staff_id>;
