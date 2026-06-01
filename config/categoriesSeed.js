// server/config/categoriesSeed.js
// Hàm seed dữ liệu cho bảng Categories
module.exports = async function seedCategories(models, transaction) {
  const categories = await models.Category.bulkCreate([
    { category_type: 'thuoc', name: 'Thuốc giảm đau', slug: 'thuoc-giam-dau', description: 'Các loại thuốc giảm đau, hạ sốt', created_at: new Date(), updated_at: new Date() },
    { category_type: 'thuoc', name: 'Thuốc kháng sinh', slug: 'thuoc-khang-sinh', description: 'Các loại thuốc kháng sinh', created_at: new Date(), updated_at: new Date() },
    { category_type: 'thuoc', name: 'Thuốc bổ sung', slug: 'thuoc-bo-sung', description: 'Vitamin và khoáng chất', created_at: new Date(), updated_at: new Date() },
    { category_type: 'benh_ly', name: 'Bệnh tim mạch', slug: 'benh-tim-mach', description: 'Các bệnh liên quan đến tim mạch', created_at: new Date(), updated_at: new Date() },
    { category_type: 'benh_ly', name: 'Bệnh hô hấp', slug: 'benh-ho-hap', description: 'Các bệnh hô hấp', created_at: new Date(), updated_at: new Date() },
    { category_type: 'benh_ly', name: 'Bệnh tiêu hóa', slug: 'benh-tieu-hoa', description: 'Các bệnh tiêu hóa', created_at: new Date(), updated_at: new Date() },
    { category_type: 'tin_tuc', name: 'Sức khỏe tổng quát', slug: 'suc-khoe-tong-quat', description: 'Bài viết về sức khỏe chung', created_at: new Date(), updated_at: new Date() },
    { category_type: 'tin_tuc', name: 'Dinh dưỡng', slug: 'dinh-duong', description: 'Bài viết về dinh dưỡng', created_at: new Date(), updated_at: new Date() },
    { category_type: 'tin_tuc', name: 'Lối sống lành mạnh', slug: 'loi-song-lanh-manh', description: 'Bài viết về lối sống', created_at: new Date(), updated_at: new Date() }
  ], { transaction });

  return categories;
};