const { models } = require('../config/db');

(async () => {
  try {
    const id = process.argv[2] || 3;
    const staff = await models.Staff.findByPk(id, { attributes: ['id', 'user_id', 'permissions'] });
    if (!staff) {
      console.log('Staff not found:', id);
      process.exit(0);
    }
    console.log('Staff id:', staff.id, 'user_id:', staff.user_id);
    console.log('permissions:', typeof staff.permissions === 'string' ? staff.permissions : JSON.stringify(staff.permissions, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
