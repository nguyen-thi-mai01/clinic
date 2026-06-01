// server/config/specialtiesSeed.js
// Hàm seed dữ liệu cho bảng Specialties
module.exports = async function seedSpecialties(models, transaction) {
  const specialties = await models.Specialty.bulkCreate([
    { name: 'Tim mạch', description: 'Chuyên khoa tim mạch', slug: 'tim-mach', created_at: new Date(), updated_at: new Date() },
    { name: 'Thần kinh', description: 'Chuyên khoa thần kinh', slug: 'than-kinh', created_at: new Date(), updated_at: new Date() },
    { name: 'Nhi khoa', description: 'Chuyên khoa Nhi', slug: 'nhi-khoa', created_at: new Date(), updated_at: new Date() },
    { name: 'Sản phụ khoa', description: 'Chuyên khoa Sản - Phụ khoa', slug: 'san-phu-khoa', created_at: new Date(), updated_at: new Date() },
    { name: 'Tiêu hóa', description: 'Chuyên khoa Tiêu hóa', slug: 'tieu-hoa', created_at: new Date(), updated_at: new Date() },
    { name: 'Hô hấp', description: 'Chuyên khoa Hô hấp', slug: 'ho-hap', created_at: new Date(), updated_at: new Date() },
    { name: 'Da liễu', description: 'Chuyên khoa Da liễu', slug: 'da-lieu', created_at: new Date(), updated_at: new Date() },
    { name: 'Cơ xương khớp', description: 'Chuyên khoa Cơ - Xương - Khớp', slug: 'co-xuong-khop', created_at: new Date(), updated_at: new Date() },
    { name: 'Mắt', description: 'Chuyên khoa Mắt', slug: 'mat', created_at: new Date(), updated_at: new Date() },
    { name: 'Tai mũi họng', description: 'Chuyên khoa Tai - Mũi - Họng', slug: 'tai-mui-hong', created_at: new Date(), updated_at: new Date() },
    { name: 'Răng hàm mặt', description: 'Chuyên khoa Răng - Hàm - Mặt', slug: 'rang-ham-mat', created_at: new Date(), updated_at: new Date() },
    { name: 'Ung bướu', description: 'Chuyên khoa Ung bướu', slug: 'ung-buou', created_at: new Date(), updated_at: new Date() }
  ], { transaction });

  return specialties;
};