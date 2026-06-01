#!/usr/bin/env node
// server/scripts/findUnmappedPermissions.js
// Scan Staff/Doctor permission JSON in DB and report keys/modules not defined in PERMISSION_MODULES

const path = require('path');
const { models } = require('../config/db');
const PERMISSION_MODULES = require('../config/permissionModules');

const knownMap = {};
for (const [mKey, mInfo] of Object.entries(PERMISSION_MODULES)) {
  knownMap[mKey] = new Set((mInfo.permissions || []).map(p => p.key));
}

const results = {
  unmappedModules: {},
  unmappedKeys: {}
};

const inspectPermissions = (recordType, rec) => {
  let perms = rec.permissions;
  if (!perms) return;
  if (typeof perms === 'string') {
    try { perms = JSON.parse(perms); } catch (e) { return; }
  }
  if (!perms || typeof perms !== 'object') return;

  for (const [mKey, mVal] of Object.entries(perms)) {
    if (!knownMap[mKey]) {
      if (!results.unmappedModules[mKey]) results.unmappedModules[mKey] = { count: 0, samples: [] };
      results.unmappedModules[mKey].count++;
      if (results.unmappedModules[mKey].samples.length < 5) results.unmappedModules[mKey].samples.push({ type: recordType, id: rec.id, user_id: rec.user_id || null });
      continue;
    }

    // If module is known, inspect inner keys
    if (typeof mVal === 'object' && !Array.isArray(mVal)) {
      for (const innerKey of Object.keys(mVal)) {
        if (!knownMap[mKey].has(innerKey)) {
          const full = `${mKey}.${innerKey}`;
          if (!results.unmappedKeys[full]) results.unmappedKeys[full] = { count: 0, samples: [] };
          results.unmappedKeys[full].count++;
          if (results.unmappedKeys[full].samples.length < 5) results.unmappedKeys[full].samples.push({ type: recordType, id: rec.id, user_id: rec.user_id || null });
        }
      }
    }

    if (Array.isArray(mVal)) {
      for (const innerKey of mVal) {
        if (!knownMap[mKey].has(innerKey)) {
          const full = `${mKey}.${innerKey}`;
          if (!results.unmappedKeys[full]) results.unmappedKeys[full] = { count: 0, samples: [] };
          results.unmappedKeys[full].count++;
          if (results.unmappedKeys[full].samples.length < 5) results.unmappedKeys[full].samples.push({ type: recordType, id: rec.id, user_id: rec.user_id || null });
        }
      }
    }

    // boolean module or others ignored for inner keys
  }
};

(async () => {
  try {
    console.log('Connecting to DB and scanning permissions...');
    const staffs = await models.Staff.findAll({ attributes: ['id', 'user_id', 'permissions'] });
    for (const s of staffs) inspectPermissions('staff', s);

    // Some models may not have `permissions` column (e.g., legacy doctors table).
    if (models.Doctor && models.Doctor.rawAttributes && models.Doctor.rawAttributes.permissions) {
      const doctors = await models.Doctor.findAll({ attributes: ['id', 'user_id', 'permissions'] });
      for (const d of doctors) inspectPermissions('doctor', d);
    } else {
      console.log('Skipping Doctor scan: `permissions` column not present.');
    }

    console.log('\n==== Unmapped MODULES (module not found in PERMISSION_MODULES) ====');
    console.log(JSON.stringify(results.unmappedModules, null, 2));

    console.log('\n==== Unmapped KEYS (module.key not found in PERMISSION_MODULES[module].permissions) ====');
    console.log(JSON.stringify(results.unmappedKeys, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error scanning permissions:', err);
    process.exit(1);
  }
})();
