-- ============================================================
-- TEST & VERIFY NOTIFICATION SYSTEM FOR MANAGER CONTENT
-- ============================================================
-- Mục đích: Kiểm tra xem Manager Content có nhận được thông báo
--           khi Staff gửi bài viết chờ phê duyệt hay không
--
-- Cách sử dụng:
-- 1. Chạy script này TRƯỚC khi test
-- 2. Đăng nhập với Staff Content, tạo bài viết và gửi phê duyệt
-- 3. Chạy lại script này để xem thông báo mới
-- 4. Đăng nhập với Manager Content để xem thông báo trong UI
-- ============================================================

-- STEP 1: Kiểm tra Manager Content hiện có
SELECT 
    u.id AS user_id,
    u.email,
    u.full_name,
    u.role,
    s.department,
    s.rank,
    s.permissions
FROM users u
INNER JOIN staff s ON u.id = s.user_id
WHERE s.department = 'content' AND s.rank = 'manager';

-- EXPECTED: Có ít nhất 1 user với:
--   - role = 'staff'
--   - department = 'content'
--   - rank = 'manager'
--   - permissions JSON có articles: ['view', 'create', 'approve', ...]

-- ============================================================

-- STEP 2: Kiểm tra thông báo gần đây cho Manager Content
SELECT 
    n.id,
    n.user_id,
    u.full_name AS recipient_name,
    n.type,
    n.message,
    n.link,
    n.is_read,
    n.created_at,
    TIMESTAMPDIFF(MINUTE, n.created_at, NOW()) AS minutes_ago
FROM notifications n
INNER JOIN users u ON n.user_id = u.id
INNER JOIN staff s ON u.id = s.user_id
WHERE 
    s.department = 'content' 
    AND s.rank = 'manager'
    AND n.type = 'article'
    AND n.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY n.created_at DESC;

-- EXPECTED: Nếu vừa có Staff tạo bài viết, phải thấy notification mới
--           với message kiểu: "[Tên Staff] đã gửi bài viết mới "..." chờ phê duyệt"

-- ============================================================

-- STEP 3: So sánh thông báo của Admin vs Manager Content (1 giờ qua)
SELECT 
    'Admin' AS recipient_type,
    COUNT(*) AS notification_count,
    GROUP_CONCAT(DISTINCT u.full_name SEPARATOR ', ') AS recipients
FROM notifications n
INNER JOIN users u ON n.user_id = u.id
WHERE 
    u.role = 'admin'
    AND n.type = 'article'
    AND n.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)

UNION ALL

SELECT 
    'Manager Content' AS recipient_type,
    COUNT(*) AS notification_count,
    GROUP_CONCAT(DISTINCT u.full_name SEPARATOR ', ') AS recipients
FROM notifications n
INNER JOIN users u ON n.user_id = u.id
INNER JOIN staff s ON u.id = s.user_id
WHERE 
    s.department = 'content'
    AND s.rank = 'manager'
    AND n.type = 'article'
    AND n.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- EXPECTED: Nếu có bài viết mới gửi phê duyệt:
--   - Admin: 1-N notifications (tùy số lượng admin)
--   - Manager Content: 1-N notifications (tùy số lượng manager)
-- CẢNH BÁO: Nếu Manager Content = 0 mà Admin > 0 → HỆ THỐNG LỖI!

-- ============================================================

-- STEP 4: Kiểm tra staff có quyền 'approve' (ngoài Manager Content)
SELECT 
    u.id AS user_id,
    u.email,
    u.full_name,
    s.department,
    s.rank,
    JSON_EXTRACT(s.permissions, '$.articles') AS article_permissions
FROM users u
INNER JOIN staff s ON u.id = s.user_id
WHERE 
    JSON_CONTAINS(s.permissions, '"approve"', '$.articles')
    AND u.role = 'staff';

-- EXPECTED: Manager Content + có thể có staff khác được cấp quyền approve
--   - Tất cả users này phải nhận thông báo khi có bài viết pending

-- ============================================================

-- STEP 5: Thống kê tất cả thông báo article trong 24h
SELECT 
    DATE_FORMAT(n.created_at, '%H:%i') AS time,
    u.full_name AS recipient,
    u.role,
    s.department,
    s.rank,
    n.message,
    n.is_read
FROM notifications n
INNER JOIN users u ON n.user_id = u.id
LEFT JOIN staff s ON u.id = s.user_id
WHERE 
    n.type = 'article'
    AND n.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY n.created_at DESC;

-- EXPECTED: Mỗi lần Staff gửi bài viết:
--   - Notification cho Admin (role='admin')
--   - Notification cho Manager Content (department='content', rank='manager')
--   - Notification cho staff khác có quyền 'approve'

-- ============================================================

-- STEP 6: Test bằng cách insert notification thủ công (OPTIONAL - chỉ để test)
-- UNCOMMENT để chạy:

-- INSERT INTO notifications (user_id, type, message, link, is_read, created_at)
-- SELECT 
--     u.id,
--     'article' AS type,
--     'TEST: Bài viết mới chờ phê duyệt' AS message,
--     '/phe-duyet-bai-viet/999' AS link,
--     false AS is_read,
--     NOW() AS created_at
-- FROM users u
-- INNER JOIN staff s ON u.id = s.user_id
-- WHERE s.department = 'content' AND s.rank = 'manager';

-- Sau khi insert, đăng nhập với Manager Content để xem có thấy notification không

-- ============================================================

-- TROUBLESHOOTING GUIDE
-- ============================================================
-- 
-- PROBLEM 1: Manager Content không thấy trong STEP 1
-- SOLUTION: Chạy fix-manager-content-permissions.sql trước
--
-- PROBLEM 2: STEP 2 không có notification mới cho Manager
-- SOLUTION: 
--   a) Kiểm tra server logs xem có gọi notifyManagersAndAdmins() không
--   b) Kiểm tra articleController.js đã thay notifyAllAdmins → notifyManagersAndAdmins
--   c) Restart server sau khi sửa code
--
-- PROBLEM 3: STEP 3 cho thấy Admin có notification nhưng Manager không có
-- SOLUTION: 
--   - Code cũ chỉ gọi notifyAllAdmins() (chỉ gửi cho admin)
--   - Phải update code thành notifyManagersAndAdmins()
--   - Kiểm tra file: server/controllers/articleController.js line ~936, ~1086, ~1605
--
-- PROBLEM 4: Manager Content đã có trong DB nhưng không nhận notification
-- SOLUTION:
--   - Kiểm tra permissions có đầy đủ không (phải có 'approve')
--   - Kiểm tra function notifyManagersAndAdmins() có bug không
--   - Check console.log trong server khi tạo bài viết
--
-- ============================================================
