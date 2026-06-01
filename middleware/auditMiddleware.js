// server/middleware/auditMiddleware.js

const { models } = require('../config/db');

/**
 * Middleware để tự động ghi log audit trail
 * Attach vào req để controller có thể gọi
 */
const auditMiddleware = (req, res, next) => {
  /**
   * Helper function để log action
   * @param {Object} params - { action_type, target_type, target_id, target_name, details }
   */
  req.logAudit = async (params) => {
    try {
      const { action_type, target_type, target_id, target_name, details } = params;
      
      const auditData = {
        user_id: req.user?.id || null,
        action_type,
        target_type,
        target_id,
        target_name,
        details: details || {},
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('user-agent')
      };

      await models.AuditLog.create(auditData);
    } catch (error) {
      // Log error nhưng không throw để không ảnh hưởng request chính
      console.error('Audit log error:', error);
    }
  };

  next();
};

/**
 * Hàm helper để log từ bất kỳ đâu (không cần req)
 */
const createAuditLog = async (userId, params) => {
  try {
    const { action_type, target_type, target_id, target_name, details } = params;
    
    await models.AuditLog.create({
      user_id: userId,
      action_type,
      target_type,
      target_id,
      target_name,
      details: details || {},
      ip_address: null,
      user_agent: null
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

module.exports = { auditMiddleware, createAuditLog };
