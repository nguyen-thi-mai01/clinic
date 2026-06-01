const { models } = require('../config/db');
const { buildPermissionAuditDetails } = require('../utils/permissionAudit');

(async () => {
  try {
    const staffId = process.argv[2] || 3;
    const staff = await models.Staff.findByPk(staffId, { include: [{ model: models.User, attributes: ['full_name'] }] });
    if (!staff) return console.log('Staff not found', staffId);

    const oldPermissions = JSON.parse(JSON.stringify(staff.permissions || {}));
    const newPermissions = JSON.parse(JSON.stringify(oldPermissions));
    newPermissions.work_shift = newPermissions.work_shift || [];
    if (Array.isArray(newPermissions.work_shift)) {
      if (!newPermissions.work_shift.includes('register_leave')) newPermissions.work_shift.push('register_leave');
    } else if (typeof newPermissions.work_shift === 'object') {
      newPermissions.work_shift.register_leave = true;
    } else {
      newPermissions.work_shift = ['register_leave'];
    }

    staff.permissions = newPermissions;
    await staff.save();

    const details = buildPermissionAuditDetails(oldPermissions, newPermissions, { changed_at: new Date() });

    const audit = await models.AuditLog.create({
      user_id: 1,
      action_type: 'permission_change',
      target_type: 'staff',
      target_id: staff.id,
      target_name: staff.User?.full_name || staff.code,
      details
    });

    console.log('Created AuditLog id:', audit.id);
    console.log('Details:', JSON.stringify(details, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
