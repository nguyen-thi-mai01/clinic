const { sequelize, Staff, User } = require('./config/db');

(async () => {
  try {
    await sequelize.authenticate();
    console.log(' Database connected');

    // Find a staff member
    const staff = await Staff.findOne({
      where: { rank: 'staff' },
      include: [{
        model: User,
        as: 'user',
        attributes: ['email', 'name']
      }]
    });

    if (staff) {
      console.log('\n📋 Staff Information:');
      console.log('Email:', staff.user.email);
      console.log('Name:', staff.user.name);
      console.log('Department:', staff.department);
      console.log('Rank:', staff.rank);
      console.log('\n🔐 Permissions (Raw):');
      console.log(JSON.stringify(staff.permissions, null, 2));
      
      // Check specific module keys
      console.log('\n🔍 Module Permission Analysis:');
      if (staff.permissions) {
        const moduleKeys = Object.keys(staff.permissions);
        console.log('Available modules:', moduleKeys);
        
        // Check each key module
        console.log('\n📌 Key Modules Check:');
        console.log('- services:', staff.permissions.services || 'NOT FOUND');
        console.log('- consultations:', staff.permissions.consultations || 'NOT FOUND');
        console.log('- consultation_pricing:', staff.permissions.consultation_pricing || 'NOT FOUND');
        console.log('- system_settings:', staff.permissions.system_settings || 'NOT FOUND');
      } else {
        console.log('⚠️ No permissions set!');
      }
    } else {
      console.log('⚠️ No staff member found in database');
    }

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
