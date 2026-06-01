// server/run-migration-008.js
require('dotenv').config();
const { sequelize } = require('./config/db');
const migration = require('./migrations/008-update-questions-for-anonymous-and-multi-specialty');

async function runMigration() {
  try {
    console.log('🚀 Starting migration 008...\n');
    
    await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    
    console.log('\n✅ Migration 008 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
