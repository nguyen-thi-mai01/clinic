// Debug script to check doctor permissions
const { models } = require('./config/db');

async function debugDoctorPermissions() {
  try {
    console.log('\n=== DOCTOR PERMISSIONS DEBUG ===\n');

    // Find doctors
    const doctors = await models.Doctor.findAll({
      include: [
        { model: models.User, as: 'user', attributes: ['id', 'username', 'full_name', 'email'] }
      ],
      limit: 3
    });

    console.log(`Found ${doctors.length} doctors\n`);

    for (const doctor of doctors) {
      console.log(`\n--- Doctor: ${doctor.user?.full_name} (user_id: ${doctor.user_id}) ---`);
      
      // Check if Staff record exists for this doctor's user_id
      const staff = await models.Staff.findOne({
        where: { user_id: doctor.user_id }
      });

      if (staff) {
        console.log(`✓ Staff record found (staff_id: ${staff.id})`);
        console.log(`  Department: ${staff.department}`);
        console.log(`  Rank: ${staff.rank}`);
        console.log(`  Permissions:`, JSON.stringify(staff.permissions || {}, null, 2));
      } else {
        console.log(`✗ NO Staff record for this doctor`);
        
        // Check if doctor has assigned_staff_id
        if (doctor.assigned_staff_id) {
          console.log(`  Doctor has assigned_staff_id: ${doctor.assigned_staff_id}`);
          const assignedStaff = await models.Staff.findByPk(doctor.assigned_staff_id);
          if (assignedStaff) {
            console.log(`  ✓ Assigned Staff found`);
            console.log(`    Permissions:`, JSON.stringify(assignedStaff.permissions || {}, null, 2));
          }
        }
      }
    }

    console.log('\n=== END DEBUG ===\n');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

debugDoctorPermissions();
