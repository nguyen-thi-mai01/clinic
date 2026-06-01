// server/utils/permissionAudit.js
const PERMISSION_MODULES = require('../config/permissionModules');

const hasPermission = (modulePerms, permKey) => {
  if (!modulePerms) return false;
  if (typeof modulePerms === 'boolean') return modulePerms;
  if (Array.isArray(modulePerms)) return modulePerms.includes(permKey);
  if (typeof modulePerms === 'object') return modulePerms[permKey] === true;
  return false;
};

const getPermissionChanges = (oldPerms, newPerms) => {
  const changes = [];
  const unmapped = [];

  for (const [moduleKey, moduleInfo] of Object.entries(PERMISSION_MODULES)) {
    const oldModulePerms = oldPerms?.[moduleKey];
    const newModulePerms = newPerms?.[moduleKey];

    for (const permission of (moduleInfo.permissions || [])) {
      const permKey = permission.key;
      const permLabel = permission.label || permission.description || permission.key;
      const oldValue = hasPermission(oldModulePerms, permKey);
      const newValue = hasPermission(newModulePerms, permKey);

      if (oldValue !== newValue) {
        const action = newValue ? 'Bật quyền' : 'Tắt quyền';
        changes.push(`${action} "${permLabel}" trong module "${moduleInfo.name}"`);
      }
    }
  }

  // Detect any permission keys present in old/new that are not declared in PERMISSION_MODULES
  const knownModules = new Set(Object.keys(PERMISSION_MODULES));

  const collectKeys = (perms) => {
    const out = [];
    if (!perms || typeof perms !== 'object') return out;
    for (const [mKey, mVal] of Object.entries(perms)) {
      if (!knownModules.has(mKey)) {
        out.push({ module: mKey, key: null });
        continue;
      }
      if (typeof mVal === 'boolean') {
        // boolean module (full access) - can't list inner keys
        out.push({ module: mKey, key: '__BOOLEAN__' });
        continue;
      }
      if (Array.isArray(mVal)) {
        for (const k of mVal) out.push({ module: mKey, key: k });
        continue;
      }
      if (typeof mVal === 'object') {
        for (const k of Object.keys(mVal)) out.push({ module: mKey, key: k });
      }
    }
    return out;
  };

  const oldKeys = collectKeys(oldPerms);
  const newKeys = collectKeys(newPerms);

  const isKnownKey = (moduleKey, permKey) => {
    const moduleInfo = PERMISSION_MODULES[moduleKey];
    if (!moduleInfo) return false;
    if (!permKey || permKey === '__BOOLEAN__') return true; // treat boolean as known if module exists
    return (moduleInfo.permissions || []).some(p => p.key === permKey);
  };

  for (const item of [...oldKeys, ...newKeys]) {
    if (!isKnownKey(item.module, item.key)) {
      if (item.key) {
        unmapped.push(`Không xác định quyền "${item.key}" trong module "${item.module}"`);
      } else {
        unmapped.push(`Không xác định module quyền "${item.module}"`);
      }
    }
  }

  // Deduplicate unmapped messages
  const uniqueUnmapped = Array.from(new Set(unmapped));

  return { changes, unmapped: uniqueUnmapped };
};

const buildPermissionAuditDetails = (oldPermissions, newPermissions, extraDetails = {}) => {
  const { changes, unmapped } = getPermissionChanges(oldPermissions, newPermissions);

  const details = {
    ...extraDetails,
    changed: changes,
    permission_changes: changes,
    old_permissions: oldPermissions,
    new_permissions: newPermissions
  };

  if (unmapped && unmapped.length) {
    details.unmapped_changes = unmapped;
  }

  return details;
};

module.exports = {
  hasPermission,
  getPermissionChanges,
  buildPermissionAuditDetails
};
