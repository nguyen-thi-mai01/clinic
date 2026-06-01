// server/middleware/roleMiddleware.js
// ✅ FIXED: Không query lại user - sử dụng req.user từ authenticateToken

/**
 * ✅ Middleware kiểm tra quyền truy cập theo role
 * SỬ DỤNG req.user từ authenticateToken - KHÔNG query lại DB
 * 
 * @param {Array} allowedRoles - Danh sách các role được phép truy cập
 * @returns {Function} Middleware function
 */
const roleMiddleware = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // ✅ Kiểm tra đã authenticate chưa
      if (!req.user || !req.user.id) {
        return res.status(401).json({ 
          success: false,
          message: 'Chưa xác thực. Vui lòng đăng nhập.' 
        });
      }

      // ✅ SỬ DỤNG TRỰC TIẾP req.user - KHÔNG QUERY LẠI!
      // authenticateToken đã load và verify user rồi
      
      const user = req.user;

      // Kiểm tra trạng thái tài khoản (đã check trong authenticateToken)
      // Nhưng vẫn check lại để đảm bảo
      if (!user.is_active) {
        return res.status(403).json({ 
          success: false,
          message: 'Tài khoản đã bị khóa' 
        });
      }

      // ✅ Kiểm tra role có trong danh sách cho phép không
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          success: false,
          message: 'Bạn không có quyền truy cập chức năng này',
          requiredRoles: allowedRoles,
          currentRole: user.role
        });
      }

      // Không cần cập nhật req.user vì đã có sẵn từ authenticateToken
      next();

    } catch (error) {
      console.error('ERROR trong roleMiddleware:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Lỗi khi kiểm tra quyền truy cập', 
        error: error.message 
      });
    }
  };
};

module.exports = roleMiddleware;