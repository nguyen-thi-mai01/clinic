// server/run-migration-009-and-seed-topics.js
const { sequelize, models } = require('./config/db');
const seedForumTopics = require('./config/forumTopicsSeed');

async function runMigrationAndSeed() {
  try {
    console.log('🚀 Starting migration 009 and seeding topics...\n');

    // Run migration 009
    console.log('📦 Running migration 009: Create topics table...');
    const migration009 = require('./migrations/009-create-topics-table');
    const Sequelize = require('sequelize');
    await migration009.up(sequelize.getQueryInterface(), Sequelize);
    console.log('✅ Migration 009 completed!\n');

    // Seed topics
    console.log('🌱 Seeding forum topics...');
    await seedForumTopics();
    console.log('✅ Topics seeded successfully!\n');

    console.log('🎉 All done! Topics table created and seeded.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

runMigrationAndSeed();
