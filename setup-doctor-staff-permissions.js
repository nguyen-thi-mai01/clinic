// Migration: Create Staff records for doctors with permissions
// Usage: node setup-doctor-staff-permissions.js

const { models } = require('./config/db');

async function setupDoctorPermissions() {
  try {
    console.log('\n=== SETTING UP DOCTOR STAFF PERMISSIONS ===\n');

    // Doctor permissions: can manage articles, medicines, diseases, and propose new ones
    const doctorPermissions = {
      articles: ['view', 'create', 'edit', 'approve', 'approve_medicine', 'approve_disease'],
      medicines: ['view', 'create', 'suggest'],
      diseases: ['view', 'create', 'suggest']
    };

    // Get all doctors
    const doctors = await models.Doctor.findAll({
      include: [{ model: models.User, as: 'user' }]
    });

    console.log(`Found ${doctors.length} doctors\n`);

    for (const doctor of doctors) {
      // Check if Staff record already exists
      const existingStaff = await models.Staff.findOne({
        where: { user_id: doctor.user_id }
      });

      if (existingStaff) {
        console.log(`✓ ${doctor.user?.full_name} already has Staff record (ID: ${existingStaff.id})`);
        
        // Update permissions if needed
        if (!existingStaff.permissions || !existingStaff.permissions.articles) {
          console.log(`  → Updating permissions...`);
          await existingStaff.update({ permissions: doctorPermissions });
          console.log(`  ✓ Permissions updated`);
        }
        continue;
      }

      // Create Staff record for doctor
      console.log(`Creating Staff record for ${doctor.user?.full_name}...`);
      
      const staff = await models.Staff.create({
        user_id: doctor.user_id,
        username: doctor.username,
        department: 'content',
        rank: 'staff',
        permissions: doctorPermissions,
        work_status: 'active',
        access_level: 2
      });

      console.log(`✓ Created Staff record (ID: ${staff.id})`);
      console.log(`  Permissions: ${JSON.stringify(doctorPermissions, null, 2)}`);
    }

    // Also create Staff record for admin if needed (for forum/community permissions)
    console.log(`\n--- Setting up Admin permissions ---\n`);
    
    const adminUser = await models.User.findOne({ where: { role: 'admin' } });
    if (adminUser) {
      const adminStaff = await models.Staff.findOne({ where: { user_id: adminUser.id } });
      
      if (!adminStaff) {
        const adminPermissions = {
          forum: ['view', 'create', 'edit', 'delete', 'manage', 'create_topic', 'edit_topic', 'toggle_topic', 'delete_topic', 'assign_moderators'],
          community: ['view', 'create', 'edit', 'delete', 'manage', 'create_group', 'edit_group', 'delete_group', 'manage_members']
        };
        
        console.log(`Creating Staff record for admin...`);
        const adminStaffRecord = await models.Staff.create({
          user_id: adminUser.id,
          username: adminUser.username,
          department: 'system',
          rank: 'manager',
          permissions: adminPermissions,
          work_status: 'active',
          access_level: 5
        });
        
        console.log(`✓ Created Staff record for admin (ID: ${adminStaffRecord.id})`);
        console.log(`  Permissions: ${JSON.stringify(adminPermissions, null, 2)}`);
      } else {
        console.log(`✓ Admin already has Staff record (ID: ${adminStaff.id})`);
      }
    }

    console.log('\n=== SETUP COMPLETE ===\n');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

setupDoctorPermissions();
