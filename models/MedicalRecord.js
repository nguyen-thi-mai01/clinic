// server/models/MedicalRecord.js
// Model MỚI để lưu kết quả khám bệnh
const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const MedicalRecord = sequelize.define('MedicalRecord', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    appointment_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true // Mỗi lịch hẹn chỉ có 1 hồ sơ
    },
    patient_id: {
      type: DataTypes.BIGINT,
      allowNull: true // Cho phép Guest (null)
    },
    doctor_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    diagnosis: { // Chẩn đoán
      type: DataTypes.TEXT,
      allowNull: false
    },
    symptoms: { // Triệu chứng
      type: DataTypes.TEXT,
      allowNull: true
    },
    treatment_plan: { // Hướng điều trị
      type: DataTypes.TEXT,
      allowNull: true
    },
    advice: { // Lời khuyên
      type: DataTypes.TEXT,
      allowNull: true
    },
    follow_up_date: { // Ngày tái khám
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    prescription_json: { // Đơn thuốc
      type: DataTypes.JSON,
      allowNull: true
    },
    // Chỉ số sinh tồn do Staff nhập trước khi khám
    vitals_json: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'blood_pressure, temperature, weight, height, heart_rate, spo2, note'
    },
    // Ghi chú lâm sàng sơ bộ (staff nhập)
    clinical_note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Trạng thái: staff_inputted = đã nhập vitals, doctor_completed = bác sĩ đã hoàn thành
    record_stage: {
      type: DataTypes.ENUM('none', 'vitals_inputted', 'completed'),
      defaultValue: 'none',
      allowNull: false
    },
    // (MỚI) Cột lưu file ảnh XN
    test_images_json: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Lưu mảng JSON các object ảnh xét nghiệm'
    },
    // (MỚI) Cột lưu file báo cáo
    report_files_json: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Lưu mảng JSON các object file báo cáo (pdf, docx)'
    },
    // (MỚI) Mã tra cứu (đã hash)
    lookup_code_hash: {
      type: DataTypes.STRING,
      allowNull: true, // Sẽ được tạo khi lưu
      unique: true
    },
    // (MỚI) Cột check đã gửi mail
    lookup_code_sent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'medical_records',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['patient_id'] },
      { fields: ['doctor_id'] }
    ]
  });

  // Hash mã tra cứu trước khi tạo
  MedicalRecord.addHook('beforeCreate', async (record) => {
    if (!record.lookup_code_hash) {
      // 1. Tạo mã ngẫu nhiên (plaintext)
      const lookupCode = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 ký tự
      // 2. Hash mã đó
      const salt = await bcrypt.genSalt(10);
      record.lookup_code_hash = await bcrypt.hash(lookupCode, salt);
      // 3. Gắn mã plaintext vào object (để gửi mail) - KHÔNG LƯU VÀO DB
      record.plaintext_lookup_code = lookupCode;
    }
  });

  // Phương thức xác thực mã tra cứu
  MedicalRecord.prototype.validateLookupCode = async function(code) {
    return await bcrypt.compare(code, this.lookup_code_hash);
  };

  MedicalRecord.associate = (models) => {
    MedicalRecord.belongsTo(models.Appointment, { foreignKey: 'appointment_id', as: 'Appointment' });
    MedicalRecord.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'Patient' });
    MedicalRecord.belongsTo(models.Doctor, { foreignKey: 'doctor_id', as: 'Doctor' });
  };

  return MedicalRecord;
};