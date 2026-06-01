// server/config/auditLogsSeed.js
const { models } = require('./db');

async function seedAuditLogs() {
  try {
    console.log(' Skipping Audit Logs seed (not needed)...');
    // Không seed audit logs - s? du?c t?o t? d?ng khi user th?c hi?n thay d?i
    return;
  } catch (error) {
    console.error('Error in seedAuditLogs:', error);
    throw error;
  }
}

module.exports = seedAuditLogs;

