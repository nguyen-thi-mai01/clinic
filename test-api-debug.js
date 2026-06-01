#!/usr/bin/env node
/**
 * Test API endpoints directly to debug issues
 */
require('dotenv').config({ path: './.env' });
const axios = require('axios');

const API_BASE = process.env.API_URL || 'http://localhost:3001';
let token = '';

async function login() {
  try {
    console.log('🔐 Đăng nhập admin...');
    const res = await axios.post(`${API_BASE}/api/users/login`, {
      email: 'admin1@example.com',
      password: '123456'
    });
    console.log('Login response:', JSON.stringify(res.data, null, 2));
    token = res.data.token || res.data.data?.token || res.data.data;
    console.log('✅ Token:', token.substring(0, 20) + '...\n');
    return token;
  } catch (err) {
    console.error('❌ Login failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

async function testSuggestDoctor() {
  try {
    console.log('🔍 Testing suggest-doctor endpoint (specialty_id=1)...');
    const res = await axios.get(`${API_BASE}/api/articles/suggest-doctor/1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    if (err.response?.status === 500) {
      console.log('Server Error - Check server console');
    }
  }
}

async function testAIAnalyze() {
  try {
    console.log('\n🤖 Testing AI analyze endpoint...');
    const res = await axios.post(`${API_BASE}/api/articles/ai-analyze`, {
      title: 'Test tiêu đề bài viết y khoa',
      content: 'Test nội dung bài viết về sức khỏe'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    if (err.response?.status === 500) {
      console.log('Server Error - Check server console');
    }
  }
}

async function run() {
  try {
    await login();
    await testSuggestDoctor();
    await testAIAnalyze();
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

run();
