// server/models/Staff.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Staff = sequelize.define('Staff', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.BIGINT, unique: true, allowNull: false },
    username: { type: DataTypes.STRING(50), unique: false, allowNull: false },
    code: { type: DataTypes.STRING(10), unique: true, allowNull: false },
    // === CẬP NHẬT: PHÂN CẤP & PHÒNG BAN ===
    department: { 
      type: DataTypes.ENUM('clinical', 'system', 'support', 'finance', 'content'), 
      allowNull: true,
      comment: 'clinical: Vận hành | system: IT | support: CSKH | finance: Kế toán | content: Nội dung'
    },
    rank: {
      type: DataTypes.ENUM('manager', 'staff'),
      defaultValue: 'staff',
      allowNull: false,
      comment: 'Cấp bậc: manager (Trưởng bộ phận) | staff (Nhân viên)'
    },
    manager_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'ID của Staff quản lý trực tiếp (cấp trên)'
    },
    
    // === CẤU HÌNH PHẠM VI QUẢN LÝ ===
    managed_doctors: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: { doctor_ids: [] },
      comment: 'CHO CLINICAL: { "doctor_ids": [1, 2] } - DS bác sĩ phụ trách'
    },
    assigned_categories: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: { category_ids: [] },
      comment: 'CHO SUPPORT/CONTENT: { "category_ids": [5, 10] } - DS chuyên mục phụ trách'
    },
    scopes: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'CHO SYSTEM: ["manage_services", "manage_specialties"] - Các module được quyền sửa'
    },
    work_status: {
      type: DataTypes.ENUM('active', 'on_leave', 'inactive'),
      defaultValue: 'active',
      allowNull: false,
      comment: 'Trạng thái làm việc hiện tại'
    },
    
    // =============================================
    // === HỆ THỐNG PHÂN QUYỀN MỚI ===
    // =============================================
    permissions: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Quyền chi tiết theo module: { "appointments": ["view", "edit"], "payments": ["view", "verify"] }'
    },
    role_profile: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Mã vai trò con theo phòng ban (vd: it_support, clinical_staff)'
    },
    job_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Mô tả công việc chi tiết của nhân viên'
    },
    access_level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '1=NV thường | 2=NV cao cấp | 3=Trưởng phòng | 4=Phó GĐ | 5=Giám đốc'
    },
    // =============================================
    
    // =============================================
    // === BỔ SUNG CHO LỊCH LINH HOẠT ===
    // =============================================
    schedule_preference_type: {
      type: DataTypes.ENUM('fixed', 'flexible'),
      allowNull: false,
      defaultValue: 'fixed',
      comment: 'Loại lịch làm việc: Cố định hoặc Linh hoạt'
    },
    current_schedule_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'schedules', // Tham chiếu đến chính bảng schedule
        key: 'id'
      },
      comment: 'ID của bản ghi đăng ký (flexible_registration) đang active'
    },
    // =============================================
    
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'staff',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['username'] },
      { fields: ['schedule_preference_type'] } // Index mới
    ]
  });

  Staff.associate = (models) => {
    Staff.belongsTo(models.User, { foreignKey: 'user_id' });
    Staff.hasMany(models.Article, { foreignKey: 'author_id', sourceKey: 'user_id' });
    Staff.hasMany(models.Doctor, { foreignKey: 'assigned_staff_id', as: 'managedDoctors' }); 
    Staff.hasMany(models.Appointment, { foreignKey: 'staff_id', as: 'managedAppointments' });
    
    // Association mới
    Staff.belongsTo(models.Schedule, { 
      foreignKey: 'current_schedule_id', 
      as: 'activeScheduleRegistration' 
    });
    // Quan hệ phân cấp quản lý (Hierarchy)
    Staff.belongsTo(models.Staff, { foreignKey: 'manager_id', as: 'manager' });
    Staff.hasMany(models.Staff, { foreignKey: 'manager_id', as: 'subordinates' });
  };

  // Hooks giữ nguyên
  Staff.addHook('beforeValidate', async (staff, options) => {
    try {
      // (MỚI) Thêm dòng này
      if (!staff.user_id) {
        // Đây là một lệnh update (như đổi lịch) không truyền user_id,
        // bỏ qua hook này.
        return;
      }
      const user = await sequelize.models.User.findOne({
        where: { id: staff.user_id },
        transaction: options.transaction
      });
      if (!user) {
        throw new Error(`Không tìm thấy User với user_id: ${staff.user_id}`);
      }
      staff.username = user.username;
      
      if (!staff.code) {
        // Sửa logic tạo code: Tìm code lớn nhất
        const lastStaff = await Staff.findOne({
          attributes: ['code'],
          order: [['id', 'DESC']],
          transaction: options.transaction,
          paranoid: false
        });
        
        let nextNumber = 1;
        if (lastStaff && lastStaff.code) {
          const match = lastStaff.code.match(/ST(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1]) + 1;
          }
        }
        staff.code = `ST${String(nextNumber).padStart(5, '0')}`;
      }
    } catch (error) {
      console.error('ERROR trong hook beforeValidate cho Staff:', error.message);
      throw error;
    }
  });

  // (Instance methods giữ nguyên)
  Staff.prototype.getManagedDoctorIds = function() {
    if (!this.managed_doctors || !this.managed_doctors.doctor_ids) {
      return [];
    }
    return this.managed_doctors.doctor_ids;
  };

  Staff.prototype.canManageDoctor = function(doctorId) {
    const ids = this.getManagedDoctorIds();
    return ids.includes(parseInt(doctorId));
  };

  Staff.prototype.isOnLeave = async function(date) {
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

  // === PERMISSION METHODS ===
  Staff.prototype.hasPermission = function(module, action) {
    if (!this.permissions || !this.permissions[module]) {
      return false;
    }
    return this.permissions[module].includes(action);
  };

  Staff.prototype.getPermissionModules = function() {
    return this.permissions ? Object.keys(this.permissions) : [];
  };

  Staff.prototype.getDepartmentName = function() {
    const deptNames = {
      'clinical': 'Vận hành lâm sàng',
      'system': 'Hệ thống & IT',
      'support': 'Chăm sóc khách hàng',
      'finance': 'Tài chính kế toán',
      'content': 'Nội dung & Truyền thông'
    };
    return deptNames[this.department] || 'Chưa phân loại';
  };

  Staff.prototype.getAccessLevelName = function() {
    const levels = {
      1: 'Nhân viên thường',
      2: 'Nhân viên cao cấp',
      3: 'Trưởng phòng',
      4: 'Phó giám đốc',
      5: 'Giám đốc'
    };
    return levels[this.access_level] || 'Không xác định';
  };

  console.log('SUCCESS: Model Staff đã được định nghĩa (cập nhật).');
  return Staff;
};