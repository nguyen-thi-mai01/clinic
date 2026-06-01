// server/scripts/seedDepartments.js
const { models } = require('../config/db');
const { seedDepartmentsAndPermissions } = require('../config/departmentsSeed');

async function runSeed() {
  try {
    await seedDepartmentsAndPermissions(models);
    console.log('✅ Seed departments & permissions hoàn tất!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi seed:', error);
    process.exit(1);
  }
}

runSeed();
