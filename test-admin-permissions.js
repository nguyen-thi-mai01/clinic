// Test admin forum/community permissions
const { models } = require('./config/db');

async function testAdminPermissions() {
  try {
    const admin = await models.User.findOne({ where: { role: 'admin' } });
    if (!admin) {
      console.log('❌ No admin found');
      process.exit(1);
    }

    console.log(`\n✓ Admin: ${admin.full_name} (ID: ${admin.id})`);

    const adminStaff = await models.Staff.findOne({ where: { user_id: admin.id } });
    if (!adminStaff) {
      console.log('❌ Admin has NO Staff record!');
    } else {
      console.log(`✓ Admin has Staff record (ID: ${adminStaff.id})`);
      console.log(`  Permissions:`, JSON.stringify(adminStaff.permissions, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

testAdminPermissions();
