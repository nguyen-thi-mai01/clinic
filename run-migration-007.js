// server/run-migration-007.js
// Script chạy migration 007 để update Question status ENUM
const { Sequelize } = require('sequelize');
const config = require('./config/config.js');

async function runMigration() {
  console.log('🚀 Starting Migration 007: Update Question status ENUM...\n');
  console.log('DB Config:', {
    database: config.database,
    user: config.username,
    host: config.host
  });
  console.log();

  const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      host: config.host,
      port: config.port || 3306,
      dialect: config.dialect || 'mysql',
      logging: false,
      pool: config.pool || {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    const transaction = await sequelize.transaction();

    try {
      console.log('📝 Step 1: Updating existing status values...');
      await sequelize.query(`
        UPDATE questions 
        SET status = CASE 
          WHEN status = 'open' THEN 'approved'
          WHEN status = 'closed' THEN 'approved'
          WHEN status = 'hidden' THEN 'hidden'
          ELSE 'approved'
        END
        WHERE status IN ('open', 'closed');
      `, { transaction });
      console.log('✅ Step 1 complete\n');

      console.log('📝 Step 2: Modifying status column ENUM...');
      await sequelize.query(`
        ALTER TABLE questions 
        MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'hidden', 'reported') 
        NOT NULL DEFAULT 'pending'
        COMMENT 'pending=chờ duyệt, approved=đã duyệt, rejected=từ chối, hidden=ẩn, reported=bị báo cáo';
      `, { transaction });
      console.log('✅ Step 2 complete\n');

      console.log('📝 Step 3: Adding new columns for forum moderation...');
      
      // Check and add requires_approval
      try {
        await sequelize.query(`
          ALTER TABLE questions 
          ADD COLUMN requires_approval BOOLEAN DEFAULT TRUE 
          COMMENT 'Topic này có cần phê duyệt không?';
        `, { transaction });
        console.log('  ✓ Added requires_approval');
      } catch (e) {
        if (e.message.includes('Duplicate column')) {
          console.log('  ⊙ requires_approval already exists');
        } else throw e;
      }

      // Check and add auto_approve
      try {
        await sequelize.query(`
          ALTER TABLE questions 
          ADD COLUMN auto_approve BOOLEAN DEFAULT FALSE 
          COMMENT 'Duyệt tự động?';
        `, { transaction });
        console.log('  ✓ Added auto_approve');
      } catch (e) {
        if (e.message.includes('Duplicate column')) {
          console.log('  ⊙ auto_approve already exists');
        } else throw e;
      }

      // Check and add moderator_ids
      try {
        await sequelize.query(`
          ALTER TABLE questions 
          ADD COLUMN moderator_ids JSON DEFAULT '[]' 
          COMMENT 'Array of staff IDs được phân công kiểm duyệt (max 2)';
        `, { transaction });
        console.log('  ✓ Added moderator_ids');
      } catch (e) {
        if (e.message.includes('Duplicate column')) {
          console.log('  ⊙ moderator_ids already exists');
        } else throw e;
      }

      // Check and add report_count
      try {
        await sequelize.query(`
          ALTER TABLE questions 
          ADD COLUMN report_count INT DEFAULT 0 
          COMMENT 'Số lần bị báo cáo';
        `, { transaction });
        console.log('  ✓ Added report_count');
      } catch (e) {
        if (e.message.includes('Duplicate column')) {
          console.log('  ⊙ report_count already exists');
        } else throw e;
      }

      // Check and add likes_count
      try {
        await sequelize.query(`
          ALTER TABLE questions 
          ADD COLUMN likes_count INT DEFAULT 0 
          COMMENT 'Cached counter - sync từ Interaction';
        `, { transaction });
        console.log('  ✓ Added likes_count');
      } catch (e) {
        if (e.message.includes('Duplicate column')) {
          console.log('  ⊙ likes_count already exists');
        } else throw e;
      }

      // Check and add shares_count
      try {
        await sequelize.query(`
          ALTER TABLE questions 
          ADD COLUMN shares_count INT DEFAULT 0 
          COMMENT 'Cached counter - sync từ Interaction';
        `, { transaction });
        console.log('  ✓ Added shares_count');
      } catch (e) {
        if (e.message.includes('Duplicate column')) {
          console.log('  ⊙ shares_count already exists');
        } else throw e;
      }

      // Check and add saves_count
      try {
        await sequelize.query(`
          ALTER TABLE questions 
          ADD COLUMN saves_count INT DEFAULT 0 
          COMMENT 'Cached counter - sync từ Interaction';
        `, { transaction });
        console.log('  ✓ Added saves_count');
      } catch (e) {
        if (e.message.includes('Duplicate column')) {
          console.log('  ⊙ saves_count already exists');
        } else throw e;
      }

      // Check and add rejection_reason
      try {
        await sequelize.query(`
          ALTER TABLE questions 
          ADD COLUMN rejection_reason TEXT NULL;
        `, { transaction });
        console.log('  ✓ Added rejection_reason');
      } catch (e) {
        if (e.message.includes('Duplicate column')) {
          console.log('  ⊙ rejection_reason already exists');
        } else throw e;
      }

      // Check and add approved_at
      try {
        await sequelize.query(`
          ALTER TABLE questions 
          ADD COLUMN approved_at TIMESTAMP NULL;
        `, { transaction });
        console.log('  ✓ Added approved_at');
      } catch (e) {
        if (e.message.includes('Duplicate column')) {
          console.log('  ⊙ approved_at already exists');
        } else throw e;
      }

      // Check and add approved_by
      try {
        await sequelize.query(`
          ALTER TABLE questions 
          ADD COLUMN approved_by BIGINT NULL,
          ADD FOREIGN KEY (approved_by) REFERENCES users(id);
        `, { transaction });
        console.log('  ✓ Added approved_by');
      } catch (e) {
        if (e.message.includes('Duplicate column')) {
          console.log('  ⊙ approved_by already exists');
        } else throw e;
      }

      console.log('✅ Step 3 complete\n');

      await transaction.commit();
      console.log('🎉 Migration 007 completed successfully!\n');
      console.log('📊 Summary:');
      console.log('   - Updated status ENUM: pending, approved, rejected, hidden, reported');
      console.log('   - Added moderation columns: requires_approval, auto_approve, moderator_ids');
      console.log('   - Added counters: report_count, likes_count, shares_count, saves_count');
      console.log('   - Added approval tracking: approved_at, approved_by, rejection_reason\n');

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
}

runMigration();
