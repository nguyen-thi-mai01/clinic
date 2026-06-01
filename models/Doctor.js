// server/models/Doctor.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Doctor = sequelize.define('Doctor', {
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true 
    },
    user_id: { 
      type: DataTypes.BIGINT, 
      unique: true, 
      allowNull: false 
    },
    username: { 
      type: DataTypes.STRING(50), 
      unique: false, 
      allowNull: false 
    },
    code: { 
      type: DataTypes.STRING(10), 
      unique: true, 
      allowNull: false 
    },
    
    // =============================================
    // THÔNG TIN CHUYÊN MÔN CƠ BẢN
    // =============================================
    specialty_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true,
      comment: 'Chuyên khoa chính'
    },
    experience_years: { 
      type: DataTypes.INTEGER, 
      allowNull: true,
      comment: 'Số năm kinh nghiệm'
    },
    bio: { 
      type: DataTypes.TEXT, 
      allowNull: true,
      comment: 'Tiểu sử / Giới thiệu ngắn'
    },
    
    // =============================================
    // THÔNG TIN CÁ NHÂN - String đơn giản
    // =============================================
    title: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Học hàm, học vị (VD: Giáo sư, Tiến sĩ, Thạc sĩ)'
    },
    
    position: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Chức vụ hiện tại'
    },

    workplace: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Nơi công tác hiện tại (Bệnh viện/Phòng khám)'
    },
    
    // =============================================
    // DANH SÁCH - JSON Arrays (Simple strings)
    // =============================================
    specializations: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Lĩnh vực chuyên sâu - Array of strings'
    },
    
    // =============================================
    // CẤU TRÚC PHỨC TẠP - JSON Objects/Arrays
    // =============================================
    
    // Education: Array of objects
    education: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Học vấn - Array of {degree, institution, year, description}'
    },
    
    // Certifications: Array of objects with link
    certifications: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Chứng chỉ - Array of {name, link}'
    },
    
    // Work Experience: Array of objects
    work_experience: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Kinh nghiệm làm việc - Array of {position, hospital, department, period, description}'
    },
    
    // Research: Array of objects with link
    research: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Nghiên cứu - Array of {title, authors, journal, year, link}'
    },
    
    // Achievements: Array of objects with link
    achievements: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Thành tích - Array of {title, link}'
    },
    
    // =============================================
    // QUẢN LÝ NHÂN SỰ & LỊCH
    // =============================================
    assigned_staff_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true
    },
    work_status: {
      type: DataTypes.ENUM('active', 'on_leave', 'inactive'),
      defaultValue: 'active',
      allowNull: false
    },
    schedule_preference_type: {
      type: DataTypes.ENUM('fixed', 'flexible'),
      allowNull: false,
      defaultValue: 'fixed'
    },
    current_schedule_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'schedules',
        key: 'id'
      }
    },
    
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'doctors',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['username'] },
      { fields: ['assigned_staff_id'] },
      { fields: ['title'] },
      { fields: ['position'] }
    ]
  });

  Doctor.associate = (models) => {
    Doctor.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Doctor.belongsTo(models.Specialty, { foreignKey: 'specialty_id', as: 'specialty' });
    Doctor.belongsTo(models.Staff, { foreignKey: 'assigned_staff_id', as: 'assignedStaff' });
    Doctor.hasMany(models.Appointment, { foreignKey: 'doctor_id', as: 'appointments' });
    Doctor.hasMany(models.Consultation, { foreignKey: 'doctor_id' });
    Doctor.hasMany(models.MedicalRecord, { foreignKey: 'doctor_id' });
    Doctor.hasMany(models.Discount, { foreignKey: 'doctor_id' });
    Doctor.belongsTo(models.Schedule, { foreignKey: 'current_schedule_id', as: 'activeScheduleRegistration' });
  };

  Doctor.addHook('beforeValidate', async (doctor, options) => {
    try {
      if (!doctor.user_id) return;
      
      const user = await sequelize.models.User.findOne({
        where: { id: doctor.user_id },
        transaction: options.transaction
      });
      
      if (!user) throw new Error(`Không tìm thấy User với user_id: ${doctor.user_id}`);
      
      doctor.username = user.username;
      
      if (!doctor.code) {
        const lastDoctor = await Doctor.findOne({
          attributes: ['code'],
          order: [['id', 'DESC']],
          transaction: options.transaction,
          paranoid: false
        });
        
        let nextNumber = 1;
        if (lastDoctor && lastDoctor.code) {
          const match = lastDoctor.code.match(/DR(\d+)/);
          if (match) nextNumber = parseInt(match[1]) + 1;
        }
        doctor.code = `DR${String(nextNumber).padStart(5, '0')}`;
      }
      
      // Đảm bảo JSON fields có giá trị mặc định
      if (!doctor.specializations) doctor.specializations = [];
      if (!doctor.achievements) doctor.achievements = [];
      if (!doctor.education) doctor.education = [];
      if (!doctor.certifications) doctor.certifications = [];
      if (!doctor.work_experience) doctor.work_experience = [];
      if (!doctor.research) doctor.research = [];
      
    } catch (error) {
      console.error('ERROR trong hook beforeValidate cho Doctor:', error.message);
      throw error;
    }
  });

  Doctor.prototype.isOnLeave = async function(date) {
    const LeaveRequest = sequelize.models.LeaveRequest;
    if (!LeaveRequest) return false;
    
    const leave = await LeaveRequest.findOne({
      where: {
        user_id: this.user_id,
        status: 'approved',
        date_from: { [sequelize.Op.lte]: date },
        [sequelize.Op.or]: [
          { date_to: null, date_from: date },
          { date_to: { [sequelize.Op.gte]: date } }
        ]
      }
    });
    return !!leave;
  };

  console.log('logo.png Model Doctor đã được định nghĩa.');
  return Doctor;
};