// server/scripts/fix_notifications_type_column.js
// One-off script to modify notifications.type column to VARCHAR(100)
const db = require('../config/db');

(async () => {
  try {
    console.log('Connecting to DB and altering notifications.type column...');
    await db.sequelize.query("ALTER TABLE `notifications` MODIFY `type` VARCHAR(100) NOT NULL;");
    console.log('ALTER TABLE executed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error altering notifications.type column:', err.message || err);
    process.exit(1);
  }
})();
