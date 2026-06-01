// Test script để kiểm tra routes có tồn tại không
const express = require('express');

// Clear require cache
delete require.cache[require.resolve('./routes/articleRoutes')];

const articleRoutes = require('./routes/articleRoutes');

console.log('\n🔍 Kiểm tra articleRoutes:');
console.log('Type:', typeof articleRoutes);
console.log('Is Router:', articleRoutes && articleRoutes.stack !== undefined);

if (articleRoutes && articleRoutes.stack) {
  console.log('\n📋 Danh sách routes:');
  articleRoutes.stack.forEach((layer, index) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
      console.log(`${index + 1}. ${methods} ${layer.route.path}`);
      
      // Highlight medicine/disease suggestion routes
      if (layer.route.path.includes('suggestions')) {
        console.log(`   ⭐ SUGGESTION ROUTE`);
      }
    }
  });
  
  // Tìm các route suggestions
  console.log('\n🎯 Medicine/Disease Suggestion Routes:');
  const suggestionRoutes = articleRoutes.stack.filter(layer => 
    layer.route && layer.route.path.includes('suggestions')
  );
  
  suggestionRoutes.forEach(layer => {
    const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
    console.log(`   ${methods} /api/articles${layer.route.path}`);
    console.log(`   Middlewares: ${layer.route.stack.length} handlers`);
  });
} else {
  console.log('❌ articleRoutes không phải Express Router!');
}

console.log('\n✅ Test hoàn tất!\n');
