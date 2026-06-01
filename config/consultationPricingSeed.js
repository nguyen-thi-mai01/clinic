// server/config/consultationPricingSeed.js
// Seed dữ liệu gói dịch vụ tư vấn

module.exports = async function seedConsultationPricing(models, transaction, context = {}) {
  const ConsultationPricing = models.ConsultationPricing;
  const { doctors } = context;

  if (!doctors || doctors.length === 0) {
    throw new Error('consultationPricingSeed requires doctors in context');
  }

  // Lấy 3 bác sĩ đầu tiên để gán vào gói
  const doctor1Code = doctors[0].code;
  const doctor2Code = doctors[1]?.code;
  const doctor3Code = doctors[2]?.code;

  const packages = [
    // ===== GÓI MIỄN PHÍ =====
    {
      package_code: 'CONS-001-FREE',
      package_name: 'Chat Trực Tiếp Miễn Phí',
      description: 'Tư vấn qua chat cơ bản, phù hợp cho các câu hỏi nhanh về sức khỏe. Thời gian: 15 phút',
      package_type: 'chat',
      duration_minutes: 15,
      price: 0,
      is_active: true,
      doctor_codes: JSON.stringify([doctor1Code, doctor2Code])
    },
    {
      package_code: 'CONS-002-FREE',
      package_name: 'Video Call Miễn Phí',
      description: 'Gói tư vấn video call miễn phí, giới hạn 10 phút. Thích hợp cho tư vấn sơ bộ.',
      package_type: 'video',
      duration_minutes: 10,
      price: 0,
      is_active: true,
      doctor_codes: JSON.stringify([doctor1Code])
    },

    // ===== GÓI 50,000 VNĐ =====
    {
      package_code: 'CONS-003-50K',
      package_name: 'Chat Cơ Bản (30 phút)',
      description: 'Tư vấn qua chat với bác sĩ chuyên khoa. Gồm tư vấn chi tiết và có thể gửi tài liệu.',
      package_type: 'chat',
      duration_minutes: 30,
      price: 50000,
      is_active: true,
      doctor_codes: JSON.stringify([doctor1Code, doctor2Code, doctor3Code])
    },
    {
      package_code: 'CONS-004-50K',
      package_name: 'Video Call Cơ Bản (20 phút)',
      description: 'Tư vấn video call trực tiếp với bác sĩ. Gặp mặt 1-1 qua video HD.',
      package_type: 'video',
      duration_minutes: 20,
      price: 50000,
      is_active: true,
      doctor_codes: JSON.stringify([doctor2Code, doctor3Code])
    },

    // ===== GÓI 100,000 VNĐ =====
    {
      package_code: 'CONS-005-100K',
      package_name: 'Chat Chuyên Sâu (45 phút)',
      description: 'Tư vấn chat chuyên sâu với bác sĩ giàu kinh nghiệm. Bao gồm kê đơn điện tử.',
      package_type: 'chat',
      duration_minutes: 45,
      price: 100000,
      is_active: true,
      doctor_codes: JSON.stringify([doctor1Code, doctor2Code])
    },
    {
      package_code: 'CONS-006-100K',
      package_name: 'Video Call Chuyên Sâu (30 phút)',
      description: 'Video call chuyên sâu với bác sĩ chuyên khoa. Hỗ trợ chia sẻ màn hình, xem kết quả xét nghiệm.',
      package_type: 'video',
      duration_minutes: 30,
      price: 100000,
      is_active: true,
      doctor_codes: JSON.stringify([doctor1Code, doctor3Code])
    },

    // ===== GÓI 300,000 VNĐ =====
    {
      package_code: 'CONS-007-300K',
      package_name: 'Video Call Premium (60 phút)',
      description: 'Gói video call cao cấp với bác sĩ chuyên gia. Tư vấn chi tiết, kê đơn, và theo dõi sau điều trị.',
      package_type: 'video',
      duration_minutes: 60,
      price: 300000,
      is_active: true,
      doctor_codes: JSON.stringify([doctor3Code])
    },

    // ===== GÓI TẠM NGƯNG =====
    {
      package_code: 'CONS-008-VIP',
      package_name: 'Chat VIP Không Giới Hạn (Tạm Ngưng)',
      description: 'Gói VIP không giới hạn thời gian (đang bảo trì). Đăng ký để được thông báo khi khôi phục.',
      package_type: 'chat',
      duration_minutes: 120,
      price: 500000,
      is_active: false,
      doctor_codes: JSON.stringify([doctor1Code])
    }
  ];

  const created = [];
  for (const pkg of packages) {
    const existing = await ConsultationPricing.findOne({
      where: { package_name: pkg.package_name },
      transaction
    });

    if (!existing) {
      const newPkg = await ConsultationPricing.create(pkg, { transaction });
      created.push(newPkg);
    }
  }

  console.log(`✅ ConsultationPricing seed: created ${created.length}/${packages.length} packages`);
  return created;
};
