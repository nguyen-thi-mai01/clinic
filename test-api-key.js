#!/usr/bin/env node
require('dotenv').config({ path: './.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
console.log('🔑 API Key:', apiKey ? apiKey.substring(0, 20) + '...' : 'NOT SET');

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in .env');
  process.exit(1);
}

try {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
  console.log('✅ Model initialized successfully');
  
  // Try a very simple request
  model.generateContent('Hello')
    .then(res => {
      console.log('✅ API Key is valid!');
      console.log('Response:', res.response.text().substring(0, 50) + '...');
    })
    .catch(err => {
      console.error('❌ API Error:', err.message);
    });
} catch (err) {
  console.error('❌ Init Error:', err.message);
}
