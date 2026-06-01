// server/config/servicesSeed.js
module.exports = async function seedServices(models, transaction, opts = {}) {
  const ServiceCategory = models.ServiceCategory;
  const Specialty = models.Specialty;
  const Doctor = models.Doctor;

  const categories = await ServiceCategory.findAll({ transaction });
  const specialties = await Specialty.findAll({ transaction });
  const doctors = await Doctor.findAll({ include: [{ association: 'user' }, { association: 'specialty' }], transaction });

  const getDoctorsBySpecialtyId = (specialtyId) => {
    return doctors.filter(d => Number(d.specialty_id) === Number(specialtyId)).map(d => d.code).filter(Boolean);
  };

  const pickRandom = (arr, n) => {
    const copy = [...arr];
    const result = [];
    while (copy.length && result.length < n) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  };

  const serviceTemplates = [
    { key: 'kham-tong-quat', label: 'Khám tổng quát', duration: 20, priceMin: 120000, priceMax: 220000 },
    { key: 'tu-van-chuyen-khoa', label: 'Tư vấn chuyên khoa', duration: 15, priceMin: 150000, priceMax: 300000 },
    { key: 'danh-gia-chuyen-sau', label: 'Đánh giá chuyên sâu', duration: 30, priceMin: 250000, priceMax: 450000 },
  ];

  const servicesToCreate = [];

  specialties.forEach((specialty, index) => {
    const relatedDoctors = getDoctorsBySpecialtyId(specialty.id);
    const serviceCount = 2 + (index % 2); // 2 hoặc 3 dịch vụ cho mỗi chuyên khoa
    for (let i = 0; i < serviceCount; i++) {
      const template = serviceTemplates[(index + i) % serviceTemplates.length];
      const category = categories[(index + i) % categories.length] || categories[0] || null;
      const maxDoctors = Math.min(3, relatedDoctors.length);
      const assignedDoctors = pickRandom(relatedDoctors, maxDoctors);
      servicesToCreate.push({
        code: `SVC-${specialty.id}-${i + 1}`.padEnd(8, '0'),
        name: `${template.label} ${specialty.name}`,
        category_id: category ? category.id : null,
        specialty_id: specialty.id,
        price: template.priceMin + Math.floor(Math.random() * (template.priceMax - template.priceMin + 1)),
        duration: template.duration + (Math.floor(Math.random() * 3) * 5),
        short_description: `${template.label} dành cho chuyên khoa ${specialty.name}`,
        detailed_content: `Dịch vụ ${template.label.toLowerCase()} cho chuyên khoa ${specialty.name}. Gồm khám lâm sàng, tư vấn, chỉ định cận lâm sàng nếu cần, và hướng dẫn theo dõi sau khám.`,
        image_url: null,
        doctor_codes: assignedDoctors,
        allow_doctor_choice: assignedDoctors.length > 1,
        status: 'active'
      });
    }
  });

  try {
    await models.Service.bulkCreate(servicesToCreate.map(s => ({
      name: s.name,
       code: s.code,
       name: s.name,
       category_id: s.category_id,
      specialty_id: s.specialty_id,
      price: s.price,
      duration: s.duration,
      short_description: s.short_description,
      detailed_content: s.detailed_content,
      image_url: s.image_url,
      doctor_codes: s.doctor_codes,
      allow_doctor_choice: s.allow_doctor_choice,
      status: s.status
    })), { transaction, ignoreDuplicates: true });
  } catch (err) {
    // ignore duplicates
    console.error('servicesSeed bulkCreate error', err.message);
  }

  const names = servicesToCreate.map(s => s.name);
  const created = await models.Service.findAll({ where: { name: names }, transaction });
  return created;
};
