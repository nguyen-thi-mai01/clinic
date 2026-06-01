const { mergePermissions } = require('./departmentPermissions');

const buildPermissions = (basePermissions, extraPermissions = {}) => {
  return mergePermissions(basePermissions, extraPermissions);
};

const ROLE_PROFILES = {
  support: {
    receptionist_frontdesk: {
      code: 'receptionist_frontdesk',
      name: 'Lễ tân quầy',
      department: 'support',
      rank: 'staff',
      job_description: 'Lễ tân tại quầy, check-in, tiếp đón và hỗ trợ đặt lịch',
      permissions: buildPermissions(
        {
          reception: ['view_all_appointments', 'view_all_schedules', 'checkin', 'issue_number', 'create_appointment'],
          appointments: ['view', 'create', 'edit', 'approve', 'reject'],
          patients: ['view', 'edit']
        },
        {}
      )
    },
    customer_care: {
      code: 'customer_care',
      name: 'Chăm sóc khách hàng',
      department: 'support',
      rank: 'staff',
      job_description: 'Hỗ trợ khách hàng, xử lý phản hồi và tin nhắn',
      permissions: buildPermissions(
        {
          contact: ['view', 'reply', 'mark_read'],
          forum: ['view_questions', 'search_question', 'comment_question'],
          forum_reports: ['view_reports']
        },
        {}
      )
    }
  },

  finance: {
    cashier: {
      code: 'cashier',
      name: 'Thu ngân',
      department: 'finance',
      rank: 'staff',
      job_description: 'Thu tiền, xác nhận thanh toán tại quầy',
      permissions: buildPermissions(
        {
          payments: ['view', 'pos', 'verify'],
          pharmacy: ['view', 'export_retail', 'export_prescription'],
          appointments: ['view', 'approve', 'update_status'],
          reception: ['checkin']
        },
        {}
      )
    },
    accountant_debt: {
      code: 'accountant_debt',
      name: 'Kế toán công nợ',
      department: 'finance',
      rank: 'staff',
      job_description: 'Theo dõi công nợ và các khoản cần đối soát',
      permissions: buildPermissions(
        {
          payments: ['view', 'verify'],
          pharmacy: ['view', 'view_transactions', 'view_alerts'],
          refund_requests: ['view'],
          statistics: ['view']
        },
        {}
      )
    },
    accountant_reconciliation: {
      code: 'accountant_reconciliation',
      name: 'Kế toán đối soát',
      department: 'finance',
      rank: 'staff',
      job_description: 'Đối soát giao dịch, hoàn tiền và báo cáo tài chính',
      permissions: buildPermissions(
        {
          payments: ['view', 'verify', 'refund', 'export'],
          pharmacy: ['view', 'view_transactions', 'view_alerts', 'adjust_stock', 'manage_suppliers'],
          refund_requests: ['view', 'approve', 'reject'],
          statistics: ['view', 'revenue', 'export']
        },
        {}
      )
    },
    // manager-level profiles removed — only staff-level profiles remain
  },

  content: {
    writer: {
      code: 'writer',
      name: 'Biên tập viên',
      department: 'content',
      rank: 'staff',
      job_description: 'Viết và chỉnh sửa bài viết, đề xuất cập nhật nội dung y tế',
      permissions: buildPermissions(
        {
          articles: ['view', 'create', 'edit', 'duplicate'],
          medicines: ['view', 'propose_update'],
          diseases: ['view', 'propose_update'],
          forum: ['view_questions', 'create_question', 'comment_question', 'save_question', 'search_question'],
          events_vouchers: ['view_events', 'view_vouchers']
        },
        {}
      )
    },
    marketing_specialist: {
      code: 'marketing_specialist',
      name: 'Marketing nội dung',
      department: 'content',
      rank: 'staff',
      job_description: 'Quản lý sự kiện, voucher và chiến dịch khuyến mãi',
      permissions: buildPermissions(
        {
          articles: ['view', 'create', 'edit', 'duplicate'],
          events_vouchers: ['view_events', 'create_event', 'edit_event', 'delete_event', 'view_vouchers', 'create_voucher', 'edit_voucher', 'delete_voucher', 'create_game', 'config_rewards']
        },
        {}
      )
    }
  },

  clinical: {
    clinical_staff: {
      code: 'clinical_staff',
      name: 'Nhân viên lâm sàng',
      department: 'clinical',
      rank: 'staff',
      job_description: 'Hỗ trợ vận hành lâm sàng, hồ sơ khám và điều phối khám',
      permissions: buildPermissions(
        {
          appointments: ['view', 'update_status'],
          patients: ['view', 'edit'],
          medical_records: ['view', 'create', 'edit', 'edit_vitals'],
          consultations: ['view', 'create', 'edit']
        },
        {}
      )
    }
  },

  system: {
    it_support: {
      code: 'it_support',
      name: 'IT hỗ trợ',
      department: 'system',
      rank: 'staff',
      job_description: 'Hỗ trợ vận hành hệ thống, xem log và cấu hình cơ bản',
      permissions: buildPermissions(
        {
          system_settings: ['view', 'view_audit_logs'],
          staff_management: ['view'],
          consultation_realtime: ['monitor'],
          video_call: ['monitor']
        },
        {}
      )
    }
  }
};

const getDepartmentRoleProfiles = (departmentCode) => {
  return ROLE_PROFILES[departmentCode] || {};
};

const getRoleProfile = (departmentCode, profileCode) => {
  const departmentProfiles = ROLE_PROFILES[departmentCode];
  if (!departmentProfiles) return null;
  return departmentProfiles[profileCode] || null;
};

const normalizeForCompare = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeForCompare).sort();
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((accumulator, key) => {
      accumulator[key] = normalizeForCompare(value[key]);
      return accumulator;
    }, {});
  }

  return value;
};

const findRoleProfileByPermissions = (departmentCode, permissions = {}, jobDescription = '') => {
  const departmentProfiles = ROLE_PROFILES[departmentCode];
  if (!departmentProfiles) return null;

  const normalizedPermissions = JSON.stringify(normalizeForCompare(permissions || {}));
  const normalizedJobDescription = (jobDescription || '').trim().toLowerCase();

  for (const profile of Object.values(departmentProfiles)) {
    const profilePermissions = JSON.stringify(normalizeForCompare(profile.permissions || {}));
    const profileJobDescription = (profile.job_description || '').trim().toLowerCase();

    if (profilePermissions === normalizedPermissions) {
      return profile;
    }

    if (normalizedJobDescription && profileJobDescription && normalizedJobDescription === profileJobDescription) {
      return profile;
    }
  }

  return null;
};

module.exports = {
  ROLE_PROFILES,
  getDepartmentRoleProfiles,
  getRoleProfile,
  findRoleProfileByPermissions
};