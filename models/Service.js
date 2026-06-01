// server/models/Service.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Service = sequelize.define('Service', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    category_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: 'service_categories', key: 'id' },
      comment: 'Khóa ngoại liên kết tới bảng Danh mục Dịch vụ'
    },
    specialty_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: { model: 'specialties', key: 'id' },
      comment: 'Khóa ngoại liên kết tới chuyên khoa (nếu có)'
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      comment: 'Mã dịch vụ, ví dụ: SVC-001, KHTQ-001'
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Tên dịch vụ là bắt buộc' },
        len: { args: [3, 255], msg: 'Tên dịch vụ phải từ 3-255 ký tự' }
      },
      comment: 'Tên dịch vụ, ví dụ: Siêu âm Tim Doppler Màu'
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Giá là bắt buộc' },
        isInt: { msg: 'Giá phải là số nguyên' },
        min: { args: [0], msg: 'Giá phải >= 0' }
      },
      comment: 'Chi phí của dịch vụ, đơn vị VNĐ'
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Thời lượng là bắt buộc' },
        isInt: { msg: 'Thời lượng phải là số nguyên' },
        min: { args: [1], msg: 'Thời lượng >= 1 phút' }
      },
      comment: 'Thời gian thực hiện dự kiến (phút)'
    },
    short_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Mô tả ngắn gọn hiển thị trên thẻ dịch vụ'
    },
    detailed_content: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      comment: 'Nội dung chi tiết, có thể chứa HTML từ Rich Text Editor'
    },
    image_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        // isUrl: { msg: 'URL ảnh không hợp lệ', args: true, bail: true }
      },
      set(value) { this.setDataValue('image_url', value || null); },
      comment: 'URL hình ảnh đại diện cho dịch vụ'
    },
    // MỚI: LƯU MẢNG CODE BÁC SĨ
    doctor_codes: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Danh sách CODE bác sĩ thực hiện dịch vụ [DR00001, DR00002] - Lấy từ bảng doctors.code'
    },
    allow_doctor_choice: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Cho phép bệnh nhân tự chọn bác sĩ'
    },
    is_corp: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Dịch vụ dành cho đặt lịch theo doanh nghiệp/sự kiện'
    },
    corp_opts: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Tùy chọn corporate: { window_days_limit, max_participants, price_per_person, requires_approval }'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
      allowNull: false,
      validate: { isIn: { args: [['active', 'inactive']], msg: 'Trạng thái phải là active hoặc inactive' } },
      comment: 'Trạng thái của dịch vụ'
    },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'services',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // ASSOCIATIONS
  Service.associate = (models) => {
    if (models.ServiceCategory) {
      Service.belongsTo(models.ServiceCategory, { foreignKey: 'category_id', as: 'category' });
    }
    if (models.Specialty) {
      Service.belongsTo(models.Specialty, { foreignKey: 'specialty_id', as: 'specialty' });
    }
    if (models.Doctor) {
      Service.belongsToMany(models.Doctor, {
        through: 'service_doctors',
        foreignKey: 'service_id',
        otherKey: 'doctor_id',
        timestamps: false,
        as: 'doctors'
      });
    }
    if (models.Appointment) {
      Service.hasMany(models.Appointment, { foreignKey: 'service_id', as: 'appointments' });
    }
  };

  // INSTANCE METHOD: LẤY DANH SÁCH BÁC SĨ TỪ doctor_codes
  Service.prototype.getDoctorsList = async function() {
    if (!this.doctor_codes || !Array.isArray(this.doctor_codes) || this.doctor_codes.length === 0) {
      return [];
    }

    const Doctor = sequelize.models.Doctor;
    const User = sequelize.models.User;
    const Specialty = sequelize.models.Specialty;

    try {
      return await Doctor.findAll({
        where: { code: this.doctor_codes, work_status: 'active' },
        include: [
          { model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'phone', 'avatar'] },
          { model: Specialty, as: 'specialty', attributes: ['id', 'name'] }
        ],
        order: [['user_id', 'ASC']]
      });
    } catch (error) {
      console.error('Error fetching doctors list:', error);
      return [];
    }
  };

  console.log('SUCCESS: Model Service đã được định nghĩa.');
  return Service;
};