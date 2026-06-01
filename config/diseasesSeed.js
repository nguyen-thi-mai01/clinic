// server/config/diseasesSeed.js
// Hàm seed dữ liệu cho bảng Diseases
module.exports = async function seedDiseases(models, transaction, context = {}) {
  const benhLyCategory = context.benhLyCategory;
  if (!benhLyCategory) throw new Error('diseasesSeed requires benhLyCategory');
  const dis = [
    { name: 'Tăng huyết áp', symptoms: 'Đau đầu, chóng mặt', causes: 'Di truyền, lối sống', treatments: 'Thuốc hạ huyết áp, chế độ ăn', prevention: 'Giảm muối, tập thể dục' },
    { name: 'Đau nửa đầu', symptoms: 'Đau đầu một bên, buồn nôn', causes: 'Stress, hormone', treatments: 'Thuốc giảm đau, nghỉ ngơi', prevention: 'Tránh trigger' },
    { name: 'Viêm họng', symptoms: 'Đau họng, ho', causes: 'Virus, vi khuẩn', treatments: 'Kháng sinh nếu cần', prevention: 'Giữ ấm, rửa tay' },
    { name: 'Viêm phổi', symptoms: 'Sốt, ho, khó thở', causes: 'Nhiễm trùng', treatments: 'Kháng sinh, thở oxy', prevention: 'Tiêm phòng, vệ sinh' },
    { name: 'Tiêu chảy cấp', symptoms: 'Tiêu chảy, mất nước', causes: 'Nhiễm trùng, thực phẩm', treatments: 'Bù nước, kháng sinh nếu cần', prevention: 'Ăn uống hợp vệ sinh' },
    { name: 'Loét dạ dày', symptoms: 'Đau thượng vị, ợ nóng', causes: 'HP, NSAIDs', treatments: 'Kháng acid, diệt HP', prevention: 'Tránh NSAIDs, ăn đúng bữa' },
    { name: 'Viêm gan', symptoms: 'Vàng da, mệt mỏi', causes: 'Virus, rượu', treatments: 'Điều trị virus/điều trị hỗ trợ', prevention: 'Tiêm phòng, tránh tiếp xúc máu' },
    { name: 'Đái tháo đường type 2', symptoms: 'Khát nước, tiểu nhiều', causes: 'Kháng insulin, lối sống', treatments: 'Metformin, insulin', prevention: 'Giảm cân, vận động' },
    { name: 'Viêm khớp dạng thấp', symptoms: 'Đau, sưng khớp', causes: 'Miễn dịch', treatments: 'DMARDs', prevention: 'Phát hiện sớm' },
    { name: 'Hen suyễn', symptoms: 'Khó thở, ho', causes: 'Dị ứng, yếu tố di truyền', treatments: 'Inhaler, corticosteroid', prevention: 'Tránh trigger' },
    { name: 'Viêm tai giữa', symptoms: 'Đau tai, sốt', causes: 'Nhiễm trùng', treatments: 'Kháng sinh, rút dịch', prevention: 'Tiêm phòng, vệ sinh' },
    { name: 'Trĩ', symptoms: 'Chảy máu, đau hậu môn', causes: 'Táo bón, áp lực', treatments: 'Thuốc, phẫu thuật nếu nặng', prevention: 'Chế độ ăn nhiều chất xơ' },
    { name: 'Sỏi thận', symptoms: 'Đau quặn, tiểu máu', causes: 'Tạo tinh thể', treatments: 'Tan sỏi, phẫu thuật', prevention: 'Uống đủ nước' },
    { name: 'Viêm da cơ địa', symptoms: 'Ngứa, đỏ da', causes: 'Dị ứng, gen', treatments: 'Kem dưỡng, steroid', prevention: 'Tránh kích thích' },
    { name: 'Nhiễm trùng tiết niệu', symptoms: 'Tiểu buốt, tiểu nhiều', causes: 'Vi khuẩn', treatments: 'Kháng sinh', prevention: 'Uống nước, vệ sinh' },
    { name: 'Rối loạn lipid máu', symptoms: 'Thường không triệu chứng', causes: 'Dinh dưỡng', treatments: 'Statin', prevention: 'Chế độ ăn lành mạnh' },
    { name: 'Viêm tụy cấp', symptoms: 'Đau bụng dữ dội', causes: 'Rượu, sỏi mật', treatments: 'Hỗ trợ, phẫu thuật nếu cần', prevention: 'Hạn chế rượu' },
    { name: 'U nhú da lành tính', symptoms: 'Nốt da', causes: 'Nhiều nguyên nhân', treatments: 'Loại bỏ nếu cần', prevention: 'Kiểm tra da' },
    { name: 'Viêm mũi dị ứng', symptoms: 'Hắt hơi, ngứa mũi', causes: 'Dị nguyên', treatments: 'Thuốc kháng histamine', prevention: 'Tránh dị nguyên' },
    { name: 'Rối loạn lo âu', symptoms: 'Lo lắng quá mức', causes: 'Tâm lý', treatments: 'Liệu pháp, thuốc', prevention: 'Quản lý stress' }
  ];

  const diseases = await models.Disease.bulkCreate(dis.map(d => ({
    category_id: benhLyCategory.id,
    name: d.name,
    symptoms: d.symptoms || null,
    causes: d.causes || null,
    treatments: d.treatments || null,
    description: d.description || null,
    slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    created_at: new Date(),
    updated_at: new Date()
  })), { transaction });

  return diseases;
};