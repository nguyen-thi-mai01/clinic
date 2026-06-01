// Test query Topic đơn giản
require('dotenv').config();
const { sequelize, models } = require('./config/db');

async function testTopicQuery() {
  try {
    console.log('🧪 Test 1: Query tất cả topics (không điều kiện)...');
    const allTopics = await models.Topic.findAll();
    console.log('✅ Success! Found', allTopics.length, 'topics');
    
    console.log('\n🧪 Test 2: Query với WHERE isActive=true...');
    const activeTopics = await models.Topic.findAll({
      where: { isActive: true }
    });
    console.log('✅ Success! Found', activeTopics.length, 'active topics');
    
    console.log('\n🧪 Test 3: Query với ORDER BY...');
    const orderedTopics = await models.Topic.findAll({
      where: { isActive: true },
      order: [['display_order', 'ASC'], ['created_at', 'DESC']]
    });
    console.log('✅ Success! Found', orderedTopics.length, 'ordered topics');
    
    if (orderedTopics.length > 0) {
      console.log('\n📋 Sample topic:');
      console.log(JSON.stringify(orderedTopics[0].toJSON(), null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testTopicQuery();
