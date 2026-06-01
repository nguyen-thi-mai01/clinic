// server/models/User.js - CẬP NHẬT: Thêm OAuth fields
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    username: { type: DataTypes.STRING(50), unique: false, allowNull: false },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    full_name: { type: DataTypes.STRING(255), allowNull: true },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    gender: { type: DataTypes.ENUM('male', 'female', 'other'), allowNull: true },
    dob: { type: DataTypes.DATE, allowNull: true },
    avatar_url: { type: DataTypes.STRING(255), allowNull: true },
    role: { type: DataTypes.ENUM('admin', 'patient', 'doctor', 'staff'), allowNull: false },
    is_verified: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: true },
    verification_token: { type: DataTypes.STRING(255), allowNull: true },
    verification_expires: { type: DataTypes.DATE, allowNull: true },
    reset_token: { type: DataTypes.STRING(255), allowNull: true },
    reset_expires: { type: DataTypes.DATE, allowNull: true },
    last_login: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
    
    //  OAUTH FIELDS - THÊM MỚI CHO GOOGLE + FACEBOOK
    google_id: { type: DataTypes.STRING(255), allowNull: true, unique: true },
    facebook_id: { type: DataTypes.STRING(255), allowNull: true, unique: true },
    oauth_provider: { 
      type: DataTypes.ENUM('local', 'google', 'facebook'), 
      defaultValue: 'local',
      allowNull: true 
    },
    
    //  THÊM MỚI: Cột lưu điểm tích lũy của user
    reward_points: { type: DataTypes.INTEGER, defaultValue: 0 },

    //  THÊM MỚI: Cột lưu điểm tích lũy của user
    reward_points: { type: DataTypes.INTEGER, defaultValue: 0 },
    last_checkin_date: { type: DataTypes.DATE, allowNull: true },
    
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    checkin_streak: { type: DataTypes.INTEGER, defaultValue: 0, comment: 'Chuỗi điểm danh liên tiếp' },
    checkin_history: { type: DataTypes.TEXT, allowNull: true, comment: 'Lịch sử điểm danh trong tuần (JSON array)' }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['email'] }, 
      { fields: ['username'] },
      { fields: ['google_id'] },    //  Index cho OAuth
      { fields: ['facebook_id'] }   //  Index cho OAuth
    ]
  });

  User.associate = (models) => {
    // Kiểm tra model tồn tại trước khi tạo association
    if (models.Patient) {
      User.hasOne(models.Patient, { foreignKey: 'user_id' });
    }
    if (models.Staff) {
      User.hasOne(models.Staff, { foreignKey: 'user_id' });
    }
    if (models.Doctor) {
      User.hasOne(models.Doctor, { foreignKey: 'user_id' });
    }
    if (models.Admin) {
      User.hasOne(models.Admin, { foreignKey: 'user_id' });
    }
    if (models.Article) {
      User.hasMany(models.Article, { foreignKey: 'author_id', as: 'articles' });
    }
    if (models.Notification) {
      User.hasMany(models.Notification, { foreignKey: 'user_id' });
    }
    if (models.Question) {
      User.hasMany(models.Question, { foreignKey: 'user_id' });
    }
    if (models.Answer) {
      User.hasMany(models.Answer, { foreignKey: 'user_id' });
    }
    if (models.AuditLog) {
      User.hasMany(models.AuditLog, { foreignKey: 'user_id' });
    }
    if (models.Consultation) {
      User.hasMany(models.Consultation, { foreignKey: 'patient_id', as: 'patientConsultations' });
      User.hasMany(models.Consultation, { foreignKey: 'doctor_id', as: 'doctorConsultations' });
    }
    if (models.Payment) {
      User.hasMany(models.Payment, { foreignKey: 'user_id' });
    }
    if (models.MedicalRecord) {
      User.hasMany(models.MedicalRecord, { foreignKey: 'patient_id', as: 'patientRecords' });
      User.hasMany(models.MedicalRecord, { foreignKey: 'doctor_id', as: 'doctorRecords' });
    }
    if (models.Interaction) {
      User.hasMany(models.Interaction, { foreignKey: 'user_id' });
    }
    if (models.ChatMessage) {
      User.hasMany(models.ChatMessage, { foreignKey: 'sender_id', as: 'sentMessages' });
      User.hasMany(models.ChatMessage, { foreignKey: 'receiver_id', as: 'receivedMessages' });
    }
    if (models.Discount) {
      User.hasMany(models.Discount, { foreignKey: 'doctor_id' });
    }
    if (models.Schedule) {
      User.hasMany(models.Schedule, { foreignKey: 'doctor_id' });
    }
    if (models.SystemSetting) {
      User.hasMany(models.SystemSetting, { foreignKey: 'updated_by' });
    }
    //  COMMUNITY GROUPS
    if (models.CommunityGroup) {
      User.hasMany(models.CommunityGroup, { foreignKey: 'owner_id', as: 'ownedGroups' });
    }
    if (models.GroupMember) {
      User.hasMany(models.GroupMember, { foreignKey: 'user_id', as: 'groupMemberships' });
    }
    if (models.GroupPost) {
      User.hasMany(models.GroupPost, { foreignKey: 'author_id', as: 'groupPosts' });
    }
    if (models.GroupJoinRequest) {
      User.hasMany(models.GroupJoinRequest, { foreignKey: 'user_id', as: 'joinRequests' });
    }
  };

  // Hook để tự động tạo username từ email
  User.addHook('beforeValidate', async (user, options) => {
    try {
      if (!user.username && user.email) {
        user.username = user.email.split('@')[0];
        console.log(`[Hook beforeValidate] Tạo username ${user.username} từ email ${user.email}`);
      }
    } catch (error) {
      console.error('[Hook beforeValidate] ERROR:', error.message);
      throw error;
    }
  });

  // Hook để tự động tạo bản ghi trong bảng vai trò tương ứng
  User.addHook('afterCreate', async (user, options) => {
    try {
      console.log(`[Hook afterCreate] Bắt đầu cho user: ${user.email} (role: ${user.role})`);
      
      // LƯU TOKEN TRƯỚC KHI HOOK CHẠY
      const tokenBeforeHook = user.verification_token;
      console.log(`[Hook afterCreate] Token TRƯỚC khi tạo role: ${tokenBeforeHook}`);
      
      const { Patient, Staff, Doctor, Admin, Specialty } = sequelize.models;
      if (!Patient || !Staff || !Doctor || !Admin) {
        throw new Error('Không tìm thấy các model cần thiết (Patient, Staff, Doctor, Admin)');
      }

      const createOptions = { transaction: options.transaction };

      // TẠO ROLE RECORD
      switch (user.role) {
        case 'patient':
          await Patient.create({ user_id: user.id }, createOptions);
          console.log(`[Hook afterCreate] Đã tạo bản ghi Patient cho user ${user.email}`);
          break;

        case 'staff':
          await Staff.create({ 
            user_id: user.id, 
            department: null
          }, createOptions);
          console.log(`[Hook afterCreate] Đã tạo bản ghi Staff cho user ${user.email}`);
          break;

        case 'doctor':
          const specialty = await Specialty.findOne({ 
            where: { slug: 'cardiology' },
            transaction: options.transaction
          });
          await Doctor.create({
            user_id: user.id,
            specialty_id: specialty ? specialty.id : null,
            experience_years: null,
            certifications_json: null,
            bio: null
          }, createOptions);
          console.log(`[Hook afterCreate] Đã tạo bản ghi Doctor cho user ${user.email}`);
          break;

        case 'admin':
          await Admin.create({ 
            user_id: user.id, 
            permissions_json: null 
          }, createOptions);
          console.log(`[Hook afterCreate] Đã tạo bản ghi Admin cho user ${user.email}`);
          break;

        default:
          console.warn(`[Hook afterCreate] Vai trò không hợp lệ: ${user.role}`);
      }

      // KIỂM TRA TOKEN SAU KHI TẠO ROLE
      const tokenAfterHook = user.verification_token;
      console.log(`[Hook afterCreate] Token SAU khi tạo role: ${tokenAfterHook}`);
      
      if (tokenBeforeHook !== tokenAfterHook) {
        console.error('CẢNH BÁO: Token đã bị thay đổi trong hook!');
        console.error('Token trước:', tokenBeforeHook);
        console.error('Token sau:', tokenAfterHook);
      } else {
        console.log('[Hook afterCreate] Token KHÔNG thay đổi - OK');
      }

      console.log(`[Hook afterCreate] Hoàn tất cho user: ${user.email}`);
      
    } catch (error) {
      console.error('[Hook afterCreate] ERROR:', {
        email: user.email,
        role: user.role,
        error: error.message
      });
      throw error;
    }
  });

  console.log('SUCCESS: Model User đã được định nghĩa với OAuth support.');

  return User;
};