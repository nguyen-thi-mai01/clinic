// ============================================
// 🧪 DEBUG SCRIPT - RUN IN BROWSER CONSOLE
// ============================================
// 
// Copy toàn bộ script này và paste vào Console của trình duyệt
// để debug permission system
//
// Cách dùng:
// 1. Mở trang web (đã đăng nhập)
// 2. Mở Developer Tools (F12)
// 3. Vào tab Console
// 4. Paste đoạn code này và Enter
// ============================================

(function() {
  console.clear();
  console.log('🔍 ============== PERMISSION DEBUG ==============');
  
  // 1. Kiểm tra localStorage
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    console.error('❌ Không có user trong localStorage!');
    console.log('💡 Hãy đăng nhập lại');
    return;
  }
  
  // 2. Parse user data
  let user;
  try {
    user = JSON.parse(userStr);
    console.log('✅ User data found in localStorage');
  } catch (e) {
    console.error('❌ Lỗi parse user JSON:', e);
    return;
  }
  
  // 3. Hiển thị thông tin user
  console.log('\n📋 USER INFORMATION:');
  console.log('  - Email:', user.email || 'N/A');
  console.log('  - Role:', user.role || 'N/A');
  console.log('  - Name:', user.full_name || user.username || 'N/A');
  
  // 4. Kiểm tra department (nếu là staff)
  if (user.role === 'staff') {
    console.log('  - Department:', user.department || user.role_info?.department || user.staff?.department || 'NOT FOUND');
    console.log('  - Rank:', user.role_info?.rank || user.staff?.rank || 'NOT FOUND');
  }
  
  // 5. LẤY PERMISSIONS
  console.log('\n🔐 PERMISSIONS ANALYSIS:');
  
  let permissions;
  if (user.role === 'admin') {
    console.log('👑 Admin - Full access to all modules');
    permissions = 'admin';
  } else if (user.role === 'staff') {
    // Thử nhiều nơi có thể chứa permissions
    permissions = user.role_info?.permissions || user.staff?.permissions || user.permissions;
    
    if (!permissions) {
      console.error('❌ KHÔNG TÌM THẤY PERMISSIONS!');
      console.log('   Đã kiểm tra các vị trí:');
      console.log('   - user.role_info.permissions:', user.role_info?.permissions);
      console.log('   - user.staff.permissions:', user.staff?.permissions);
      console.log('   - user.permissions:', user.permissions);
      console.log('\n💡 GỢI Ý: Staff chưa được cấu hình permissions');
      console.log('   Hãy vào trang Quản lý nhân sự để phân quyền');
      return;
    }
    
    console.log('✅ Permissions found!');
    console.log('\n📦 FULL PERMISSIONS OBJECT:');
    console.log(JSON.stringify(permissions, null, 2));
    
    // 6. Phân tích từng module
    console.log('\n🔍 MODULE-BY-MODULE BREAKDOWN:');
    const moduleKeys = Object.keys(permissions);
    
    if (moduleKeys.length === 0) {
      console.warn('⚠️ Permissions object rỗng!');
    } else {
      console.log(`   Tổng số modules: ${moduleKeys.length}`);
      console.log('   ───────────────────────────────────');
      
      moduleKeys.forEach(module => {
        const perms = permissions[module];
        console.log(`\n   📌 ${module}:`);
        
        if (Array.isArray(perms)) {
          console.log(`      Type: Array`);
          console.log(`      Actions: [${perms.join(', ')}]`);
        } else if (typeof perms === 'object') {
          console.log(`      Type: Object`);
          Object.entries(perms).forEach(([key, value]) => {
            console.log(`      - ${key}: ${value}`);
          });
        } else {
          console.log(`      Type: ${typeof perms}`);
          console.log(`      Value: ${perms}`);
        }
      });
    }
    
    // 7. Test các module quan trọng
    console.log('\n\n🎯 CRITICAL MODULES CHECK:');
    const criticalModules = ['services', 'consultations', 'consultation_pricing', 'system_settings'];
    
    criticalModules.forEach(module => {
      const hasAccess = permissions[module] !== undefined && permissions[module] !== null;
      const perms = permissions[module];
      
      if (hasAccess) {
        console.log(`   ✅ ${module}: `, perms);
      } else {
        console.log(`   ❌ ${module}: NOT CONFIGURED`);
      }
    });
    
  } else {
    console.log(`   Role: ${user.role} (không phải staff/admin)`);
  }
  
  // 8. Test canAccessModule logic
  if (permissions && permissions !== 'admin') {
    console.log('\n\n🧪 TESTING canAccessModule() LOGIC:');
    
    const testModules = ['services', 'consultations', 'consultation_pricing', 'system_settings'];
    
    testModules.forEach(module => {
      const modulePerms = permissions[module];
      let canAccess = false;
      
      if (modulePerms === true) {
        canAccess = true;
      } else if (Array.isArray(modulePerms) && modulePerms.length > 0) {
        canAccess = true;
      } else if (typeof modulePerms === 'object' && Object.values(modulePerms).some(v => v === true)) {
        canAccess = true;
      }
      
      console.log(`   ${module}: ${canAccess ? '✅ CAN ACCESS' : '❌ BLOCKED'}`);
    });
  }
  
  console.log('\n🔍 ============== END DEBUG ==============\n');
})();
