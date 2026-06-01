// server/middleware/roleMiddleware.js
const { models } = require('../config/db');

/**
 * ============================================
 * MA TRẬN PHÂN QUYỀN CHI TIẾT
 * ============================================
 * 
 * ROLE: ADMIN
 * - Truy cập: TẤT CẢ trang
 * - Quyền: Toàn quyền quản lý hệ thống
 * 
 * ROLE: DOCTOR (Bác sĩ)
 * - Truy cập:
 *   ✅ Lịch hẹn của mình (/appointments/doctor/my-appointments)
 *   ✅ Tư vấn của mình (/consultations/my-consultations)
 *   ✅ Hồ sơ bệnh nhân được phân công
 *   ✅ Viết/sửa bài viết y khoa (phải chờ duyệt)
 *   ✅ Trả lời câu hỏi diễn đàn
 * - KHÔNG truy cập:
 *   ❌ Quản lý nhân sự (/staff)
 *   ❌ Quản lý bác sĩ khác (/doctors/all)
 *   ❌ Thanh toán (/payments)
 *   ❌ Thống kê hệ thống (/statistics)
 *   ❌ Cài đặt hệ thống (/system-settings)
 * 
 * ROLE: PATIENT (Bệnh nhân)
 * - Truy cập:
 *   ✅ Đặt lịch hẹn (/appointments/create)
 *   ✅ Xem lịch hẹn của mình (/appointments/my-appointments)
 *   ✅ Thanh toán của mình (/payments/my-payments)
 *   ✅ Hồ sơ y tế của mình (/medical-records/my-records)
 *   ✅ Tư vấn trực tuyến (/consultations)
 *   ✅ Đọc bài viết, diễn đàn
 * - KHÔNG truy cập:
 *   ❌ TẤT CẢ trang quản trị
 *   ❌ Xem hồ sơ bệnh nhân khác
 * 
 * ROLE: STAFF (Nhân viên) - Phụ thuộc DEPARTMENT
 * 
 *   A. CLINICAL (Vận hành Lâm sàng):
 *      ✅ Quản lý lịch hẹn (/appointments/admin/all)
 *      ✅ Phân công bác sĩ
 *      ✅ Quản lý lịch làm việc bác sĩ
 *      ❌ Thanh toán, thống kê, cài đặt hệ thống
 * 
 *   B. SYSTEM (Hệ thống & IT):
 *      ✅ Cài đặt hệ thống (/system-settings)
 *      ✅ Quản lý dịch vụ, chuyên khoa
 *      ✅ Backup, bảo mật
 *      ❌ Thanh toán, nội dung
 * 
 *   C. SUPPORT (Chăm sóc Khách hàng):
 *      ✅ Quản lý tư vấn (/consultations/admin)
 *      ✅ Trả lời câu hỏi diễn đàn
 *      ✅ Xem lịch hẹn (chỉ đọc)
 *      ❌ Thanh toán, cài đặt hệ thống
 * 
 *   D. FINANCE (Tài chính Kế toán):
 *      ✅ Quản lý thanh toán (/payments)
 *      ✅ Xác minh, hoàn tiền
 *      ✅ Báo cáo doanh thu
 *      ✅ Xem lịch hẹn (để đối chiếu)
 *      ❌ Cài đặt hệ thống, nội dung
 * 
 *   E. CONTENT (Nội dung & Marketing):
 *      ✅ Quản lý bài viết (/articles/admin)
 *      ✅ Duyệt bài viết bác sĩ
 *      ✅ Quản lý diễn đàn
 *      ❌ Thanh toán, lịch hẹn, cài đặt hệ thống
 */

const roleMiddleware = (requiredPermission = null, allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      // 1. Kiểm tra Authentication
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
      }

      const user = req.user;

      // 2. ADMIN - Toàn quyền
      if (user.role === 'admin') {
        return next();
      }

      // 2b. MANAGER CSKH/CONTENT - Toàn quyền forum như admin
      if (
        user.role === 'staff' &&
        user.department &&
        user.rank === 'manager' &&
        (user.department === 'support' || user.department === 'content') &&
        requiredPermission === 'SUPPORT_FORUM'
      ) {
        return next();
      }

      // 3. Kiểm tra Role cơ bản (fallback cho các route đơn giản)
      // 3. Kiểm tra Role cơ bản (fallback cho các route đơn giản)
      // SỬA: Nếu requiredPermission trùng với role của user thì cho qua luôn
      if (requiredPermission && requiredPermission === user.role) {
          return next();
      }

      // Logic cũ giữ nguyên
      if (allowedRoles.length > 0 && !requiredPermission) {
        if (!allowedRoles.includes(user.role)) {
          return res.status(403).json({ 
            success: false, 
            message: 'Không có quyền truy cập.',
            requiredRoles: allowedRoles,
            yourRole: user.role
          });
        }
        return next();
      }

      // 4. KIỂM TRA QUYỀN CHI TIẾT CHO STAFF
      if (user.role === 'staff' && requiredPermission) {
        const staffProfile = await models.Staff.findOne({ 
          where: { user_id: user.id } 
        });

        if (!staffProfile) {
          return res.status(403).json({ 
            success: false, 
            message: 'Không tìm thấy hồ sơ nhân viên.' 
          });
        }

        const { department, rank, permissions } = staffProfile;
        let hasPermission = false;

        const checkGenericModuleAction = (permissionCode) => {
          if (!permissionCode || typeof permissionCode !== 'string' || !permissionCode.includes(':')) {
            return false;
          }

          const [moduleKey, actionKey] = permissionCode.split(':');
          if (!moduleKey || !actionKey || !permissions || typeof permissions !== 'object') {
            return false;
          }

          const modulePermissions = permissions[moduleKey];
          if (modulePermissions === true) {
            return true;
          }

          if (Array.isArray(modulePermissions)) {
            return modulePermissions.includes(actionKey);
          }

          if (modulePermissions && typeof modulePermissions === 'object') {
            return modulePermissions[actionKey] === true;
          }

          return false;
        };

        if (checkGenericModuleAction(requiredPermission)) {
          return next();
        }

        // === MA TRẬN PHÂN QUYỀN THEO PERMISSION CODE ===
        
        switch (requiredPermission) {
          // --- WORK_SHIFT GRANULAR PERMISSIONS ---
          case 'work_shift:approve_shift':
            if (permissions && permissions.work_shift && permissions.work_shift.includes('approve_shift')) {
              hasPermission = true;
            }
            break;
          case 'work_shift:approve_leave':
            if (permissions && permissions.work_shift && permissions.work_shift.includes('approve_leave')) {
              hasPermission = true;
            }
            break;
          case 'work_shift:approve_overtime':
            if (permissions && permissions.work_shift && permissions.work_shift.includes('approve_overtime')) {
              hasPermission = true;
            }
            break;
          case 'work_shift:register_shift':
            if (permissions && permissions.work_shift && permissions.work_shift.includes('register_shift')) {
              hasPermission = true;
            }
            break;
          case 'work_shift:register_leave':
            if (permissions && permissions.work_shift && permissions.work_shift.includes('register_leave')) {
              hasPermission = true;
            }
            break;
          case 'work_shift:register_overtime':
            if (permissions && permissions.work_shift && permissions.work_shift.includes('register_overtime')) {
              hasPermission = true;
            }
            break;

            case 'marketing:manage_events':
            if (permissions && permissions.marketing && permissions.marketing.includes('manage_events')) {
              hasPermission = true;
            }
            break;
          case 'marketing:manage_promotions':
            if (permissions && permissions.marketing && permissions.marketing.includes('manage_promotions')) {
              hasPermission = true;
            }
            break;
          // server/middleware/roleMiddleware.js — trong switch(requiredPermission)
          // --- CLINICAL SPECIFIC ---
          case 'clinical:register_for_doctor':
            if (department === 'clinical' && permissions?.schedule?.includes('register_for_doctor')) {
              hasPermission = true;
            }
            break;
          case 'clinical:approve_appointment':
            if (department === 'clinical' && (
              permissions?.appointments?.includes('approve') || rank === 'manager'
            )) {
              hasPermission = true;
            }
            break;
          case 'medical_records:edit_vitals':
            // Trợ lý được nhập chỉ số sinh tồn, không được xác nhận kết luận
            if (department === 'clinical' && permissions?.medical_records?.includes('edit_vitals')) {
              hasPermission = true;
            }
            break;
          case 'medical_records:conclude':
            // CHỈ doctor hoặc clinical manager mới được xác nhận kết luận
            hasPermission = false; // Staff clinical KHÔNG được phép
            break;
          
          // --- BẮT ĐẦU SỬA: ĐỒNG BỘ QUYỀN GIÁM SÁT TƯ VẤN ---
          case 'consultation_realtime:monitor':
            // Doctor luôn được xem sự cố của phiên mình
            if (user.role === 'doctor') {
              hasPermission = true;
              break;
            }
            if (
              (permissions?.consultation_realtime && permissions.consultation_realtime.includes('monitor')) ||
              (permissions?.consultations && permissions.consultations.includes('monitor'))
            ) {
              hasPermission = true;
            }
            break;

          case 'consultation_realtime:resolve_errors':
            // Cho phép xử lý sự cố nếu có quyền hệ thống HOẶC quyền đóng tư vấn của Lâm sàng
            if (
              (permissions?.consultation_realtime && permissions.consultation_realtime.includes('resolve_errors')) ||
              (permissions?.consultations && permissions.consultations.includes('close'))
            ) {
              hasPermission = true;
            }
            break;
          // --- KẾT THÚC SỬA ---

          case 'SUPPORT_FORUM':
            // Cho phép nhân viên đi qua cổng nếu có ít nhất 1 quyền thao tác trong module diễn đàn
            if (permissions && permissions.forum && Array.isArray(permissions.forum) && permissions.forum.length > 0) {
              hasPermission = true;
            }
            break;

          // --- FALLBACK: Check JSON permissions field ---
          // --- COMMUNITY GROUP PERMISSIONS ---
          case 'community:create_group':
            // Chỉ doctor, staff, admin — patient KHÔNG được tạo nhóm
            if (user.role === 'doctor' || user.role === 'admin') {
              hasPermission = true;
            } else if (department && ['content', 'support', 'clinical', 'system', 'finance'].includes(department)) {
              hasPermission = true;
            }
            break;
          case 'community:manage_group':
            // Owner/mod được xử lý ở controller, đây là fallback cho staff/admin
            if (user.role === 'admin') {
              hasPermission = true;
            } else if (department && (department === 'content' || department === 'support') && rank === 'manager') {
              hasPermission = true;
            }
            break;
          case 'community:moderate_post':
            if (user.role === 'admin' || user.role === 'doctor') {
              hasPermission = true;
            } else if (department && (department === 'content' || department === 'support')) {
              hasPermission = true;
            }
            break;

          default:
            if (permissions && typeof permissions === 'object') {
              const [module, action] = requiredPermission.split(':');
              if (module === 'articles' && department === 'content' && rank === 'manager') {
                hasPermission = true;
              } else if (permissions[module]) {
                if (Array.isArray(permissions[module])) {
                  hasPermission = permissions[module].includes(action);
                } else if (permissions[module] === true) {
                  hasPermission = true;
                }
              }
            }
            break;
        }

        if (!hasPermission) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không có quyền thực hiện chức năng này.',
            details: {
              required: requiredPermission,
              yourDepartment: department,
              yourRank: rank
            }
          });
        }

        req.staffProfile = staffProfile;
        return next();
      }

      // 4.5. KIỂM TRA QUYỀN ĐẶC QUYỀN CỦA BÁC SĨ (Viết bài/Sửa bài/Duyệt bài/Đề xuất)
      if (user.role === 'doctor' && requiredPermission) {
        // First: check if doctor has Staff record with explicit permissions
        const doctorStaff = await models.Staff.findOne({ where: { user_id: user.id } });
        if (doctorStaff && doctorStaff.permissions) {
          const [module, action] = requiredPermission.split(':');
          if (module === 'articles' && doctorStaff.permissions.articles) {
            if (Array.isArray(doctorStaff.permissions.articles) && doctorStaff.permissions.articles.includes(action)) {
              return next();
            }
          }
        }

        // Fallback: check hardcoded doctor permissions
        const doctorAllowedPermissions = [
          'articles:view',         // Quyền xem danh sách bài viết
          'articles:create',       // Quyền gửi bài viết mới
          'articles:edit',         // Quyền sửa bài viết của mình
          'articles:delete',       // Quyền xóa bài nháp của mình
          'articles:create_draft', // Quyền tạo đề xuất nháp
          'articles:approve',      // Quyền duyệt bài viết/đề xuất
          'articles:approve_medicine',  // Quyền duyệt đề xuất thuốc
          'articles:approve_disease'    // Quyền duyệt đề xuất bệnh lý
        ];
        
        if (doctorAllowedPermissions.includes(requiredPermission)) {
          return next();
        }
      }

      // 5. DOCTOR và PATIENT - Check allowedRoles HOẶC requiredPermission
      if (allowedRoles.includes(user.role) || requiredPermission === user.role) {
        return next();
      }

      // 6. Từ chối truy cập nếu không match
      return res.status(403).json({ 
        success: false, 
        message: 'Quyền hạn không hợp lệ.',
        yourRole: user.role,
        requiredPermission: requiredPermission,
        allowedRoles: allowedRoles
      });

    } catch (error) {
      console.error('ERROR roleMiddleware:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Lỗi kiểm tra quyền.' 
      });
    }
  };
};

module.exports = roleMiddleware;
