// server/setup-forum-update.js
require('dotenv').config();
const { sequelize } = require('./config/db');
const migration = require('./migrations/008-update-questions-for-anonymous-and-multi-specialty');
const seedForumTopics = require('./config/forumTopicsSeed');

async function setupForumUpdate() {
  try {
    console.log('🚀 Starting Forum Update Setup...\n');
    
    // Step 1: Run migration
    console.log('📝 Step 1: Running migration 008...');
    await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    console.log('✅ Migration completed!\n');
    
    // Step 2: Seed topics
    console.log('🌱 Step 2: Seeding forum topics...');
    await seedForumTopics();
    console.log('✅ Topics seeded!\n');
    
    console.log('🎉 Forum update setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Update frontend form to include topic selection');
    console.log('   2. Add multi-select for specialties');
    console.log('   3. Add file upload (max 5 files)');
    console.log('   4. Add anonymous checkbox (only for topics with approval)');
    console.log('\n   See FORUM_ANONYMOUS_UPDATE_GUIDE.md for details\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

setupForumUpdate();
