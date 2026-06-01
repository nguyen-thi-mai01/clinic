// server/config/usersSeed.js
// Hàm seed dữ liệu cho bảng Users
const bcrypt = require('bcrypt');

module.exports = async function seedUsers(models, transaction) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('123456', salt);

  const usersData = [];

  const familyNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
  const middleNames = ['Văn', 'Thị', 'Minh', 'Gia', 'Hữu', 'Thanh'];
  const givenNames = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khánh', 'Lan', 'Mai'];
  const buildDoctorName = (index) => {
    const family = familyNames[index % familyNames.length];
    const middle = middleNames[Math.floor(index / familyNames.length) % middleNames.length];
    const given = givenNames[Math.floor(index / (familyNames.length * middleNames.length)) % givenNames.length];
    return `${family} ${middle} ${given}`;
  };

  // 10 patients
  for (let i = 1; i <= 10; i++) {
    usersData.push({
      username: `patient${i}`,
      email: `patient${i}@example.com`,
      password_hash: hashedPassword,
      full_name: `Bệnh nhân ${i}`,
      phone: `0900000${String(100 + i).slice(-3)}`,
      role: 'patient',
      avatar_url: `/avatars/patient${i}.jpg`,
      is_active: true,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  // 5 staff cơ bản (giữ nguyên để tương thích)
  const staffDepts = ['system','support','clinical','content','finance'];
  for (let i = 1; i <= 5; i++) {
    usersData.push({
      username: `staff${i}`,
      email: `staff${i}@example.com`,
      password_hash: hashedPassword,
      full_name: `Nhân viên ${i}`,
      phone: `0910000${String(200 + i).slice(-3)}`,
      role: 'staff',
      avatar_url: `/avatars/staff${i}.jpg`,
      is_active: true,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  // ===== BỔ SUNG 10 STAFF MỚI VỚI PHÒNG BAN RÕ RÀNG =====
  const newStaffData = [
    // Phòng Vận hành lâm sàng (Clinical) - 3 người
    { 
      username: 'staff_clinical_manager', 
      email: 'clinical.manager@example.com',
      full_name: 'Nguyễn Thị Hoa',
      phone: '0901234501',
      department: 'clinical'
    },
    { 
      username: 'staff_clinical_1', 
      email: 'clinical.staff1@example.com',
      full_name: 'Trần Văn Nam',
      phone: '0901234502',
      department: 'clinical'
    },
    { 
      username: 'staff_clinical_2', 
      email: 'clinical.staff2@example.com',
      full_name: 'Lê Thị Mai',
      phone: '0901234503',
      department: 'clinical'
    },
    
    // Phòng Hệ thống & IT (System) - 2 người
    { 
      username: 'staff_it_manager', 
      email: 'it.manager@example.com',
      full_name: 'Phạm Minh Tuấn',
      phone: '0901234504',
      department: 'system'
    },
    { 
      username: 'staff_it_1', 
      email: 'it.staff1@example.com',
      full_name: 'Hoàng Văn Đức',
      phone: '0901234505',
      department: 'system'
    },
    
    // Phòng Chăm sóc khách hàng (Support) - 2 người
    { 
      username: 'staff_support_manager', 
      email: 'support.manager@example.com',
      full_name: 'Đỗ Thị Lan',
      phone: '0901234506',
      department: 'support'
    },
    { 
      username: 'staff_support_1', 
      email: 'support.staff1@example.com',
      full_name: 'Vũ Văn Hùng',
      phone: '0901234507',
      department: 'support'
    },
    
    // Phòng Tài chính kế toán (Finance) - 2 người
    { 
      username: 'staff_finance_manager', 
      email: 'finance.manager@example.com',
      full_name: 'Bùi Thị Thu',
      phone: '0901234508',
      department: 'finance'
    },
    { 
      username: 'staff_finance_1', 
      email: 'finance.staff1@example.com',
      full_name: 'Ngô Văn Toàn',
      phone: '0901234509',
      department: 'finance'
    },
    
    // Phòng Nội dung & Truyền thông (Content) - 1 người
    { 
      username: 'staff_content_manager', 
      email: 'content.manager@example.com',
      full_name: 'Lý Thị Hương',
      phone: '0901234510',
      department: 'content'
    }
  ];

  for (const staff of newStaffData) {
    usersData.push({
      username: staff.username,
      email: staff.email,
      password_hash: hashedPassword,
      full_name: staff.full_name,
      phone: staff.phone,
      role: 'staff',
      avatar_url: `/avatars/${staff.username}.jpg`,
      is_active: true,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    });
  }
  // ===== KẾT THÚC BỔ SUNG =====

  // 42 doctors để mỗi chuyên khoa có ít nhất 2 và dao động lên đến 5 bác sĩ
  for (let i = 1; i <= 42; i++) {
    usersData.push({
      username: `doctor${i}`,
      email: `doctor${i}@example.com`,
      password_hash: hashedPassword,
      full_name: `BS. ${buildDoctorName(i - 1)}`,
      phone: `0920000${String(300 + i).slice(-3)}`,
      role: 'doctor',
      avatar_url: `/avatars/doctor${i}.jpg`,
      is_active: true,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  // 2 admins
  for (let i = 1; i <= 2; i++) {
    usersData.push({
      username: `admin${i}`,
      email: `admin${i}@example.com`,
      password_hash: hashedPassword,
      full_name: `Quản trị viên ${i}`,
      phone: `0930000${String(400 + i).slice(-3)}`,
      role: 'admin',
      avatar_url: `/avatars/admin${i}.jpg`,
      is_active: true,
      is_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  const users = await models.User.bulkCreate(usersData, { transaction });
  return users;
};