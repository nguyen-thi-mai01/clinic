// server/controllers/userController.js
// Controller xử lý logic cho quản lý người dùng, đăng ký, đăng nhập, OTP, phân quyền
const { clearUserCache } = require('../middleware/authMiddleware');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op, Sequelize } = require('sequelize');
const { models, sequelize } = require('../config/db');
const { User, Patient, Doctor, Staff, Admin, Specialty } = models; 
const { getPermissionsTemplate } = require('../config/departmentPermissions');
const { findRoleProfileByPermissions } = require('../config/departmentRoleProfiles');
const { sendVerificationEmail, sendOTPEmail, sendPasswordResetEmail, sendPasswordResetRequestEmail, sendAccountVerifiedEmail   } = require('../utils/emailSender');
// Lưu trữ tạm thời số lần đăng nhập sai
const loginAttempts = new Map();
const LOCK_TIME = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;

// ============================================
// HELPER FUNCTIONS - Bổ sung từ articleController để nhất quán
// ============================================

/**
 * Tạo thông báo cho 1 user
 */
const createNotification = async (userId, type, message, link = null) => {
  try {
    await models.Notification.create({
      user_id: userId,
      type,
      message,
      link,
      is_read: false,
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log(` Đã tạo thông báo cho user ${userId}`);
  } catch (error) {
    console.error(' Lỗi khi tạo thông báo:', error.message);
    throw error;
  }
};

/**
 * Gửi thông báo đến tất cả admin đang hoạt động
 */
const notifyAllAdmins = async (type, message, link = null) => {
  try {
    const admins = await models.User.findAll({
      where: { 
        role: 'admin',
        is_active: true 
      },
      attributes: ['id']
    });

    if (admins.length === 0) {
      console.warn('⚠️ Không tìm thấy admin nào đang hoạt động trong hệ thống');
      return;
    }

    // Tạo thông báo cho từng admin
    for (const admin of admins) {
      await createNotification(admin.id, type, message, link);
    }
    
    console.log(` Đã gửi thông báo đến ${admins.length} admin`);
  } catch (error) {
    console.error(' Lỗi khi gửi thông báo đến admin:', error.message);
    throw error;
  }
};

// ============================================
// AUTHENTICATION - Đăng ký, đăng nhập, xác thực
// ============================================

// Hàm đăng ký người dùng mới
exports.register = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
  const { email, password, full_name, phone, address, gender, dob, role: requestedRole, specialty_id, department, rank } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email và mật khẩu là bắt buộc' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email không hợp lệ' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mật khẩu phải có ít nhất 6 ký tự' 
      });
    }

    const existingUser = await models.User.findOne({ 
      where: { email },
      transaction  //  THÊM transaction vào đây
    });
    if (existingUser) {
      await transaction.rollback();  //  THÊM rollback
      return res.status(400).json({ 
        success: false, 
        message: 'Email đã được sử dụng' 
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const verification_token = crypto.randomBytes(32).toString('hex');
    const verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Determine if this request is made by an admin (token present and role=admin)
    let isAdminCreator = false;
    try {
      const authHeader = req.headers['authorization'];
      if (authHeader) {
        const t = authHeader.split(' ')[1];
        if (t) {
          const decoded = jwt.verify(t, process.env.JWT_SECRET);
          if (decoded && decoded.role === 'admin') isAdminCreator = true;
        }
      }
    } catch (err) {
      // ignore token errors - treat as public register
      isAdminCreator = false;
    }

    // Tạo user trong transaction
    const finalRole = isAdminCreator && requestedRole ? requestedRole : 'patient';
    const newUser = await models.User.create({
      email,
      password_hash,
      full_name: full_name || null,
      phone: phone || null,
      address: address || null,
      gender: gender || null,
      dob: dob || null,
      role: finalRole,
      is_verified: isAdminCreator ? true : false,
      verification_token: isAdminCreator ? null : verification_token,
      verification_expires: isAdminCreator ? null : verification_expires,
      is_active: isAdminCreator ? true : false
    }, { transaction });

    // If admin created and role requires extra profile, fill/update the role record that
    // the User.afterCreate hook already created. Use find-or-create/update to avoid duplicates.
    if (isAdminCreator && finalRole === 'doctor') {
      const existingDoctor = await models.Doctor.findOne({ where: { user_id: newUser.id }, transaction });
      if (existingDoctor) {
        if (specialty_id !== undefined) existingDoctor.specialty_id = specialty_id || null;
        await existingDoctor.save({ transaction });
      } else {
        await models.Doctor.create({ user_id: newUser.id, specialty_id: specialty_id || null }, { transaction });
      }
    }

    if (isAdminCreator && finalRole === 'staff') {
      const perms = getPermissionsTemplate(department || null, rank || 'staff');
      const existingStaff = await models.Staff.findOne({ where: { user_id: newUser.id }, transaction });
      if (existingStaff) {
        existingStaff.department = department || null;
        existingStaff.rank = rank || 'staff';
        existingStaff.permissions = perms;
        await existingStaff.save({ transaction });
      } else {
        await models.Staff.create({ user_id: newUser.id, department: department || null, rank: rank || 'staff', permissions: perms }, { transaction });
      }
    }

    await transaction.commit();

    // Gửi email xác thực
    try {
      const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verification_token}`;
      await sendVerificationEmail(email, full_name || email, verificationLink);
      console.log('Email xác thực đã gửi đến:', email);
    } catch (emailError) {
      console.error('Không thể gửi email xác thực:', emailError.message);
      return res.status(201).json({
        success: true,
        message: 'Đăng ký thành công nhưng không thể gửi email xác thực. Vui lòng liên hệ admin để kích hoạt tài khoản.',
        userId: newUser.id,
        emailError: true
      });
    }

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      userId: newUser.id
    });

  } catch (error) {
    await transaction.rollback();
    console.error('ERROR trong register:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Dữ liệu không hợp lệ',
        error: error.errors.map(e => e.message).join(', ')
      });
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Email đã tồn tại trong hệ thống',
        error: error.message
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi đăng ký người dùng', 
      error: error.message 
    });
  }
};

// Hàm xác thực email
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  console.log('[verifyEmail] Nhận token:', token);

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Token xác thực không được cung cấp'
    });
  }

  try {
    const user = await models.User.findOne({
      where: { verification_token: token }
    });

    console.log('[verifyEmail] Tìm user:', user ? user.email : 'Không tìm thấy');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token không hợp lệ hoặc đã được sử dụng'
      });
    }

    // Kiểm tra token hết hạn
    if (user.verification_expires && new Date() > new Date(user.verification_expires)) {
      return res.status(400).json({
        success: false,
        message: 'Token đã hết hạn. Vui lòng yêu cầu gửi lại email xác thực.'
      });
    }

    // Kiểm tra đã verified chưa
    if (user.is_verified) {
      return res.status(200).json({
        success: true,
        message: 'Tài khoản đã được xác thực trước đó. Bạn có thể đăng nhập ngay.'
      });
    }

    // Cập nhật trạng thái
    await user.update({
      is_verified: true,
      is_active: true,
      verification_token: null,
      verification_expires: null
    });

    console.log('[verifyEmail] Xác thực thành công cho:', user.email);

    // GỬI EMAIL THÔNG BÁO ĐÃ XÁC THỰC (qua email)
    try {
      await sendAccountVerifiedEmail(
        user.email,
        user.full_name || user.username,
        'email' // Phương thức: tự xác thực qua email
      );
      console.log(`Đã gửi email thông báo xác thực đến ${user.email}`);
    } catch (emailError) {
      console.error('Không thể gửi email thông báo xác thực:', emailError.message);
      // Không throw error vì xác thực đã thành công
    }

    return res.status(200).json({
      success: true,
      message: 'Xác thực email thành công! Tài khoản đã được kích hoạt.'
    });

  } catch (error) {
    console.error('[verifyEmail] LỖI:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xác thực email'
    });
  }
};

// Hàm đăng nhập
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng nhập đầy đủ email và mật khẩu' 
      });
    }

    // Tìm user
    const user = await models.User.findOne({ 
      where: { email },
      attributes: ['id', 'email', 'username', 'password_hash', 'full_name', 'role', 
                   'is_verified', 'is_active', 'avatar_url', 'last_login']
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email hoặc mật khẩu không chính xác' 
      });
    }

    // Kiểm tra mật khẩu
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email hoặc mật khẩu không chính xác' 
      });
    }

    // Kiểm tra xác thực email
    if (!user.is_verified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tài khoản chưa được xác thực email. Vui lòng kiểm tra email để xác thực.' 
      });
    }

    // Kiểm tra tài khoản có bị khóa không
    if (!user.is_active) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' 
      });
    }

    // === LẤY THÔNG TIN PERMISSIONS TRƯỚC KHI TẠO TOKEN ===
    let userPermissions = null;
    if (user.role === 'staff') {
      const staffProfile = await models.Staff.findOne({ where: { user_id: user.id } });
      if (staffProfile) userPermissions = staffProfile.permissions;
    } else if (user.role === 'doctor') {
      const doctorProfile = await models.Doctor.findOne({ where: { user_id: user.id } });
      userPermissions = doctorProfile?.permissions || { 
        articles: [
          'view', 
          'create', 
          'suggest_medicine', // Khớp lệnh với Frontend
          'suggest_disease'   // Khớp lệnh với Frontend
        ] 
      };
    }

    //  TẠO JWT TOKEN VỚI PERMISSIONS
    // Token hết hạn sau 7 ngày (có thể thay đổi: '1d', '12h', '30d')
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        permissions: userPermissions //  THÊM PERMISSIONS VÀO TOKEN
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '7d', //  Token hết hạn sau 7 ngày
        issuer: 'your-app-name', // Tùy chọn
        audience: 'your-app-users' // Tùy chọn
      }
    );

    // Cập nhật last_login
    //  Cập nhật last_login - KHÔNG trigger hooks
    await models.User.update(
      { last_login: new Date() },
      { 
        where: { id: user.id },
        hooks: false,  // TẮT hooks
        silent: true   // Không trigger afterUpdate
      }
    );

    // === [SỬA MỚI] LẤY THÊM THÔNG TIN CHI TIẾT STAFF/DOCTOR ===
    let extraProfile = {};
    if (user.role === 'staff') {
      const staffProfile = await models.Staff.findOne({ where: { user_id: user.id } });
      if (staffProfile) {
        const matchedProfile = findRoleProfileByPermissions(
          staffProfile.department,
          staffProfile.permissions,
          staffProfile.job_description
        );
        extraProfile.staff = staffProfile;       // Để Frontend truy cập user.staff
        extraProfile.department = staffProfile.department; // Để Frontend truy cập user.department
        //  THÊM: role_info với permissions để frontend dễ access
        extraProfile.role_info = {
          department: staffProfile.department,
          rank: staffProfile.rank,
          permissions: staffProfile.permissions,
          role_profile: matchedProfile?.code || null,
          role_name: matchedProfile?.name || staffProfile.job_description || null,
          job_description: staffProfile.job_description || null
        };
      }
    } else if (user.role === 'doctor') {
      const doctorProfile = await models.Doctor.findOne({ where: { user_id: user.id } });
      if (doctorProfile) {
        extraProfile.doctor = doctorProfile;
      }
    }
    // ==========================================================

    // Trả về thông tin user (không trả password_hash)
    const userResponse = {
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      avatar_url: user.avatar_url,
      is_verified: user.is_verified,
      is_active: user.is_active,
      ...extraProfile // <-- BỔ SUNG DÒNG NÀY ĐỂ GỘP department VÀO
    };

    console.log(` User ${email} đăng nhập thành công với role ${user.role}`);

    res.status(200).json({ 
      success: true, 
      message: 'Đăng nhập thành công',
      token,
      user: userResponse,
      expiresIn: '7d' //  Gửi thông tin thời gian hết hạn cho client
    });

  } catch (error) {
    console.error('ERROR trong login:', error);
    next(error);
  }
};


// Thêm hàm gửi lại email xác thực
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email là bắt buộc'
      });
    }

    const user = await models.User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản với email này'
      });
    }

    if (user.is_verified) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản đã được xác thực'
      });
    }

    // Tạo token mới nếu token cũ hết hạn
    let verification_token = user.verification_token;
    let verification_expires = user.verification_expires;

    if (!verification_token || new Date() > verification_expires) {
      verification_token = crypto.randomBytes(32).toString('hex');
      verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await user.update({
        verification_token,
        verification_expires
      });
    }

    const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verification_token}`;

    await sendVerificationEmail(email, user.full_name || user.username, verificationLink);

    res.status(200).json({
      success: true,
      message: 'Email xác thực đã được gửi lại thành công. Vui lòng kiểm tra hộp thư.'
    });
  } catch (error) {
    console.error('ERROR trong resendVerification:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi lại email xác thực',
      error: error.message
    });
  }
};

// POST /users/request-manual-verification - Yêu cầu admin xác thực thủ công
exports.requestManualVerification = async (req, res) => {
  try {
    const { email, reason } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email là bắt buộc'
      });
    }

    // Tìm user theo email
    const user = await models.User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản với email này'
      });
    }

    // Kiểm tra user đã được xác thực và kích hoạt chưa
    if (user.is_verified && user.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản đã được xác thực và kích hoạt'
      });
    }

    // Gửi thông báo đến tất cả admin với link dẫn đến popup chi tiết user
    await notifyAllAdmins(
      'system',
      `Yêu cầu xác thực tài khoản: ${user.email} (${user.full_name || 'Chưa cập nhật'})${reason ? ` - Lý do: ${reason}` : ''}`,
      `/quan-ly-nguoi-dung?userId=${user.id}`
    );

    console.log(` Đã gửi yêu cầu xác thực đến admin cho user: ${user.email} (ID: ${user.id})`);

    res.status(200).json({
      success: true,
      message: 'Đã gửi yêu cầu xác thực đến admin. Bạn sẽ nhận được thông báo khi tài khoản được kích hoạt.'
    });
    
  } catch (error) {
    console.error(' ERROR trong requestManualVerification:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi yêu cầu đến admin',
      error: error.message
    });
  }
};

// // ============================================
// PASSWORD RESET - Quên mật khẩu, đặt lại mật khẩu
// ============================================

// Gửi email xác thực reset password
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email là bắt buộc' 
      });
    }

    console.log('[requestPasswordReset] Email nhận được:', email);

    const user = await models.User.findOne({ where: { email } });
    
    if (!user) {
      // Không tiết lộ email có tồn tại hay không vì lý do bảo mật
      console.log('[requestPasswordReset] Email không tồn tại:', email);
      return res.status(200).json({ 
        success: true, 
        message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được email hướng dẫn đặt lại mật khẩu.' 
      });
    }

    // Tạo reset token
    const reset_token = crypto.randomBytes(32).toString('hex');
    const reset_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 giờ

    console.log('[requestPasswordReset] Token tạo ra:', reset_token);
    console.log('[requestPasswordReset] Expires:', reset_expires);

    // Lưu token vào database
    user.reset_token = reset_token;
    user.reset_expires = reset_expires;
    await user.save();

      // Nếu user đã là staff, cho phép cập nhật department/rank/permissions khi admin gửi
      if (user.role === 'staff' && (department !== undefined || rank !== undefined)) {
        const staff = await models.Staff.findOne({ where: { user_id: userId } });
        if (staff) {
          if (department !== undefined) staff.department = department;
          if (rank !== undefined) staff.rank = rank;
          // Cập nhật permissions theo template khi department/rank thay đổi
          try {
            staff.permissions = getPermissionsTemplate(staff.department || null, staff.rank || 'staff');
          } catch (err) {
            // Nếu template không hợp lệ, giữ nguyên permissions hiện có
            console.warn('Không thể cập nhật permissions từ template:', err.message);
          }
          await staff.save();
        } else {
          // Nếu chưa có bản ghi staff (hiếm), tạo mới
          const perms = getPermissionsTemplate(department || null, rank || 'staff');
          await models.Staff.create({ user_id: userId, department: department || null, rank: rank || 'staff', permissions: perms });
        }
      }

    console.log('[requestPasswordReset] Đã lưu token vào DB');

    // Gửi email xác thực reset password
    try {
      const resetLink = `${process.env.CLIENT_URL}/xac-thuc-dat-lai-mat-khau?token=${reset_token}`;
      
      console.log('[requestPasswordReset] Reset link:', resetLink);
      
      // Gọi hàm gửi email - SỬA TÊN HÀM CHO ĐÚNG
      await sendPasswordResetRequestEmail(email, user.full_name || email, resetLink);
      
      console.log('[requestPasswordReset] Email đã gửi thành công đến:', email);
      
      return res.status(200).json({
        success: true,
        message: 'Chúng tôi đã gửi email xác thực đến địa chỉ của bạn. Vui lòng kiểm tra hộp thư.'
      });
      
    } catch (emailError) {
      console.error('[requestPasswordReset] Lỗi gửi email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Không thể gửi email. Vui lòng thử lại sau.',
        error: emailError.message
      });
    }
    
  } catch (error) {
    console.error('[requestPasswordReset] ERROR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi xử lý yêu cầu đặt lại mật khẩu', 
      error: error.message 
    });
  }
};

// Xác thực token reset password
exports.verifyResetToken = async (req, res) => {
  try {
    const { token } = req.query;

    console.log('[verifyResetToken] Token nhận được:', token);

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token không hợp lệ' 
      });
    }

    const user = await models.User.findOne({ 
      where: { reset_token: token } 
    });

    if (!user) {
      console.log('[verifyResetToken] Token không tồn tại');
      return res.status(400).json({ 
        success: false, 
        message: 'Token không tồn tại hoặc đã được sử dụng' 
      });
    }

    if (user.reset_expires && new Date() > user.reset_expires) {
      console.log('[verifyResetToken] Token đã hết hạn');
      return res.status(400).json({ 
        success: false, 
        message: 'Token đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới.' 
      });
    }

    console.log('[verifyResetToken] Token hợp lệ cho user:', user.email);

    res.status(200).json({
      success: true,
      message: 'Token hợp lệ. Bạn có thể đặt lại mật khẩu.',
      email: user.email
    });

  } catch (error) {
    console.error('[verifyResetToken] ERROR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi xác thực token', 
      error: error.message 
    });
  }
};

// Đặt lại mật khẩu mới (sau khi xác thực token)
exports.resetPasswordWithToken = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    console.log('[resetPasswordWithToken] Token:', token);

    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token và mật khẩu mới là bắt buộc' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mật khẩu phải có ít nhất 6 ký tự' 
      });
    }

    const user = await models.User.findOne({ 
      where: { reset_token: token } 
    });

    if (!user) {
      console.log('[resetPasswordWithToken] Token không hợp lệ');
      return res.status(400).json({ 
        success: false, 
        message: 'Token không hợp lệ hoặc đã được sử dụng' 
      });
    }

    if (user.reset_expires && new Date() > user.reset_expires) {
      console.log('[resetPasswordWithToken] Token đã hết hạn');
      return res.status(400).json({ 
        success: false, 
        message: 'Token đã hết hạn' 
      });
    }

    // Cập nhật mật khẩu mới
    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.reset_token = null;
    user.reset_expires = null;
    await user.save();

    console.log('[resetPasswordWithToken] Đã đổi mật khẩu cho user:', user.email);

    // Gửi email thông báo
    try {
      await sendPasswordResetEmail(user.email, user.full_name || user.email);
      console.log('[resetPasswordWithToken] Đã gửi email thông báo');
    } catch (emailError) {
      console.error('[resetPasswordWithToken] Lỗi gửi email thông báo:', emailError);
    }

    res.status(200).json({ 
      success: true, 
      message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập với mật khẩu mới.' 
    });

  } catch (error) {
    console.error('[resetPasswordWithToken] ERROR:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi đặt lại mật khẩu', 
      error: error.message 
    });
  }
};

// ============================================
// USER PROFILE - Quản lý thông tin cá nhân
// ============================================

// Lấy thông tin profile của chính mình
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    // 1. Lấy thông tin User cơ bản
    const user = await models.User.findByPk(userId, {
      attributes: { exclude: ['password_hash', 'reset_token', 'verification_token'] },
      raw: true
    });

    if (!user) return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });

    // 2. Lấy thêm thông tin chi tiết (Staff/Doctor)
    if (user.role === 'staff') {
      const staffProfile = await models.Staff.findOne({ 
        where: { user_id: userId },
        raw: true 
      });
      if (staffProfile) {
        user.staff = staffProfile;
        user.department = staffProfile.department;
        user.role_info = {
          department: staffProfile.department,
          rank: staffProfile.rank,
          permissions: staffProfile.permissions
        };
      }
    } else if (user.role === 'doctor') {
      const doctorProfile = await models.Doctor.findOne({ 
        where: { user_id: userId },
        raw: true
      });
      if (doctorProfile) {
        user.doctor = doctorProfile;
        // Không gán department cho bác sĩ, chỉ dùng specialty
      }
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('ERROR getProfile:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// Lấy thông tin role (quan trọng để fill form)
exports.getMyRoleInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await models.User.findByPk(userId, {
      attributes: { exclude: ['password_hash'] },
      raw: true
    });

    if (!user) return res.status(404).json({ success: false, message: 'User không tồn tại' });

    let roleData = null;
    if (user.role === 'doctor') {
      roleData = await models.Doctor.findOne({ 
        where: { user_id: userId },
        include: [{ model: models.Specialty, as: 'specialty', required: false }]
      });
    } else if (user.role === 'patient') {
      roleData = await models.Patient.findOne({ where: { user_id: userId } });
    } else if (user.role === 'staff') {
      roleData = await models.Staff.findOne({ 
        where: { user_id: userId },
        include: [
          // Nếu nhân viên có cấp trên, lấy tên cấp trên
          { model: models.Staff, as: 'manager', include: [{ model: models.User, attributes: ['full_name'] }] },
          // Lấy thông tin các bác sĩ mà nhân viên này quản lý (nếu department là clinical)
          { model: models.Doctor, as: 'managedDoctors', include: [{model: models.User, as: 'user', attributes: ['full_name', 'avatar_url']}] }
        ]
      });
    } else if (user.role === 'admin') {
      roleData = await models.Admin.findOne({ where: { user_id: userId } });
    }

    const userData = { ...user };
    userData.roleData = roleData; // Sequelize tự parse JSON fields thành object/array

    res.status(200).json({ success: true, user: userData });
  } catch (error) {
    console.error('ERROR getMyRoleInfo:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy thông tin role', error: error.message });
  }
};

// Cập nhật profile (Fix logic lưu JSON)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      full_name, phone, address, gender, dob, avatar_url, // User basic
      specialty_id, experience_years, bio, title, position, workplace, // Doctor basic
      education, certifications, work_experience, research, achievements // Doctor JSON arrays
    } = req.body;

    const user = await models.User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User không tồn tại' });

    // 1. Cập nhật bảng User
    if (full_name !== undefined) user.full_name = full_name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (gender !== undefined) user.gender = gender;
    if (dob !== undefined) user.dob = dob;
    if (avatar_url !== undefined) user.avatar_url = avatar_url;
    await user.save();

    // 2. Cập nhật bảng Doctor (nếu là bác sĩ)
    if (user.role === 'doctor') {
      const doctor = await models.Doctor.findOne({ where: { user_id: userId } });
      if (doctor) {
        // Basic fields
        if (specialty_id !== undefined) doctor.specialty_id = specialty_id;
        if (experience_years !== undefined) doctor.experience_years = experience_years;
        if (bio !== undefined) doctor.bio = bio;
        if (title !== undefined) doctor.title = title;
        if (position !== undefined) doctor.position = position;
        if (workplace !== undefined) doctor.workplace = workplace;
        
        // JSON Fields - Sequelize tự động stringify khi lưu nếu model định nghĩa là DataTypes.JSON
        if (education !== undefined) doctor.education = education;
        if (certifications !== undefined) doctor.certifications = certifications;
        if (work_experience !== undefined) doctor.work_experience = work_experience;
        if (research !== undefined) doctor.research = research;
        if (achievements !== undefined) doctor.achievements = achievements;

        await doctor.save();
      }
    }

    res.status(200).json({ 
      success: true, 
      message: 'Cập nhật thông tin thành công', 
      user: { ...user.toJSON() } 
    });
  } catch (error) {
    console.error('ERROR updateProfile:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật', error: error.message });
  }
};

// Lấy thông tin role của chính mình (bao gồm code và specialty cho doctor)
exports.getMyRoleInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await models.User.findByPk(userId, {
      attributes: { exclude: ['password_hash', 'reset_token', 'verification_token'] },
      raw: true
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Người dùng không tồn tại' 
      });
    }

    let roleData = null;
    if (user.role === 'patient') {
      roleData = await models.Patient.findOne({ where: { user_id: userId } });
    } else if (user.role === 'staff') {
      roleData = await models.Staff.findOne({ 
        where: { user_id: userId },
        include: [
          // Nếu nhân viên có cấp trên, lấy tên cấp trên
          { model: models.Staff, as: 'manager', include: [{ model: models.User, attributes: ['full_name'] }] },
          // Lấy thông tin các bác sĩ mà nhân viên này quản lý (nếu department là clinical)
          { model: models.Doctor, as: 'managedDoctors', include: [{model: models.User, as: 'user', attributes: ['full_name', 'avatar_url']}] }
        ]
      });
    
    } else if (user.role === 'doctor') {
      roleData = await models.Doctor.findOne({ 
        where: { user_id: userId },
        include: [{ 
          model: models.Specialty,
          as: 'specialty',
          required: false 
        }]
      });
    } else if (user.role === 'admin') {
      roleData = await models.Admin.findOne({ where: { user_id: userId } });
    }

    const userData = { ...user };
    userData.roleData = roleData;

    res.status(200).json({ success: true, user: userData });
  } catch (error) {
    console.error('ERROR trong getMyRoleInfo:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thông tin role', error: error.message });
  }
};

// Cập nhật thông tin profile của chính mình (bao gồm cả thông tin doctor)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      // Thông tin User cơ bản
      full_name, 
      phone, 
      address, 
      gender, 
      dob, 
      avatar_url,
      
      // Thông tin Doctor - Cơ bản
      specialty_id,
      experience_years,
      bio,
      
      // Thông tin Doctor - Profile mở rộng
      title,
      position,
      workplace,
      specializations,
      achievements,
      education,
      certifications,
      work_experience,
      research,

      // Thông tin Staff
      job_description
    } = req.body;

    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    // Cập nhật thông tin cơ bản User
    if (full_name !== undefined) user.full_name = full_name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (gender !== undefined) user.gender = gender;
    if (dob !== undefined) user.dob = dob;
    if (avatar_url !== undefined) user.avatar_url = avatar_url;

    await user.save();

    // Nếu là bác sĩ - Cập nhật thông tin chuyên môn
    if (user.role === 'doctor') {
      const doctor = await models.Doctor.findOne({ where: { user_id: userId } });
      
      if (doctor) {
        // Cập nhật các trường cơ bản
        if (specialty_id !== undefined) doctor.specialty_id = specialty_id;
        if (experience_years !== undefined) doctor.experience_years = experience_years;
        if (bio !== undefined) doctor.bio = bio;
        
        // Cập nhật profile mở rộng - String
        if (title !== undefined) doctor.title = title;
        if (position !== undefined) doctor.position = position;
        if (workplace !== undefined) doctor.workplace = workplace;
        
        // Cập nhật profile mở rộng - JSON Arrays
        // BỎ: languages, hospital_affiliations, memberships
        if (specializations !== undefined) doctor.specializations = specializations;
        if (achievements !== undefined) doctor.achievements = achievements;
        
        // Cập nhật profile mở rộng - JSON Objects/Arrays
        if (education !== undefined) doctor.education = education;
        if (certifications !== undefined) doctor.certifications = certifications;
        if (work_experience !== undefined) doctor.work_experience = work_experience;
        if (research !== undefined) doctor.research = research;
        
        await doctor.save();
        console.log(` Đã cập nhật thông tin bác sĩ cho user ${userId}`);
      }
    }

    // Nếu là nhân viên - Cập nhật job_description nếu có
    if (user.role === 'staff') {
      const staff = await models.Staff.findOne({ where: { user_id: userId } });
      if (staff) {
        if (job_description !== undefined) {
          staff.job_description = job_description;
        }
        await staff.save();
        console.log(` Đã cập nhật thông tin nhân viên cho user ${userId}`);
      }
    }

    res.status(200).json({ 
      success: true, 
      message: 'Cập nhật thông tin thành công', 
      user: { 
        id: user.id, 
        email: user.email, 
        full_name: user.full_name, 
        phone: user.phone, 
        address: user.address, 
        gender: user.gender, 
        dob: user.dob, 
        avatar_url: user.avatar_url 
      } 
    });
  } catch (error) {
    console.error('ERROR trong updateProfile:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thông tin', error: error.message });
  }
};

// Đổi mật khẩu
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại và mật khẩu mới là bắt buộc' });
    }
    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
    }
    user.password_hash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.status(200).json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('ERROR trong changePassword:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi đổi mật khẩu', error: error.message });
  }
};

// ============================================
// USER MANAGEMENT - Quản lý người dùng (Admin only)
// ============================================

// Lấy tất cả người dùng
exports.getAllUsers = async (req, res) => {
  try {
    const users = await models.User.findAll({
      attributes: { exclude: ['password_hash', 'reset_token', 'verification_token'] }
    });
    res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    console.error('ERROR trong getAllUsers:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách người dùng', error: error.message });
  }
};

// Lấy thông tin người dùng theo ID (Admin only)
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await models.User.findByPk(userId, {
      attributes: { exclude: ['password_hash', 'reset_token', 'verification_token'] }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    let roleData = null;
    if (user.role === 'patient') {
      roleData = await models.Patient.findOne({ where: { user_id: userId } });
    } else if (user.role === 'staff') {
      roleData = await models.Staff.findOne({ 
        where: { user_id: userId },
        include: [
          // Nếu nhân viên có cấp trên, lấy tên cấp trên
          { model: models.Staff, as: 'manager', include: [{ model: models.User, attributes: ['full_name'] }] },
          // Lấy thông tin các bác sĩ mà nhân viên này quản lý (nếu department là clinical)
          { model: models.Doctor, as: 'managedDoctors', include: [{model: models.User, as: 'user', attributes: ['full_name', 'avatar_url']}] }
        ]
      });
    
    } else if (user.role === 'doctor') {
      roleData = await models.Doctor.findOne({ 
        where: { user_id: userId },
        include: [{ model: models.Specialty,
          as: 'specialty',
          required: false }]
      });
    } else if (user.role === 'admin') {
      roleData = await models.Admin.findOne({ where: { user_id: userId } });
    }

    const userData = user.toJSON();
    userData.roleData = roleData;

    res.status(200).json({ success: true, user: userData });
  } catch (error) {
    console.error('ERROR trong getUserById:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thông tin người dùng', error: error.message });
  }
};

// Cập nhật thông tin người dùng (Admin only)
exports.updateUser = async (req, res) => {
  try {
  const { userId } = req.params;
  const { full_name, phone, address, gender, dob, role, specialty_id, department, rank, job_description } = req.body;

    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Người dùng không tồn tại' 
      });
    }

    // Cập nhật thông tin cơ bản
    if (full_name !== undefined) user.full_name = full_name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (gender !== undefined) user.gender = gender;
    if (dob !== undefined) user.dob = dob;

    // Nếu đổi role
    if (role !== undefined && role !== user.role) {
      // Xóa record role cũ
      if (user.role === 'patient') await models.Patient.destroy({ where: { user_id: userId } });
      if (user.role === 'staff') await models.Staff.destroy({ where: { user_id: userId } });
      if (user.role === 'doctor') await models.Doctor.destroy({ where: { user_id: userId } });
      if (user.role === 'admin') await models.Admin.destroy({ where: { user_id: userId } });

      user.role = role;

      // Tạo record role mới
      if (role === 'patient') await models.Patient.create({ user_id: userId });
      if (role === 'staff') {
        const perms = getPermissionsTemplate(department || null, rank || 'staff');
        await models.Staff.create({ user_id: userId, department: department || null, rank: rank || 'staff', permissions: perms, job_description: job_description || null });
      }
      if (role === 'doctor') {
        await models.Doctor.create({ 
          user_id: userId, 
          specialty_id: specialty_id || null 
        });
      }
      if (role === 'admin') await models.Admin.create({ user_id: userId, permissions_json: null });
    }

    // Nếu user đã là doctor, cho phép cập nhật specialty_id
    if (user.role === 'doctor' && specialty_id !== undefined) {
      const doctor = await models.Doctor.findOne({ where: { user_id: userId } });
      if (doctor) {
        doctor.specialty_id = specialty_id;
        await doctor.save();
      }
    }

    // Nếu user đã là staff, cho phép cập nhật job_description
    if (user.role === 'staff' && job_description !== undefined) {
      const staff = await models.Staff.findOne({ where: { user_id: userId } });
      if (staff) {
        staff.job_description = job_description;
        await staff.save();
      }
    }

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: 'Cập nhật thông tin thành công', 
      user: { 
        id: user.id, 
        email: user.email, 
        full_name: user.full_name, 
        role: user.role,
        is_active: user.is_active 
      } 
    });
  } catch (error) {
    console.error('ERROR trong updateUser:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi cập nhật người dùng', 
      error: error.message 
    });
  }
};

exports.updateDoctorPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      full_name,
      phone,
      gender,
      dob,
      avatar_url,
      specialty_id,
      experience_years,
      bio,
      title,
      position,
      workplace,
      specializations,
      education,
      certifications,
      work_experience,
      research,
      achievements,
      work_status,
      schedule_preference_type
    } = req.body;

    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    if (user.role !== 'doctor') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể cập nhật hồ sơ bác sĩ' });
    }

    if (full_name !== undefined) user.full_name = full_name;
    if (phone !== undefined) user.phone = phone;
    if (gender !== undefined) user.gender = gender;
    if (dob !== undefined) user.dob = dob;
    if (avatar_url !== undefined) user.avatar_url = avatar_url;

    let doctor = await models.Doctor.findOne({ where: { user_id: userId } });
    if (!doctor) {
      doctor = await models.Doctor.create({ user_id: userId, specialty_id: specialty_id || null });
    }

    if (specialty_id !== undefined) doctor.specialty_id = specialty_id || null;
    if (experience_years !== undefined) doctor.experience_years = experience_years === '' ? null : parseInt(experience_years, 10);
    if (bio !== undefined) doctor.bio = bio;
    if (title !== undefined) doctor.title = title;
    if (position !== undefined) doctor.position = position;
    if (workplace !== undefined) doctor.workplace = workplace;
    if (specializations !== undefined) doctor.specializations = specializations;
    if (education !== undefined) doctor.education = education;
    if (certifications !== undefined) doctor.certifications = certifications;
    if (work_experience !== undefined) doctor.work_experience = work_experience;
    if (research !== undefined) doctor.research = research;
    if (achievements !== undefined) doctor.achievements = achievements;
    if (work_status !== undefined) doctor.work_status = work_status;
    if (schedule_preference_type !== undefined) doctor.schedule_preference_type = schedule_preference_type;

    await user.save();
    await doctor.save();

    const refreshedDoctor = await models.Doctor.findOne({
      where: { user_id: userId },
      include: [{ model: models.Specialty, as: 'specialty', required: false }]
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ bác sĩ thành công',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        gender: user.gender,
        dob: user.dob,
        avatar_url: user.avatar_url,
        role: user.role,
        roleData: refreshedDoctor
      }
    });
  } catch (error) {
    console.error('ERROR trong updateDoctorPublicProfile:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật hồ sơ bác sĩ', error: error.message });
  }
};

// Xóa người dùng (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    if (user.role === 'patient') await models.Patient.destroy({ where: { user_id: userId } });
    if (user.role === 'staff') await models.Staff.destroy({ where: { user_id: userId } });
    if (user.role === 'doctor') await models.Doctor.destroy({ where: { user_id: userId } });
    if (user.role === 'admin') await models.Admin.destroy({ where: { user_id: userId } });

    await user.destroy();

    res.status(200).json({ success: true, message: 'Xóa người dùng thành công' });
  } catch (error) {
    console.error('ERROR trong deleteUser:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa người dùng', error: error.message });
  }
};

// Tìm kiếm người dùng
exports.searchUsers = async (req, res) => {
  try {
    const { keyword, role, is_active, is_verified, created_from, created_to, page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    
    const where = {};
    
    if (keyword) {
      where[Op.or] = [
        { email: { [Op.like]: `%${keyword}%` } },
        { full_name: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } }
      ];
    }

    if (role) where.role = role;
    if (is_active !== undefined) where.is_active = is_active === 'true';
    if (is_verified !== undefined) where.is_verified = is_verified === 'true';
    if (created_from || created_to) {
      where.created_at = {};
      if (created_from) {
        const fromDate = new Date(created_from);
        fromDate.setHours(0, 0, 0, 0);
        where.created_at[Op.gte] = fromDate;
      }
      if (created_to) {
        const toDate = new Date(created_to);
        toDate.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = toDate;
      }
    }

    const offset = (page - 1) * limit;

    // Validate sortBy and sortOrder to avoid SQL injection
    const allowedSortFields = ['id', 'email', 'created_at', 'role'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = ('' + sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const { count, rows } = await models.User.findAndCountAll({
      where,
      attributes: { exclude: ['password_hash', 'reset_token', 'verification_token'] },
      include: [
        { model: Staff, attributes: ['code'], required: false },
        { model: Doctor, attributes: ['code'], required: false },
        { model: Patient, attributes: ['code'], required: false },
        { model: Admin, attributes: ['code'], required: false }
      ],
      limit: parseInt(limit),
      offset: offset,
      order: [[sortField, sortDir]]
    });

    // Convert Sequelize instances to plain objects and flatten role-specific code into user.code
    const usersPlain = rows.map(r => {
      const u = r.get ? r.get({ plain: true }) : r;
      // Determine role-specific code (try different alias casings)
      u.code = (u.Admin && u.Admin.code) || (u.admin && u.admin.code) ||
               (u.Doctor && u.Doctor.code) || (u.doctor && u.doctor.code) ||
               (u.Staff && u.Staff.code) || (u.staff && u.staff.code) ||
               (u.Patient && u.Patient.code) || (u.patient && u.patient.code) ||
               null;
      return u;
    });

    res.status(200).json({
      success: true,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      users: usersPlain
    });
  } catch (error) {
    console.error('ERROR trong searchUsers:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tìm kiếm người dùng', error: error.message });
  }
};

// Lấy thống kê người dùng
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await models.User.count();
    const activeUsers = await models.User.count({ where: { is_active: true } });
    const verifiedUsers = await models.User.count({ where: { is_verified: true } });
    const inactiveUsers = Math.max(0, totalUsers - activeUsers);
    const verificationRate = totalUsers > 0 ? (verifiedUsers / totalUsers) * 100 : 0;
    
    const usersByRole = await models.User.findAll({
      attributes: [
        'role',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['role']
    });

    // Normalize into the shape frontend expects
    const byRoleMap = usersByRole.reduce((acc, curr) => {
      const role = curr.role || 'patient';
      acc[role] = parseInt(curr.get('count')) || 0;
      return acc;
    }, {});

    const stats = {
      totalUsers,
      totalDoctors: Number(byRoleMap.doctor || 0),
      totalStaff: Number(byRoleMap.staff || 0),
      totalAdmins: Number(byRoleMap.admin || 0),
      totalPatients: Number(byRoleMap.patient || 0),
      verifiedUsers,
      activeUsers,
      inactiveUsers,
      verificationRate: Number(verificationRate.toFixed(2)),
      roles: {
        admin: Number(byRoleMap.admin || 0),
        doctor: Number(byRoleMap.doctor || 0),
        staff: Number(byRoleMap.staff || 0),
        patient: Number(byRoleMap.patient || 0)
      }
    };

    res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('ERROR trong getUserStats:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thống kê', error: error.message });
  }
};

// Toggle trạng thái hoạt động của user
exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;
    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }
    user.is_active = is_active;
    await user.save();
    res.status(200).json({ success: true, message: `Tài khoản đã được ${is_active ? 'mở khóa' : 'khóa'}`, user: { id: user.id, email: user.email, is_active: user.is_active } });
  } catch (error) {
    console.error('ERROR trong toggleUserStatus:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi thay đổi trạng thái tài khoản', error: error.message });
  }
};

// Toggle xác thực người dùng (Admin only)
exports.toggleUserVerification = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_verified } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này'
      });
    }

    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    // Lưu trạng thái cũ để so sánh
    const oldVerifiedStatus = user.is_verified;

    // Cập nhật trạng thái xác thực
    user.is_verified = is_verified;
    
    // Nếu xác thực thì cũng kích hoạt tài khoản
    if (is_verified && !user.is_active) {
      user.is_active = true;
    }
    
    await user.save();

    //  GỬI EMAIL KHI ADMIN XÁC THỰC TÀI KHOẢN (chỉ khi chuyển từ chưa xác thực -> đã xác thực)
    if (is_verified === true && oldVerifiedStatus === false) {
      try {
        await sendAccountVerifiedEmail(
          user.email,
          user.full_name || user.username,
          'admin' // Phương thức: được admin xác thực
        );
        console.log(` Đã gửi email thông báo xác thực (admin) đến ${user.email}`);
      } catch (emailError) {
        console.error('⚠️ Không thể gửi email thông báo xác thực:', emailError.message);
        // Không throw error vì xác thực đã thành công
      }
    }

    res.status(200).json({
      success: true,
      message: `Tài khoản đã được ${is_verified ? 'xác thực' : 'hủy xác thực'}`,
      user: {
        id: user.id,
        email: user.email,
        is_verified: user.is_verified,
        is_active: user.is_active
      }
    });

  } catch (error) {
    console.error('ERROR trong toggleUserVerification:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi thay đổi trạng thái xác thực',
      error: error.message
    });
  }
};

// Đặt lại mật khẩu bởi Admin (không cần OTP)
exports.resetPasswordByAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const { new_password } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này'
      });
    }

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự'
      });
    }

    const user = await models.User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    user.password_hash = await bcrypt.hash(new_password, 10);
    user.reset_token = null;
    user.reset_expires = null;
    
    await user.save();

    console.log(`[Admin Reset Password] Admin ${req.user.email} đã đặt lại mật khẩu cho user ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Đặt lại mật khẩu thành công'
    });

  } catch (error) {
    console.error('ERROR trong resetPasswordByAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi đặt lại mật khẩu',
      error: error.message
    });
  }
};

// ============================================
// DOCTOR PUBLIC API - Lấy danh sách bác sĩ công khai
// ============================================

// Lấy danh sách bác sĩ (public - cho homepage)
exports.getDoctors = async (req, res) => {
  try {
    const { limit = 10, random = false, specialty_id, min_experience } = req.query;
    
    const userWhere = { role: 'doctor', is_active: true, is_verified: true };
    const doctorWhere = {};
    if (specialty_id) doctorWhere.specialty_id = specialty_id;
    if (min_experience) doctorWhere.experience_years = { [Op.gte]: parseInt(min_experience) };

    let orderClause = random === 'true' ? Sequelize.literal('RAND()') : [['created_at', 'DESC']];

    const users = await models.User.findAll({
      where: userWhere,
      attributes: ['id', 'email', 'full_name', 'phone', 'avatar_url', 'gender'],
      limit: parseInt(limit),
      order: orderClause
    });

    if (users.length === 0) return res.status(200).json({ success: true, doctors: [], total: 0 });

    const userIds = users.map(u => u.id);
    const doctors = await models.Doctor.findAll({
      where: { user_id: { [Op.in]: userIds }, ...doctorWhere },
      include: [{
        model: models.Specialty, as: 'specialty',
        attributes: ['id', 'name', 'slug', 'description', 'icon'], // THÊM TRƯỜNG ICON Ở ĐÂY
        required: false
      }]
    });

    const formattedDoctors = users.map(user => {
      const doctor = doctors.find(d => d.user_id === user.id);
      if (!doctor) return null;
      return {
        id: user.id,
        code: doctor.code || `BS${String(user.id).padStart(5, '0')}`,
        full_name: user.full_name || 'Chưa cập nhật',
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        avatar_url: user.avatar_url || 'https://via.placeholder.com/400?text=Doctor',
        specialty_id: doctor.specialty_id,
        specialty_name: doctor.specialty?.name || 'Chưa phân chuyên khoa',
        specialty_slug: doctor.specialty?.slug,
        specialty_icon: doctor.specialty?.icon, // MAPPING ICON ĐỂ TRẢ VỀ FRONTEND
        experience_years: doctor.experience_years || 0,
        bio: doctor.bio,
        title: doctor.title,
        position: doctor.position,
        workplace: doctor.workplace,
        work_status: doctor.work_status
      };
    }).filter(d => d !== null);

    res.status(200).json({ success: true, doctors: formattedDoctors, total: formattedDoctors.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách bác sĩ', error: error.message });
  }
};

// Lấy danh sách bác sĩ với phân trang
exports.getAllDoctorsPublic = async (req, res) => {
  try {
    const { specialty_id, min_experience, search, page = 1, limit = 500 } = req.query;
    const offset = (page - 1) * limit;
    const userWhere = { role: 'doctor', is_active: true, is_verified: true };

    if (search) {
      userWhere[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const doctorWhere = {};
    if (specialty_id) doctorWhere.specialty_id = specialty_id;
    if (min_experience) doctorWhere.experience_years = { [Op.gte]: parseInt(min_experience) };

    const { count, rows: doctors } = await models.User.findAndCountAll({
      where: userWhere,
      attributes: ['id', 'email', 'full_name', 'phone', 'avatar_url', 'gender'],
      include: [{
        model: models.Doctor,
        where: doctorWhere,
        required: true,
        include: [{
          model: models.Specialty, as: 'specialty',
          attributes: ['id', 'name', 'slug', 'icon'], // THÊM TRƯỜNG ICON Ở ĐÂY
          required: false
        }]
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      distinct: true
    });

    const formattedDoctors = doctors.map(user => {
      const doctor = user.Doctor;
      return {
        id: user.id,
        code: doctor?.code || `BS${String(user.id).padStart(5, '0')}`,
        full_name: user.full_name || 'Chưa cập nhật',
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        avatar_url: user.avatar_url || 'https://via.placeholder.com/400?text=Doctor',
        specialty_id: doctor?.specialty_id,
        specialty_name: doctor?.specialty?.name || 'Chưa phân chuyên khoa',
        specialty_slug: doctor?.specialty?.slug,
        specialty_icon: doctor?.specialty?.icon, // MAPPING ICON ĐỂ TRẢ VỀ FRONTEND
        experience_years: doctor?.experience_years || 0,
        bio: doctor?.bio,
        title: doctor?.title, 
        position: doctor?.position, 
        workplace: doctor?.workplace,
        work_status: doctor?.work_status
      };
    });

    res.status(200).json({
      success: true,
      doctors: formattedDoctors,
      pagination: { currentPage: parseInt(page), totalPages: Math.ceil(count / limit), totalItems: count }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách bác sĩ', error: error.message });
  }
};

// Lấy chi tiết bác sĩ theo CODE (Fix: Mapping đúng tên trường)
exports.getDoctorByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const doctor = await models.Doctor.findOne({
      where: { code },
      include: [
        { model: models.User, as: 'user', attributes: ['id', 'email', 'full_name', 'phone', 'avatar_url', 'gender', 'dob'] },
        { model: models.Specialty, as: 'specialty', attributes: ['id', 'name', 'slug', 'description', 'icon'] } // THÊM TRƯỜNG ICON
      ]
    });

    if (!doctor) return res.status(404).json({ success: false, message: 'Không tìm thấy bác sĩ' });

    const user = doctor.user;
    const formattedDoctor = {
      id: user.id,
      code: doctor.code,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatar_url || 'https://via.placeholder.com/400?text=Doctor',
      gender: user.gender,
      dob: user.dob,
      specialty: doctor.specialty, // Biến này tự động mang theo thuộc tính .icon luôn rồi
      experience_years: doctor.experience_years || 0,
      bio: doctor.bio,
      title: doctor.title,
      position: doctor.position,
      workplace: doctor.workplace,
      education: doctor.education || [],
      certifications: doctor.certifications || [], 
      work_experience: doctor.work_experience || [],
      research: doctor.research || [],
      achievements: doctor.achievements || []
    };

    res.status(200).json({ success: true, doctor: formattedDoctor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// Lấy chi tiết bác sĩ theo ID
exports.getDoctorById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await models.User.findOne({
      where: { id: userId, role: 'doctor' },
      attributes: ['id', 'email', 'full_name', 'phone', 'avatar_url', 'gender', 'dob']
    });

    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy bác sĩ' });

    const doctorDetail = await models.Doctor.findOne({
      where: { user_id: userId },
      include: [{ model: models.Specialty, as: 'specialty', attributes: ['id', 'name', 'slug', 'description', 'icon'] }] // THÊM TRƯỜNG ICON
    });

    const formattedDoctor = {
      id: user.id,
      code: doctorDetail?.code || `BS${String(user.id).padStart(3, '0')}`,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatar_url || 'https://via.placeholder.com/400?text=Doctor',
      gender: user.gender,
      dob: user.dob,
      specialty: doctorDetail?.Specialty,
      experience_years: doctorDetail?.experience_years || 0,
      bio: doctorDetail?.bio,
      certifications: doctorDetail?.certifications_json
    };

    res.status(200).json({ success: true, doctor: formattedDoctor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thông tin bác sĩ', error: error.message });
  }
};

/**
 * LẤY DANH SÁCH USER THEO ROLE (DÙNG CHO SCHEDULE FORM VÀ PHÂN CÔNG)
 * @route GET /api/users/by-role?role=doctor,staff&limit=200
 * @access Admin
 * SỬA ĐỔI: Nếu role là 'doctor', trả về ID của bảng Doctor thay vì ID của bảng User
 * để khớp với logic phân công nhân sự.
 */
exports.getUsersByRole = async (req, res) => {
  try {
    const { role, limit = 200 } = req.query;

    if (!role) {
      return res.status(400).json({ success: false, message: 'Tham số role là bắt buộc' });
    }

    const roles = role.split(',').map(r => r.trim()).filter(r => ['doctor', 'staff', 'admin', 'patient'].includes(r));

    // Cấu hình query
    const queryOptions = {
      where: {
        role: { [Op.in]: roles }
      },
      attributes: ['id', 'full_name', 'email', 'role', 'avatar_url'],
      limit: parseInt(limit),
      order: [['full_name', 'ASC']]
    };

    // Nếu tìm bác sĩ, Join thêm bảng Doctor để lấy ID bác sĩ thực
    if (roles.includes('doctor')) {
      queryOptions.include = [
        { 
          model: models.Doctor, 
          attributes: ['id', 'specialty_id', 'work_status'], // Lấy ID + work_status
          required: true, // Inner join - chỉ lấy user có hồ sơ Doctor
          where: { work_status: 'active' }, // Chỉ lấy bác sĩ đang hoạt động
          include: [
            {
              model: models.Specialty,
              as: 'specialty',
              attributes: ['id', 'name'],
              required: false
            }
          ]
        }
      ];
    }

    const users = await models.User.findAll(queryOptions);

    // Xử lý dữ liệu: Hoán đổi ID nếu là bác sĩ
    const formattedUsers = users.map(user => {
      const userData = user.toJSON();
      
      // LOGIC QUAN TRỌNG: Nếu là bác sĩ và có hồ sơ Doctor, dùng ID của Doctor
      // Điều này giúp Modal Phân công gửi đúng ID Bác sĩ (1, 2) thay vì ID User (5, 6)
      if (user.role === 'doctor' && user.Doctor) {
        userData.original_user_id = user.id; // Lưu lại ID user gốc nếu cần
        userData.id = user.Doctor.id;       // Ghi đè ID bằng ID Bác sĩ (1, 2)
        userData.specialty = user.Doctor.specialty; // Thêm thông tin specialty
      }
      
      return userData;
    });

    if (req.user && req.user.role === 'staff') {
      const currentStaffId = req.user.id;
      
      // Tìm thông tin Staff hiện tại để lấy danh sách bác sĩ từ JSON column (source of truth)
      const currentStaff = await models.Staff.findOne({
        where: { user_id: currentStaffId },
        attributes: ['id', 'managed_doctors']
      });

      if (currentStaff) {
        // Lấy danh sách ID từ JSON column (nguồn dữ liệu chuẩn)
        const managedDoctorIds = currentStaff.managed_doctors?.doctor_ids || [];

        // Lọc formattedUsers: Chỉ giữ lại Bác sĩ thuộc danh sách quản lý
        const filteredUsers = formattedUsers.filter(u => {
          if (u.role === 'doctor') {
            return managedDoctorIds.includes(u.id); // u.id là Doctor.id
          }
          return true; // Giữ lại các role khác (nếu có)
        });

        // Gán lại danh sách đã lọc để trả về
        formattedUsers.length = 0;
        formattedUsers.push(...filteredUsers);
      }
    }

    res.status(200).json({
      success: true,
      users: formattedUsers,
      count: formattedUsers.length
    });

  } catch (error) {
    console.error('ERROR trong getUsersByRole:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách user theo role',
      error: error.message
    });
  }
};

// ============================================
// STATISTICS - Thống kê người dùng (Admin)
// ============================================
exports.getStats = async (req, res) => {
  try {
    // Đếm tổng số users
    const totalUsers = await models.User.count();
    
    // Đếm số doctors
    const totalDoctors = await models.User.count({
      where: { role: 'doctor' }
    });

    // Đếm số staff
    const totalStaff = await models.User.count({
      where: { role: 'staff' }
    });

    // Đếm số admin
    const totalAdmins = await models.User.count({
      where: { role: 'admin' }
    });
    
    // Đếm số patients
    const totalPatients = await models.User.count({
      where: { role: 'patient' }
    });
    
    // Đếm số users đã verified
    const verifiedUsers = await models.User.count({
      where: { is_verified: true }
    });
    
    // Đếm số users active
    const activeUsers = await models.User.count({
      where: { is_active: true }
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalDoctors,
        totalStaff,
        totalAdmins,
        totalPatients,
        verifiedUsers,
        activeUsers,
        roles: {
          admin: totalAdmins,
          doctor: totalDoctors,
          staff: totalStaff,
          patient: totalPatients
        }
      }
    });

  } catch (error) {
    console.error(' Error in getStats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê',
      error: error.message
    });
  }
};

// server/controllers/userController.js - THÊM PHẦN NÀY VÀO FILE CŨ

// ============================================
//  OAUTH CALLBACK HANDLER - THÊM MỚI
// ============================================
/**
 * Xử lý OAuth callback từ Google/Facebook
 * Được gọi sau khi Passport authenticate thành công
 */
exports.handleOAuthCallback = async (req, res) => {
  try {
    const user = req.user;  // Passport đã gán user vào req
    
    if (!user) {
      console.error('❌ [OAuth Callback] User không tồn tại trong req');
      return res.redirect(
        `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=auth_failed`
      );
    }

    console.log(' [OAuth Callback] User authenticated:', user.email);

    // Tạo JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Chuẩn bị user data để gửi về frontend
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      avatar_url: user.avatar_url,
      is_verified: user.is_verified,
      is_active: user.is_active,
      oauth_provider: user.oauth_provider
    };

    // Redirect về frontend với token và user data
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const redirectUrl = `${clientUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`;
    
    console.log('🔄 [OAuth Callback] Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ [OAuth Callback] Error:', error);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/login?error=auth_failed`);
  }
};

/**
 * Lấy thông tin role & kiểm tra hồ sơ thiếu (Cho Patient)
 * GET /api/users/profile/role-info
 */
exports.getMyRoleInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 1. Lấy user và role data
    const user = await models.User.findByPk(userId, {
      include: [
        { model: models.Patient },
        { model: models.Doctor },
        { model: models.Staff }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let roleData = null;
    let missing_profile = false;
    let missing_fields = [];
    // THÊM: role_info cho staff
    let role_info = null;

    // 2. Nếu là Patient, kiểm tra các trường sức khỏe
    if (user.role === 'patient' && user.Patient) {
      roleData = user.Patient;
      
      let healthInfo = roleData.medical_history;
      if (typeof healthInfo === 'string') {
        try { healthInfo = JSON.parse(healthInfo); } catch (e) {}
      }
      healthInfo = healthInfo || {};

      const requiredFields = [
        { key: 'blood_type', label: 'Nhóm máu' },
        { key: 'height', label: 'Chiều cao' },
        { key: 'weight', label: 'Cân nặng' },
        { key: 'health_insurance', label: 'BHYT' },
        { key: 'emergency_contact', label: 'Liên hệ khẩn cấp' }
      ];

      requiredFields.forEach(field => {
        if (!healthInfo[field.key]) {
          missing_fields.push(field.label);
        }
      });

      if (missing_fields.length > 0) {
        missing_profile = true;
      }
      
      roleData.setDataValue('medical_history', healthInfo);
    } 
    else if (user.role === 'doctor' && user.Doctor) {
      roleData = user.Doctor;
      role_info = {
        specialty: user.Doctor.specialty_id,
        permissions: user.Doctor.permissions || {
          articles: [
            'view', 
            'create', 
            'suggest_medicine', // Đổi lại thành suggest_medicine
            'suggest_disease'   // Đổi lại thành suggest_disease
          ]
        }
      };
    }
    else if (user.role === 'staff' && user.Staff) {
      roleData = user.Staff;
      const matchedProfile = findRoleProfileByPermissions(
        user.Staff.department,
        user.Staff.permissions,
        user.Staff.job_description
      );
      // THÊM: Trả về role_info với permissions mới nhất từ DB
      role_info = {
        department: user.Staff.department,
        rank: user.Staff.rank,
        permissions: user.Staff.permissions,
        role_profile: matchedProfile?.code || null,
        role_name: matchedProfile?.name || user.Staff.job_description || null,
        job_description: user.Staff.job_description || null
      };
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        role: user.role,
        missing_profile,
        missing_fields,
        roleData,
        // THÊM: role_info để usePermissions.js đọc được
        ...(role_info && { role_info })
      }
    });

  } catch (error) {
    console.error('Error in getMyRoleInfo:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

//  Hàm cập nhật hồ sơ sức khỏe (Patient)
exports.updatePatientHealthInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const healthData = req.body; // Dữ liệu từ form

    const patient = await models.Patient.findOne({ where: { user_id: userId } });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Hồ sơ bệnh nhân không tồn tại' });
    }

    // Cập nhật cột medical_history (Lưu dạng JSON)
    await patient.update({
      medical_history: healthData // Sequelize tự stringify nếu cột là JSON/TEXT
    });

    res.json({ success: true, message: 'Cập nhật hồ sơ thành công' });

  } catch (error) {
    console.error('Error updating health info:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};