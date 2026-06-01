// server/config/departmentsSeed.js

/**
 * Seed data cho phòng ban và phân quyền
 * Chạy sau khi đã có users và staff trong DB
 */

const { getPermissionsTemplate, mapLegacyPermissionsToCanonical } = require('./departmentPermissions');
const { getDepartmentRoleProfiles, getRoleProfile } = require('./departmentRoleProfiles');

const departmentsSeedData = [
  {
    code: 'clinical',
    name: 'Vận hành lâm sàng',
    description: 'Quản lý bác sĩ, lịch khám, cuộc hẹn và hoạt động lâm sàng',
    is_active: true
  },
  {
    code: 'system',
    name: 'Hệ thống & IT',
    description: 'Quản lý hệ thống, cấu hình, bảo mật và công nghệ',
    is_active: true
  },
  {
    code: 'support',
    name: 'Chăm sóc khách hàng',
    description: 'Hỗ trợ và chăm sóc khách hàng, giải đáp thắc mắc',
    is_active: true
  },
  {
    code: 'finance',
    name: 'Tài chính kế toán',
    description: 'Quản lý thanh toán, doanh thu, báo cáo tài chính',
    is_active: true
  },
  {
    code: 'content',
    name: 'Nội dung & Truyền thông',
    description: 'Quản lý bài viết, nội dung website và truyền thông',
    is_active: true
  }
];

/**
 * Cập nhật staff với department và permissions
 * Format: { username, department, rank, permissions }
 */
const staffDepartmentAssignments = [
  // CLINICAL DEPARTMENT
  {
    username: 'clinicmanager',
    department: 'clinical',
    rank: 'manager',
    job_description: 'Quản lý bác sĩ, lịch khám và hoạt động lâm sàng',
    permissions: null // Sẽ auto-fill từ template
  },
  {
    username: 'clinicstaff1',
    department: 'clinical',
    rank: 'staff',
    job_description: 'Quản lý bác sĩ, lịch khám và hồ sơ bệnh án',
    permissions: null
  },
  {
    username: 'clinicstaff2',
    department: 'clinical',
    rank: 'staff',
    job_description: 'Quản lý bác sĩ, lịch khám và hồ sơ bệnh án',
    permissions: null
  },

  // SYSTEM DEPARTMENT
  {
    username: 'systemmanager',
    department: 'system',
    rank: 'manager',
    job_description: 'Quản trị cấu hình, phân quyền và giám sát hệ thống',
    permissions: null
  },
  {
    username: 'systemstaff1',
    department: 'system',
    rank: 'staff',
    role_profile: 'it_support',
    job_description: 'Hỗ trợ vận hành hệ thống, xem log và cấu hình cơ bản',
    permissions: null
  },

  // SUPPORT DEPARTMENT
  {
    username: 'supportmanager',
    department: 'support',
    rank: 'manager',
    job_description: 'Quản lý toàn bộ hoạt động lễ tân và CSKH',
    permissions: null
  },
  {
    username: 'supportstaff1',
    department: 'support',
    rank: 'staff',
    role_profile: 'receptionist_frontdesk',
    job_description: 'Lễ tân tại quầy, check-in, tiếp đón và hỗ trợ đặt lịch',
    permissions: null
  },
  {
    username: 'supportstaff2',
    department: 'support',
    rank: 'staff',
    role_profile: 'customer_care',
    job_description: 'Hỗ trợ khách hàng, xử lý phản hồi và tin nhắn',
    permissions: null
  },

  // FINANCE DEPARTMENT
  {
    username: 'financemanager',
    department: 'finance',
    rank: 'manager',
    job_description: 'Quản lý thanh toán, doanh thu và báo cáo tài chính',
    permissions: null
  },
  {
    username: 'financestaff1',
    department: 'finance',
    rank: 'staff',
    role_profile: 'cashier',
    job_description: 'Thu tiền, xác nhận thanh toán tại quầy',
    permissions: null
  },

  // CONTENT DEPARTMENT
  {
    username: 'contentmanager',
    department: 'content',
    rank: 'manager',
    job_description: 'Duyệt, xuất bản và kiểm duyệt nội dung',
    permissions: null
  },
  {
    username: 'contentstaff1',
    department: 'content',
    rank: 'staff',
    role_profile: 'writer',
    job_description: 'Viết và chỉnh sửa bài viết, đề xuất cập nhật nội dung y tế',
    permissions: null
  },
  {
    username: 'contentstaff2',
    department: 'content',
    rank: 'staff',
    role_profile: 'writer',
    job_description: 'Viết và chỉnh sửa bài viết, đề xuất cập nhật nội dung y tế',
    permissions: null
  }
];

/**
 * Hàm chạy seed departments và cập nhật staff
 */
async function seedDepartmentsAndPermissions(models) {
  try {
    console.log('\n=== BẮT ĐẦU SEED DEPARTMENTS & PERMISSIONS ===\n');

    // 1. Seed departments (nếu có model Department)
    if (models.Department) {
      console.log('📁 Seeding departments...');
      for (const dept of departmentsSeedData) {
        await models.Department.findOrCreate({
          where: { code: dept.code },
          defaults: dept
        });
        console.log(`  ✓ ${dept.name}`);
      }
    }

    // 2. Cập nhật staff với department và permissions
    console.log('\n👥 Cập nhật staff departments và permissions...');
    
    for (const assignment of staffDepartmentAssignments) {
      // Tìm user theo username
      const user = await models.User.findOne({
        where: { username: assignment.username }
      });

      if (!user) {
        console.log(`  ⚠ User ${assignment.username} không tồn tại, bỏ qua...`);
        continue;
      }

      // Tìm staff record
      const staff = await models.Staff.findOne({
        where: { user_id: user.id }
      });

      if (!staff) {
        console.log(`  ⚠ Staff record cho ${assignment.username} không tồn tại, bỏ qua...`);
        continue;
      }

      const departmentProfiles = getDepartmentRoleProfiles(assignment.department);
      const firstRoleProfileCode = Object.keys(departmentProfiles || {})[0] || null;
      const roleProfileCode = assignment.role_profile || (assignment.rank === 'staff' ? firstRoleProfileCode : null);
      const profile = roleProfileCode ? getRoleProfile(assignment.department, roleProfileCode) : null;

      // Lấy permissions template
      let permissions = assignment.permissions || profile?.permissions || getPermissionsTemplate(assignment.department, assignment.rank);

      // Nếu assignment.permissions có dữ liệu legacy (array of strings hoặc object legacy),
      // chuyển sang canonical module->array format để lưu vào DB nhất quán
      if (assignment.permissions) {
        const mapped = mapLegacyPermissionsToCanonical(assignment.permissions);
        // Nếu mapper trả về non-empty, dùng mapped; ngược lại giữ nguyên permissions
        if (mapped && Object.keys(mapped).length > 0) permissions = mapped;
      }

      // Cập nhật staff
      await staff.update({
        department: assignment.department,
        rank: assignment.rank,
        role_profile: roleProfileCode,
        job_description: profile?.job_description || assignment.job_description,
        permissions: permissions
      });

      console.log(`  ✓ ${assignment.username} -> ${assignment.department} (${assignment.rank})`);
    }

    console.log('\n✅ HOÀN THÀNH SEED DEPARTMENTS & PERMISSIONS\n');
    
  } catch (error) {
    console.error('❌ Lỗi khi seed departments:', error);
    throw error;
  }
}

module.exports = {
  departmentsSeedData,
  staffDepartmentAssignments,
  seedDepartmentsAndPermissions
};
