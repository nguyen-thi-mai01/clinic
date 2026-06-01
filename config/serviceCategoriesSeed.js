// server/config/serviceCategoriesSeed.js
module.exports = async function seedServiceCategories(models, transaction) {
  const categories = [
    { name: 'Gói Khám Tổng Quát', description: 'Gói khám toàn diện cho mọi lứa tuổi' },
    { name: 'Gói Khám Tim Mạch', description: 'Khám và test chuyên sâu tim mạch' },
    { name: 'Gói Khám Nhi', description: 'Gói khám cho trẻ em và nhi khoa' },
    { name: 'Gói Khám Sản Phụ Khoa', description: 'Khám thai và phụ khoa' },
    { name: 'Gói Khám Cột Sống', description: 'Khám chuyên khoa cột sống và xương khớp' },
    { name: 'Gói Khám Da Liễu', description: 'Khám và tư vấn da liễu' },
    { name: 'Gói Khám Tai Mũi Họng', description: 'Khám chuyên khoa tai mũi họng' },
    { name: 'Gói Khám Thần Kinh', description: 'Khám chuyên sâu thần kinh' },
    { name: 'Gói Khám Tiêu Hóa', description: 'Khám tiêu hóa, nội soi khi cần' },
    { name: 'Gói Khám Sức Khỏe Nam Nữ', description: 'Khám nam khoa / phụ khoa chuyên sâu' }
  ];

  try {
    await models.ServiceCategory.bulkCreate(categories.map(c => ({
      name: c.name,
      description: c.description
    })), { transaction, ignoreDuplicates: true });
  } catch (err) {
    // ignore duplicate errors for safety
  }

  const names = categories.map(c => c.name);
  const created = await models.ServiceCategory.findAll({ where: { name: names }, transaction });
  return created;
};
