// server/config/departmentPermissions.js

/**
 * Định nghĩa các quyền chi tiết cho từng phòng ban
 * Mỗi phòng ban có 2 loại quyền:
 * - staff_permissions: Quyền cho nhân viên thường
 * - manager_permissions: Quyền cho trưởng phòng (manager)
 */

const PERMISSION_MODULES = require('./permissionModules');

const buildUnifiedPermissionsTemplate = (rank = 'staff') => {
  return Object.entries(PERMISSION_MODULES).reduce((template, [moduleKey, module]) => {
    const actions = module.permissions
      .filter(permission => !permission.allowedRanks || permission.allowedRanks.includes(rank))
      .map(permission => permission.key);

    if (actions.length > 0) {
      template[moduleKey] = actions;
    }

    return template;
  }, {});
};

const createDepartmentDefinition = (name, description) => ({
  name,
  description,
  staff_permissions: buildUnifiedPermissionsTemplate('staff'),
  manager_permissions: buildUnifiedPermissionsTemplate('manager')
});

const DEPARTMENT_PERMISSIONS = {
  clinical: createDepartmentDefinition('Vận hành lâm sàng', 'Quản lý lịch hẹn, hồ sơ bệnh án và điều phối khám chữa bệnh'),
  system: createDepartmentDefinition('Hệ thống & IT', 'Quản lý hệ thống, cấu hình và giám sát sự cố'),
  support: createDepartmentDefinition('Chăm sóc khách hàng', 'Hỗ trợ khách hàng, giải đáp thắc mắc'),
  finance: createDepartmentDefinition('Tài chính kế toán', 'Quản lý thanh toán, doanh thu, báo cáo tài chính'),
  content: createDepartmentDefinition('Nội dung & Truyền thông', 'Quản lý bài viết, thuốc, bệnh lý, sự kiện và voucher')
};

/**
 * Lấy tất cả quyền có thể của một module
 */
const getAllModuleActions = (module) => {
  const allActions = new Set();
  
  Object.values(DEPARTMENT_PERMISSIONS).forEach(dept => {
    const staffPerms = dept.staff_permissions[module] || [];
    const managerPerms = dept.manager_permissions[module] || [];
    
    [...staffPerms, ...managerPerms].forEach(action => allActions.add(action));
  });
  
  return Array.from(allActions);
};

/**
 * Lấy danh sách tất cả modules
 */
const getAllModules = () => {
  const modules = new Set();
  
  Object.values(DEPARTMENT_PERMISSIONS).forEach(dept => {
    Object.keys(dept.staff_permissions).forEach(mod => modules.add(mod));
    Object.keys(dept.manager_permissions).forEach(mod => modules.add(mod));
  });
  
  return Array.from(modules).sort();
};

/**
 * Lấy permissions template theo phòng ban và rank
 */
const getPermissionsTemplate = (departmentCode, rank = 'staff') => {
  const dept = DEPARTMENT_PERMISSIONS[departmentCode];
  if (!dept) return {};
  
  return rank === 'manager' 
    ? dept.manager_permissions 
    : dept.staff_permissions;
};

/**
 * Compatibility mapper: chuyển các permission legacy (ví dụ 'create_medicine', 'approve_medicine',
 * hoặc 'module.action') thành dạng canonical { module: [actions] }.
 * Accepts: array of strings, or object mapping legacyAction:true, or module->array/object.
 */
const mapLegacyPermissionsToCanonical = (input) => {
  const canonical = {};

  const allModules = Object.entries(PERMISSION_MODULES);

  const addAction = (moduleKey, action) => {
    if (!PERMISSION_MODULES[moduleKey]) return;
    if (!canonical[moduleKey]) canonical[moduleKey] = [];
    if (!canonical[moduleKey].includes(action)) canonical[moduleKey].push(action);
  };

  const mapString = (str) => {
    if (!str || typeof str !== 'string') return null;
    // module.action format
    if (str.indexOf('.') > -1) {
      const [m, a] = str.split('.');
      if (PERMISSION_MODULES[m]) return { module: m, action: a };
    }

    // action_module or action_moduleplural (e.g. create_medicine)
    const parts = str.split('_');
    if (parts.length >= 2) {
      const action = parts[0];
      const moduleCandidate = parts.slice(1).join('_');
      // try direct match
      if (PERMISSION_MODULES[moduleCandidate]) return { module: moduleCandidate, action };
      // try plural/s names
      const alt = Object.keys(PERMISSION_MODULES).find(k => k === `${moduleCandidate}s` || k === `${moduleCandidate}es`);
      if (alt) return { module: alt, action };
      // some legacy used singular like 'medicine' -> map to 'medicines'
      const alias = moduleCandidate === 'medicine' ? 'medicines' : (moduleCandidate === 'disease' ? 'diseases' : null);
      if (alias && PERMISSION_MODULES[alias]) return { module: alias, action };
    }

    // fallback: if action key exists in any module, return first match
    for (const [moduleKey, module] of allModules) {
      if (module.permissions.some(p => p.key === str)) return { module: moduleKey, action: str };
    }

    return null;
  };

  if (Array.isArray(input)) {
    input.forEach(item => {
      const m = mapString(item);
      if (m) addAction(m.module, m.action);
    });
    return canonical;
  }

  if (!input || typeof input !== 'object') return canonical;

  // If input is module -> array/object, copy recognized modules
  Object.entries(input).forEach(([k, v]) => {
    if (PERMISSION_MODULES[k]) {
      if (Array.isArray(v)) {
        v.forEach(a => addAction(k, a));
      } else if (v && typeof v === 'object') {
        Object.entries(v).forEach(([ak, av]) => { if (av) addAction(k, ak); });
      } else if (v === true) {
        PERMISSION_MODULES[k].permissions.forEach(p => addAction(k, p.key));
      }
      return;
    }

    // otherwise treat k as legacy action name
    const mapped = mapString(k);
    if (mapped) {
      if (v === true) addAction(mapped.module, mapped.action);
      else if (Array.isArray(v)) v.forEach(item => addAction(mapped.module, item));
    }
  });

  return canonical;
};

/**
 * Kiểm tra quyền
 */
const hasPermission = (userPermissions, module, action) => {
  if (!userPermissions || !userPermissions[module]) return false;
  return userPermissions[module].includes(action);
};

/**
 * Merge permissions (kết hợp quyền từ nhiều nguồn)
 */
const mergePermissions = (...permissionObjects) => {
  const merged = {};
  
  permissionObjects.forEach(perms => {
    if (!perms) return;
    
    Object.entries(perms).forEach(([module, actions]) => {
      if (!merged[module]) {
        merged[module] = [];
      }
      merged[module] = [...new Set([...merged[module], ...actions])];
    });
  });
  
  return merged;
};

module.exports = {
  DEPARTMENT_PERMISSIONS,
  getAllModuleActions,
  getAllModules,
  getPermissionsTemplate,
  hasPermission,
  mergePermissions
};

// Export compatibility mapper
module.exports.mapLegacyPermissionsToCanonical = mapLegacyPermissionsToCanonical;