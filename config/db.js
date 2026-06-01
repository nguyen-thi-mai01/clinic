// server/config/db.js - HOÀN CHỈNH & SỬA LỖI ASSOCIATE
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');
const { getDefaultSystemSettings } = require('./defaultSystemSettings');

// Import các file seed riêng
const seedSpecialties = require('./specialtiesSeed');
const seedCategories = require('./categoriesSeed');
const seedUsers = require('./usersSeed');
const seedProfiles = require('./profilesSeed');
const seedMedicines = require('./medicinesSeed');
const seedDiseases = require('./diseasesSeed');
const seedArticles = require('./articlesSeed');
const seedInteractions = require('./interactionsSeed');
const seedArticleReviewHistory = require('./articleReviewHistorySeed');
const seedArticleComments = require('./articleCommentsSeed');
const seedSystemSettings = require('./systemSettingsSeed');
const seedConsultationSetting = require('./consultationSeed');
const seedServiceCategories = require('./serviceCategoriesSeed');
const seedServices = require('./servicesSeed');
const seedWorkShiftConfig = require('./workShiftConfigSeed');
const seedSchedules = require('./schedulesSeed');
const seedAppointments = require('./appointmentsSeed');
const seedMedicalRecords = require('./medicalRecordsSeed');
const seedPayments = require('./paymentsSeed');
const seedTopics = require('./topicsSeed_v2'); // Seed riêng cho Topics
const seedForum = require('./forumSeed');
const seedConsultationChat = require('./consultationChatSeed');
const seedConsultationPricing = require('./consultationPricingSeed');const seedCorporateServices = require('./corporateServicesSeed');
const seedRefundRequests = require('./refundRequestsSeed');  
// Load environment variables from server/.env (app.js already loads dotenv,
// but ensure config files loaded when required directly)
require('dotenv').config({
  path: path.join(__dirname, '../.env')
});

// Log để kiểm tra biến môi trường được load
console.log('Database Config:', {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD ? '[SET]' : '[NOT SET]'
});

// Khởi tạo Sequelize
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: console.log
});

// Hàm để kiểm tra kết nối database
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('SUCCESS: Kết nối database thành công.');
    return true;
  } catch (error) {
    console.error('ERROR: Không thể kết nối database:', error.message);
    return false;
  }
}

// Hàm khởi tạo cơ sở dữ liệu
async function initializeDatabase() {
  try {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) {
      throw new Error('Thiếu thông tin cấu hình database');
    }

    console.log('Đang kết nối với MySQL...');

    // Ensure port is used and prefer TCP for localhost to avoid socket issues
    let dbHost = process.env.DB_HOST || '127.0.0.1';
    if (dbHost === 'localhost') dbHost = '127.0.0.1';

    const connection = await mysql.createConnection({
      host: dbHost,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      connectTimeout: 10000
    });

    console.log('Đang tạo database...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
    await connection.end();

    const connected = await testConnection();
    if (!connected) {
      throw new Error('Không thể kết nối với database qua Sequelize');
    }

    return true;
  } catch (error) {
    console.error('ERROR trong initializeDatabase:', error.message);
    console.error('ERROR details:', { code: error.code, stack: error.stack });
    throw error;
  }
}

// === LOAD TẤT CẢ MODEL TỪ THƯ MỤC ===
const models = {};
const modelDir = path.join(__dirname, '../models');
const modelFiles = fs.readdirSync(modelDir).filter(file => file.endsWith('.js') && file !== 'index.js');

modelFiles.forEach(file => {
  try {
    const modelPath = path.join(modelDir, file);
    const model = require(modelPath)(sequelize, Sequelize.DataTypes);
    models[model.name] = model;
    console.log(`SUCCESS: Loaded model ${model.name} from ${file}`);
  } catch (error) {
    console.error(`ERROR: Failed to load model from ${file}:`, error.message);
    throw error;
  }
});

// === THÊM REVIEW NẾU THIẾU ===
if (!models.Review) {
  console.warn('WARNING: Model Review không tồn tại, tạo placeholder...');
  models.Review = sequelize.define('Review', {}, { tableName: 'reviews' });
}

// === THIẾT LẬP QUAN HỆ SAU KHI LOAD TẤT CẢ ===
Object.values(models).forEach(model => {
  if (typeof model.associate === 'function') {
    try {
      model.associate(models);
      console.log(`SUCCESS: Quan hệ cho model ${model.name} đã được thiết lập.`);
    } catch (error) {
      console.error(`ERROR in associate for ${model.name}:`, error.message);
      throw error;
    }
  }
});

if (models.Rating && !models.ConsultationFeedback) {
  models.ConsultationFeedback = models.Rating;
}

// === DEBUG: Kiểm tra Topic model đã load chưa ===
console.log('📋 Models đã load:', Object.keys(models).sort().join(', '));
if (models.Topic) {
  console.log('✅ Topic model đã được load thành công!');
} else {
  console.error('❌ Topic model CHƯA được load!');
}

// Hàm thêm dữ liệu mẫu (chạy khi SYNC_MODE=force)
async function seedData() {
  const transaction = await sequelize.transaction();
  try {
    console.log('Bắt đầu seed dữ liệu trong transaction...');
    
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Không thể kết nối database trước khi seed');
    }

    // 1) Specialties
    console.log('1. Thêm Specialties...');
    const specialties = await seedSpecialties(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng specialties.');

    // 2) Categories
    console.log('2. Thêm Categories...');
    const categories = await seedCategories(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng categories.');

    // Tìm category cho thuoc, benh_ly, tin_tuc
    const thuocCategory = categories.find(c => c.category_type === 'thuoc' && c.name === 'Thuốc giảm đau') || null;
    const benhLyCategory = categories.find(c => c.category_type === 'benh_ly' && c.name === 'Bệnh tim mạch') || null;
    const tinTucCategory = categories.find(c => c.category_type === 'tin_tuc' && c.name === 'Sức khỏe tổng quát') || null;

    console.log('thuocCategory:', thuocCategory ? thuocCategory.toJSON() : 'null');
    console.log('benhLyCategory:', benhLyCategory ? benhLyCategory.toJSON() : 'null');
    console.log('tinTucCategory:', tinTucCategory ? tinTucCategory.toJSON() : 'null');

    if (!thuocCategory || !benhLyCategory || !tinTucCategory) {
      throw new Error('Một hoặc nhiều danh mục không được tìm thấy');
    }

    // 3) Users
    console.log('3. Thêm Users...');
    const users = await seedUsers(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng users.');

    // 4) Profiles (patients, staffs, doctors, admins)
    console.log('4. Thêm Profiles...');
    const profiles = await seedProfiles(models, transaction, { users, specialties });
    const { patients, staffs, doctors, admins } = profiles;
    console.log('SUCCESS: Thêm dữ liệu mẫu cho các bảng profiles.');

    // 5) Medicines
    console.log('5. Thêm Medicines...');
    const medicines = await seedMedicines(models, transaction, { thuocCategory });
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng medicines.');

    // 6) Diseases
    console.log('6. Thêm Diseases...');
    const diseases = await seedDiseases(models, transaction, { benhLyCategory });
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng diseases.');

    // 6.1) Service Categories
    console.log('6.1. Thêm Service Categories...');
    const serviceCategories = await seedServiceCategories(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng service_categories.');

    // 6.2) Services
    console.log('6.2. Thêm Services...');
    const services = await seedServices(models, transaction, { serviceCategories, specialties });
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng services.');

    // 6.2.1) Corporate Services (MỚI)
    console.log('6.2.1. Thêm Corporate Services...');
    const corporateServices = await seedCorporateServices(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu mẫu cho corporate services.');

    // 6.3) WorkShiftConfig (Ca làm việc)
    console.log('6.3. Thêm WorkShiftConfig...');
    const workShifts = await seedWorkShiftConfig(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng work_shift_config.');

    // 6.4) Schedules (doctors availability)
    console.log('6.4. Thêm Schedules...');
    const schedules = await seedSchedules(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng schedules.');

    // 6.5) Appointments
    console.log('6.5. Thêm Appointments...');
    const appointments = await seedAppointments(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng appointments.');

    // 6.6) MedicalRecords
    console.log('6.6. Thêm MedicalRecords...');
    const medicalRecords = await seedMedicalRecords(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng medical_records.');

    // 6.7) Payments
    console.log('6.7. Thêm Payments...');
    const payments = await seedPayments(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng payments.');

    // 7) Articles
    console.log('7. Thêm Articles...');
    const articles = await seedArticles(models, transaction, { tinTucCategory, admins });
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng articles.');

    // 8) Interactions
    console.log('8. Thêm Interactions...');
    console.log('DEBUG: users =', users ? `array[${users.length}]` : 'undefined/null');
    console.log('DEBUG: articles =', articles ? `array[${articles.length}]` : 'undefined/null');
    await seedInteractions(models, transaction, { users, articles });
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng interactions.');

    // 9) ArticleReviewHistory
    console.log('9. Thêm ArticleReviewHistory...');
    await seedArticleReviewHistory(models, transaction, { articles, admins, staffs });
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng article_review_history.');

    // 10) ArticleComment
    console.log('10. Thêm ArticleComment...');
    await seedArticleComments(models, transaction, { articles, users });
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng article_comments.');

    // 11) SystemSettings (basic + default page settings)
    console.log('11. Thêm SystemSettings...');
    await seedSystemSettings(models, transaction, { admins });
    console.log('SUCCESS: Thêm dữ liệu mẫu cho bảng system_settings.');

    // 12) Consultation specific setting
    console.log('12. Thêm SystemSetting cho Consultation...');
    await seedConsultationSetting(models, transaction, { admins });
    console.log('SUCCESS: Thêm SystemSetting cho consultation.');

    // ===== [MỚI] 12.3) Appointment Capacity Config =====
    console.log('12.3. Thêm SystemSetting cho Appointment Optimization...');
    const defaultSettings = getDefaultSystemSettings();
    const appointmentCapacityConfig = defaultSettings.find(s => s.setting_key === 'appointment_capacity_config');
    
    if (appointmentCapacityConfig) {
      // Avoid duplicate insertion if a previous seed already created this setting
      const exists = await models.SystemSetting.findOne({ where: { setting_key: appointmentCapacityConfig.setting_key }, transaction });
      if (!exists) {
        await models.SystemSetting.create({
          setting_key: appointmentCapacityConfig.setting_key,
          value_json: appointmentCapacityConfig.value_json,
          updated_by: admins[0].user_id,
          created_at: new Date(),
          updated_at: new Date()
        }, { transaction });
        console.log('✅ SUCCESS: Thêm Appointment Capacity Config.');
      } else {
        console.log('SKIP: Appointment Capacity Config đã tồn tại, không thêm nữa.');
      }
    }

    // 12.5) Consultation Pricing (Gói dịch vụ tư vấn)
    console.log('12.5. Thêm gói dịch vụ tư vấn (ConsultationPricing)...');
    await seedConsultationPricing(models, transaction, { doctors });
    console.log('SUCCESS: Thêm dữ liệu gói dịch vụ tư vấn.');

    // 13) Forum Topics (CHỦ ĐỀ DIỄN ĐÀN) - PHẢI TRƯỚC QUESTIONS
    console.log('13. Thêm dữ liệu Topics (Chủ đề diễn đàn)...');
    await seedTopics(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu Topics.');

    // 14) Forum (questions, answers, comments, likes)
    console.log('14. Thêm dữ liệu diễn đàn (Questions/Answers/Interactions)...');
    const forum = await seedForum(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu diễn đàn.');

    // 15) Consultation chat/sample messages
    console.log('15. Thêm sample consultation + chat messages...');
    const consultChats = await seedConsultationChat(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu chat tư vấn.');

    // 16) RefundRequests (Danh sách yêu cầu hoàn tiền) - MỚI
    console.log('16. Thêm dữ liệu RefundRequests...');
    const refundRequests = await seedRefundRequests(models, transaction);
    console.log('SUCCESS: Thêm dữ liệu hoàn tiền.');


    await transaction.commit();
    console.log('SUCCESS: Transaction commit thành công. Dữ liệu đã được ghi vào DB.');
    
    // Cập nhật lại log tổng kết (tóm tắt)
console.log('TỔNG KẾT DỮ LIỆU SEED:');
console.log('   Specialties:', specialties.length);
console.log('   Categories:', categories.length);
console.log('   Users:', users.length);
console.log('   Patients:', (patients || []).length);
console.log('   Staffs:', (staffs || []).length);
console.log('   Doctors:', (doctors || []).length);
console.log('   Admins:', (admins || []).length);
console.log('   Medicines:', (medicines || []).length);
console.log('   Diseases:', (diseases || []).length);
console.log('   Articles:', (articles || []).length);
console.log('   RefundRequests:', (refundRequests || []).length);  
    
  } catch (error) {
    await transaction.rollback();
    console.error('ERROR: Transaction rollback:', error.message);
    console.error('ERROR trong seedData:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      errors: error.errors?.map(e => ({
        message: e.message,
        field: e.path,
        value: e.value
      }))
    });
    throw error;
  }
}

module.exports = { sequelize, models, initializeDatabase, seedData, getDefaultSystemSettings };