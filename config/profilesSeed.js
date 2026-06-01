// server/config/profilesSeed.js
// Hàm seed cho bảng Patient, Staff, Doctor, Admin profiles (hỗ trợ số lượng động)
const { getPermissionsTemplate } = require('./departmentPermissions');

module.exports = async function seedProfiles(models, transaction, context = {}) {
  const users = context.users;
  if (!users || users.length === 0) throw new Error('profilesSeed requires users array');

  // Group users by role
  const patientUsers = users.filter(u => u.role === 'patient');
  const staffUsers = users.filter(u => u.role === 'staff');
  const doctorUsers = users.filter(u => u.role === 'doctor');
  const adminUsers = users.filter(u => u.role === 'admin');

  // Patients
  const patientCount = await models.Patient.count({ transaction });
  const patientData = patientUsers.map((u, idx) => ({
    user_id: u.id,
    username: u.username,
    code: `PT${String(patientCount + idx + 1).padStart(5, '0')}`,
    medical_history: idx % 2 === 0 ? 'Không có' : 'Dị ứng penicillin',
    created_at: new Date(),
    updated_at: new Date()
  }));
  const patients = patientData.length ? await models.Patient.bulkCreate(patientData, { transaction, validate: true }) : [];

  // Staffs
  const staffCount = await models.Staff.count({ transaction });
  const defaultDepts = ['system','support','clinical','content','finance'];
  
  // Map username to department cho staff mới
  const deptMapping = {
    'staff_clinical_manager': 'clinical',
    'staff_clinical_1': 'clinical',
    'staff_clinical_2': 'clinical',
    'staff_it_manager': 'system',
    'staff_it_1': 'system',
    'staff_support_manager': 'support',
    'staff_support_1': 'support',
    'staff_finance_manager': 'finance',
    'staff_finance_1': 'finance',
    'staff_content_manager': 'content'
  };
  
  // Map username to rank (manager ranks removed — everyone seeded as staff by default)
  const rankMapping = {};
  
  const staffData = staffUsers.map((u, idx) => {
    const department = deptMapping[u.username] || defaultDepts[idx % defaultDepts.length] || 'support';
    const rank = rankMapping[u.username] || 'staff';
    const permissions = getPermissionsTemplate(department, rank);
    
    return {
      user_id: u.id,
      username: u.username,
      code: `ST${String(staffCount + idx + 1).padStart(5, '0')}`,
      department: department,
      rank: rank,
      permissions: permissions, // Thêm permissions từ template
      job_description: rank === 'manager' 
        ? `Trưởng phòng ${department}` 
        : `Nhân viên ${department}`,
      created_at: new Date(),
      updated_at: new Date()
    };
  });
  const staffs = staffData.length ? await models.Staff.bulkCreate(staffData, { transaction, validate: true }) : [];

  // Doctors
  const doctorCount = await models.Doctor.count({ transaction });
  const specialties = context.specialties || [];
  const buildSpecialtyDistribution = (specialtyList, totalDoctors) => {
    if (!specialtyList.length || totalDoctors <= 0) return [];
    const minPerSpecialty = 2;
    const maxPerSpecialty = 5;
    const counts = specialtyList.map(() => minPerSpecialty);
    let remaining = totalDoctors - (minPerSpecialty * specialtyList.length);
    if (remaining < 0) {
      // Nếu thiếu doctors, trải đều 1 bác sĩ/chuyên khoa trước rồi cắt bớt ở cuối
      return specialtyList.map((spec, idx) => ({ specialty: spec, count: idx < totalDoctors ? 1 : 0 }));
    }
    while (remaining > 0) {
      const index = Math.floor(Math.random() * specialtyList.length);
      if (counts[index] < maxPerSpecialty) {
        counts[index] += 1;
        remaining -= 1;
      }
    }
    return specialtyList.map((spec, idx) => ({ specialty: spec, count: counts[idx] }));
  };

  const specialtyDistribution = buildSpecialtyDistribution(specialties, doctorUsers.length);
  const doctorAssignments = [];
  specialtyDistribution.forEach(({ specialty, count }) => {
    for (let i = 0; i < count; i++) {
      doctorAssignments.push(specialty);
    }
  });

  const doctorsData = doctorUsers.map((u, idx) => {
    const specialty = doctorAssignments[idx] || specialties[idx % specialties.length] || null;
    const years = 5 + (idx % 18);
    const title = ['BS.', 'ThS.', 'TS.', 'PGS. TS.'][idx % 4];
    const position = ['Bác sĩ điều trị', 'Bác sĩ chính', 'Trưởng khoa', 'Chuyên gia tư vấn'][idx % 4];
    return {
      user_id: u.id,
      username: u.username,
      code: `DR${String(doctorCount + idx + 1).padStart(5, '0')}`,
      specialty_id: specialty ? specialty.id : null,
      experience_years: years,
      title,
      position,
      workplace: specialty ? `${specialty.name} - Phòng khám số ${idx + 1}` : `Bệnh viện Trung ương ${idx + 1}`,
      specializations: specialty ? [specialty.name, 'Tư vấn chuyên khoa', 'Khám tổng quát'] : ['Nội tổng quát', 'Siêu âm', 'Điện tim'],
      bio: specialty ? `Bác sĩ ${u.full_name} phụ trách chuyên khoa ${specialty.name}, có ${years} năm kinh nghiệm lâm sàng.` : `Bác sĩ ${u.full_name} có ${years} năm kinh nghiệm lâm sàng.`,
      education: [
        { year: 2005 + (idx % 10), degree: 'Bác sĩ Y khoa', institution: 'Đại học Y Hà Nội', description: null },
        { year: 2010 + (idx % 6), degree: 'Chuyên khoa cấp I/II', institution: specialty ? `${specialty.name} - Bệnh viện tuyến cuối` : `Bệnh viện ${idx + 1}`, description: null }
      ],
      certifications: [
        { name: specialty ? `Chứng chỉ ${specialty.name}` : 'Chứng chỉ chuyên môn', link: null },
        { name: 'Chứng chỉ Giao tiếp lâm sàng', link: null }
      ],
      work_experience: [
        { period: `${2012 + idx}-${2016 + idx}`, position, hospital: specialty ? `Khoa ${specialty.name} - Bệnh viện đa khoa` : `Bệnh viện ${idx + 1}`, department: specialty ? specialty.name : null, description: null }
      ],
      research: [
        { title: `Nghiên cứu về ${specialty ? specialty.name : 'y khoa tổng quát'}`, journal: 'Tạp chí Y học', year: 2018 + (idx % 5), authors: u.full_name }
      ],
      achievements: [
        { title: specialty ? `Thành tích chuyên khoa ${specialty.name}` : `Thành tích lâm sàng ${idx + 1}`, link: null }
      ],
      created_at: new Date(),
      updated_at: new Date()
    };
  });
  const doctors = doctorsData.length ? await models.Doctor.bulkCreate(doctorsData, { transaction, validate: true }) : [];

  // Admins
  const adminCount = await models.Admin.count({ transaction });
  const adminData = adminUsers.map((u, idx) => ({
    user_id: u.id,
    username: u.username,
    code: `AD${String(adminCount + idx + 1).padStart(5, '0')}`,
    permissions_json: idx === 0 ? ['all'] : ['manage_users','manage_content'],
    created_at: new Date(),
    updated_at: new Date()
  }));
  const admins = adminData.length ? await models.Admin.bulkCreate(adminData, { transaction, validate: true }) : [];

  return { patients, staffs, doctors, admins };
};