// server/check-forum-permissions.js
// Script để kiểm tra permissions forum của staff

const { models } = require('./config/db');

async function checkForumPermissions() {
  try {
    console.log('\n=== KIỂM TRA FORUM PERMISSIONS ===\n');
    
    // Lấy tất cả staff thuộc Content và Support
    const staffList = await models.Staff.findAll({
      where: {
        department: ['content', 'support']
      },
      include: [{
        model: models.User,
        attributes: ['id', 'full_name', 'email', 'role']
      }],
      attributes: ['id', 'user_id', 'department', 'rank', 'permissions']
    });

    console.log(`Tìm thấy ${staffList.length} staff thuộc Content/Support:\n`);

    staffList.forEach(staff => {
      console.log('─'.repeat(80));
      console.log(`👤 Staff ID: ${staff.id}`);
      console.log(`   User ID: ${staff.user_id}`);
      console.log(`   Tên: ${staff.User?.full_name || 'N/A'}`);
      console.log(`   Email: ${staff.User?.email || 'N/A'}`);
      console.log(`   Department: ${staff.department}`);
      console.log(`   Rank: ${staff.rank}`);
      console.log(`   Permissions (raw):`);
      console.log(`   Type: ${typeof staff.permissions}`);
      console.log(`   Value: ${JSON.stringify(staff.permissions, null, 2)}`);
      
      // Parse permissions
      let perms = {};
      try {
        perms = typeof staff.permissions === 'string' 
          ? JSON.parse(staff.permissions) 
          : staff.permissions || {};
        
        console.log(`   Permissions (parsed):`);
        console.log(`   ${JSON.stringify(perms, null, 2)}`);
        
        if (perms.forum) {
          console.log(`   ✅ Có module forum`);
          console.log(`      Type: ${typeof perms.forum}`);
          console.log(`      Is Array: ${Array.isArray(perms.forum)}`);
          console.log(`      Value: ${JSON.stringify(perms.forum)}`);
          
          if (Array.isArray(perms.forum)) {
            console.log(`      Length: ${perms.forum.length}`);
            console.log(`      Permissions: ${perms.forum.join(', ')}`);
          }
        } else {
          console.log(`   ❌ KHÔNG có module forum`);
        }
      } catch (e) {
        console.log(`   ❌ Lỗi parse permissions: ${e.message}`);
      }
      
      console.log('');
    });

    console.log('─'.repeat(80));
    console.log('\n✅ Kiểm tra hoàn tất!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

checkForumPermissions();
