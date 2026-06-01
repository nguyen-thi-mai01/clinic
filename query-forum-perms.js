// Quick SQL query to check forum permissions
const { sequelize } = require('./config/db');

async function queryPermissions() {
  try {
    const [results] = await sequelize.query(`
      SELECT 
        s.id as staff_id,
        s.user_id,
        u.full_name,
        u.email,
        s.department,
        s.rank,
        s.permissions
      FROM staff s
      JOIN users u ON s.user_id = u.id
      WHERE s.department IN ('content', 'support')
      ORDER BY s.id
    `);

    console.log('\n=== FORUM PERMISSIONS CHECK ===\n');
    
    results.forEach(row => {
      console.log('━'.repeat(80));
      console.log(`Staff #${row.staff_id} - ${row.full_name} (${row.email})`);
      console.log(`Department: ${row.department} | Rank: ${row.rank}`);
      console.log(`\nRAW permissions field:`);
      console.log(`  Type: ${typeof row.permissions}`);
      console.log(`  Value: ${row.permissions}`);
      
      try {
        const perms = typeof row.permissions === 'string' 
          ? JSON.parse(row.permissions) 
          : row.permissions;
          
        console.log(`\nPARSED permissions:`);
        console.log(JSON.stringify(perms, null, 2));
        
        if (perms && perms.forum) {
          console.log(`\n✅ HAS FORUM MODULE`);
          console.log(`  Type: ${typeof perms.forum}`);
          console.log(`  Is Array: ${Array.isArray(perms.forum)}`);
          console.log(`  Content: ${JSON.stringify(perms.forum)}`);
          
          if (Array.isArray(perms.forum)) {
            console.log(`  Length: ${perms.forum.length}`);
            console.log(`  Items: [${perms.forum.join(', ')}]`);
          }
        } else {
          console.log(`\n❌ NO FORUM MODULE`);
        }
      } catch (e) {
        console.log(`\n⚠️ Parse error: ${e.message}`);
      }
      
      console.log('');
    });
    
    console.log('━'.repeat(80));
    console.log('\n✅ Query complete\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

queryPermissions();
