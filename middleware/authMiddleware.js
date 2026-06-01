// server/middleware/authMiddleware.js
// Middleware xác thực JWT với cache nâng cao và request deduplication

const jwt = require('jsonwebtoken');
const { models } = require('../config/db');

//  LỚP 1: USER CACHE - Cache user data
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

//  LỚP 2: IN-FLIGHT REQUEST CACHE - Tránh query trùng lặp
const inflightRequests = new Map();

/**
 * Lấy user từ cache hoặc database với request deduplication
 */
const getUserById = async (userId) => {
  const now = Date.now();
  
  // Kiểm tra cache
  const cached = userCache.get(userId);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.user;
  }

  //  Kiểm tra có request đang chờ không (request deduplication)
  if (inflightRequests.has(userId)) {
    // Đợi request hiện tại hoàn thành
    return await inflightRequests.get(userId);
  }

  // Tạo promise mới cho request này
  const requestPromise = (async () => {
    try {
      // Query database
      const user = await models.User.findByPk(userId, {
        attributes: ['id', 'email', 'username', 'full_name', 'role', 'is_active', 'is_verified'],
        raw: true  // QUAN TRỌNG: Không trigger hooks
      });

      // Lưu vào cache
      if (user) {
        userCache.set(userId, {
          user,
          timestamp: now
        });
      }

      return user;
    } finally {
      // Xóa khỏi inflight sau khi hoàn thành
      inflightRequests.delete(userId);
    }
  })();

  // Lưu promise vào inflight
  inflightRequests.set(userId, requestPromise);

  return await requestPromise;
};

/**
 * Xóa cache của user
 */
const clearUserCache = (userId) => {
  userCache.delete(userId);
  inflightRequests.delete(userId);
};

/**
 * Xóa toàn bộ cache (dùng khi cần reset)
 */
const clearAllCache = () => {
  userCache.clear();
  inflightRequests.clear();
};


/**
 * Middleware xác thực JWT token (nới lỏng)
 * - Chỉ xác thực token và user tồn tại
 * - KHÔNG chặn khi user chưa verify hoặc chưa active
 * Dùng cho các tính năng ít nhạy cảm như đăng câu hỏi/đáp trong diễn đàn
 */
const authenticateTokenBasic = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Không tìm thấy token xác thực' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await models.User.findByPk(decoded.id);

    if (!user) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tài khoản không tồn tại' 
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      is_active: user.is_active,
      is_verified: user.is_verified
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.warn('WARN: Token không hợp lệ (basic):', error.message);
      return res.status(401).json({ success: false, message: 'Token không hợp lệ' });
    }
    if (error.name === 'TokenExpiredError') {
      console.warn('WARN: Token đã hết hạn (basic)');
      return res.status(401).json({ success: false, message: 'Token đã hết hạn' });
    }
    console.error('ERROR trong authenticateTokenBasic:', error);
    res.status(500).json({ success: false, message: 'Lỗi xác thực', error: error.message });
  }
};


/**
 * Middleware xác thực JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Không tìm thấy token xác thực' 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ 
          success: false, 
          message: 'Token đã hết hạn. Vui lòng đăng nhập lại.' 
        });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({ 
          success: false, 
          message: 'Token không hợp lệ' 
        });
      }
      throw err;
    }

    //  Lấy user từ cache với request deduplication
    const user = await getUserById(decoded.id);
    
    if (!user) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tài khoản không tồn tại' 
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tài khoản đã bị khóa' 
      });
    }

    if (!user.is_verified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tài khoản chưa được xác thực email' 
      });
    }

    // Gán user vào req
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      username: user.username,
      is_active: user.is_active,
      is_verified: user.is_verified
    };

    next();

  } catch (error) {
    console.error('ERROR trong authenticateToken:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi xác thực', 
      error: error.message 
    });
  }
};

/**
 * Middleware xác thực "Mềm" (Optional)
 * CẬP NHẬT: Cho phép khách vãng lai đi tiếp mà không ném lỗi 401
 */
const authenticateTokenOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null; // Khách vãng lai
      return next();
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      req.user = null; // Token lỗi coi như khách vãng lai
      return next();
    }

    const user = await getUserById(decoded.id);
    
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        is_active: user.is_active,
        is_verified: user.is_verified
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

/**
 * Middleware kiểm tra quyền theo role
 */
const authorize = (...allowedRoles) => {
  return async (req, res, next) => { // THÊM async để query DB
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Chưa xác thực' 
      });
    }

    // BẮT ĐẦU SỬA: Mở cổng thông minh
    // 1. Nếu user có role khớp với required roles -> Cho qua luôn
    if (allowedRoles.includes(req.user.role)) {
        return next();
    }

    // 2. NGOẠI LỆ ĐẶC BIỆT: Mở cổng cho Staff có quyền Quản lý nhân sự
    // Chỉ áp dụng ngoại lệ này cho các API thuộc module quản lý nhân sự (chứa /staff) để bảo mật
    if (allowedRoles.includes('admin') && req.user.role === 'staff' && req.originalUrl.includes('/staff')) {
        try {
            // Lấy object permissions của nhân viên này từ DB
            const staffProfile = await models.Staff.findOne({
                where: { user_id: req.user.id },
                attributes: ['permissions']
            });

            // Nếu có module staff_management và mảng quyền không rỗng -> Cấp phép đi qua!
            if (staffProfile && staffProfile.permissions && staffProfile.permissions.staff_management) {
                if (Array.isArray(staffProfile.permissions.staff_management) && staffProfile.permissions.staff_management.length > 0) {
                    return next(); 
                }
            }
        } catch (error) {
            console.error('Lỗi khi check smart authorize gate:', error);
        }
    }
    // KẾT THÚC SỬA

    // Nếu không thỏa mãn bất kỳ điều kiện nào, chặn với lỗi 403
    return res.status(403).json({ 
      success: false, 
      message: 'Bạn không có quyền truy cập chức năng này',
      requiredRoles: allowedRoles,
      currentRole: req.user.role
    });
  };
};

/**
 * Middleware kiểm tra ownership
 */
const checkOwnership = (req, res, next) => {
  const { userId } = req.params;
  
  if (req.user.role === 'admin') {
    return next();
  }

  if (parseInt(userId) !== req.user.id) {
    return res.status(403).json({ 
      success: false, 
      message: 'Bạn không có quyền truy cập tài nguyên này' 
    });
  }

  next();
};

//  Dọn dẹp cache định kỳ (mỗi 10 phút)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [userId, data] of userCache.entries()) {
    if (now - data.timestamp > CACHE_TTL) {
      userCache.delete(userId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
  }
}, 10 * 60 * 1000);

/**
 * Middleware kiểm tra role admin
 * Phải chạy sau authenticateToken
 */
const allowAdminOnly = async (req, res, next) => {
  try {
    console.log('[AUTH-MIDDLEWARE] allowAdminOnly - Checking admin role');
    if (!req.user) {
      console.log('[AUTH-MIDDLEWARE] ⚠️ No user in request');
      return res.status(401).json({ success: false, message: 'Unauthorized: No user in request' });
    }
    if (req.user.role !== 'admin') {
      console.log(`[AUTH-MIDDLEWARE] ❌ User ${req.user.id} (role: ${req.user.role}) không phải admin`);
      return res.status(403).json({ success: false, message: 'Forbidden: Admin role required' });
    }
    console.log(`[AUTH-MIDDLEWARE] ✅ Admin check passed for user ${req.user.id}`);
    next();
  } catch (error) {
    console.error('[AUTH-MIDDLEWARE] Error in allowAdminOnly:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  authenticateToken,
  authenticateTokenBasic,
  authenticateTokenOptional, //  XUẤT HÀM NÀY ĐỂ ROUTE SỬ DỤNG
  authMiddleware: authenticateToken,
  authorize,
  allowAdminOnly,
  checkOwnership,
  clearUserCache,
  clearAllCache
};