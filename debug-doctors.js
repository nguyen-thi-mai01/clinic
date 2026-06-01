// Debug script: Check doctors data
const { models } = require('./config/db');

async function debugDoctors() {
  try {
    console.log('\n=== CHECKING DOCTORS DATA ===\n');
    
    // 1. Count all doctors
    const totalDoctors = await models.Doctor.count();
    console.log(`1. Total doctors in DB: ${totalDoctors}`);
    
    // 2. Count doctors with work_status = 'active'
    const activeDoctors = await models.Doctor.count({
      where: { work_status: 'active' }
    });
    console.log(`2. Active doctors (work_status='active'): ${activeDoctors}`);
    
    // 3. Check specialty distribution
    const doctorsBySpecialty = await models.Doctor.findAll({
      attributes: ['specialty_id'],
      group: ['specialty_id'],
      raw: true,
      subQuery: false
    });
    console.log(`3. Specialties with doctors: ${doctorsBySpecialty.length}`);
    console.log('   Data:', doctorsBySpecialty);
    
    // 4. Get first specialty with active doctors
    const firstSpecialty = await models.Doctor.findOne({
      where: { work_status: 'active' },
      attributes: ['specialty_id']
    });
    console.log(`\n4. First specialty with active doctor: ${firstSpecialty?.specialty_id}`);
    
    if (firstSpecialty?.specialty_id) {
      // 5. Count active doctors for this specialty
      const doctorCount = await models.Doctor.count({
        where: {
          specialty_id: firstSpecialty.specialty_id,
          work_status: 'active'
        }
      });
      console.log(`5. Active doctors for specialty ${firstSpecialty.specialty_id}: ${doctorCount}`);
      
      // 6. Get actual doctors
      const doctors = await models.Doctor.findAll({
        where: {
          specialty_id: firstSpecialty.specialty_id,
          work_status: 'active'
        },
        include: [
          { model: models.User, as: 'user', attributes: ['id', 'full_name'] },
          { model: models.Specialty, as: 'specialty', attributes: ['id', 'name'] }
        ]
      });
      console.log(`\n6. Doctors for specialty ${firstSpecialty.specialty_id}:`);
      doctors.forEach(d => {
        console.log(`   - ID: ${d.id}, Name: ${d.user?.full_name}, Specialty: ${d.specialty?.name}`);
      });
    }
    
    // 7. Sample 3 doctors
    console.log('\n7. Sample 3 doctors from DB:');
    const samples = await models.Doctor.findAll({
      limit: 3,
      include: [
        { model: models.User, as: 'user', attributes: ['id', 'full_name'] },
        { model: models.Specialty, as: 'specialty', attributes: ['id', 'name'] }
      ]
    });
    samples.forEach(d => {
      console.log(`   - ID: ${d.id}, User: ${d.user?.full_name}, Specialty: ${d.specialty?.name}, work_status: ${d.work_status}`);
    });
    
    console.log('\n=== END DEBUG ===\n');
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

debugDoctors();
