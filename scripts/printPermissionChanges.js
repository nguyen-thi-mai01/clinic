const { models } = require('../config/db');

(async () => {
  try {
    const logs = await models.AuditLog.findAll({
      where: { action_type: 'permission_change' },
      include: [{ model: models.User, as: 'user', attributes: ['id', 'full_name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: 20
    });

    if (!logs || logs.length === 0) {
      console.log('No permission_change audit logs found.');
      process.exit(0);
    }

    for (const l of logs) {
      console.log('---');
      console.log('id:', l.id, 'target:', l.target_type, l.target_id, 'by:', l.user?.full_name);
      console.log('created_at:', l.created_at);
      console.log('details:', typeof l.details === 'string' ? l.details : JSON.stringify(l.details, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error('Error fetching logs:', err);
    process.exit(1);
  }
})();
