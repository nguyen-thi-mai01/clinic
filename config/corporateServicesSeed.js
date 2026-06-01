// server/config/corporateServicesSeed.js
// Seed dữ liệu dịch vụ dành cho corporate booking

module.exports = async function seedCorporateServices(models, transaction) {
  const Service = models.Service;
  const ServiceCategory = models.ServiceCategory;
  const Specialty = models.Specialty;

  try {
    console.log('[SEED] 🟢 Bắt đầu seed corporate services...');

    // Lấy category & specialty để liên kết
    const categories = await ServiceCategory.findAll({ transaction });
    const specialties = await Specialty.findAll({ transaction });

    if (!categories.length || !specialties.length) {
      console.log('[SEED] ⚠️ Chưa có category hoặc specialty. Bỏ qua seed corporate services.');
      return [];
    }

    const corporateServices = [
      {
        code: 'CORP-001-KHTQ',
        name: 'Khám tổng quát định kỳ - Gói doanh nghiệp',
        category_id: categories[0].id, // Lấy category đầu tiên
        specialty_id: null, // Không cần chuyên khoa cụ thể
        price: 250000,
        duration: 30,
        short_description: 'Gói khám sức khỏe định kỳ cho nhân viên doanh nghiệp, trường học, sự kiện',
        detailed_content: 'Gồm khám lâm sàng toàn diện, cân nặng, huyết áp, nhịp tim, kiểm tra mắt, tai mũi họng, tim phổi, bụng. Phù hợp cho check-up định kỳ năm một lần.',
        image_url: null,
        doctor_codes: [], // Không cần chọn bác sĩ cụ thể
        allow_doctor_choice: false, // Bác sĩ sẽ được tự động phân công
        is_corp: true, // ⭐ ĐÁNH DẤU LÀ CORPORATE SERVICE
        corp_opts: {
          window_days_limit: 60, // Window có hiệu lực 60 ngày
          max_participants: 100, // Tối đa 100 nhân viên
          price_per_person: 250000, // Giá per capita
          requires_approval: false // Không cần duyệt từng người
        },
        status: 'active'
      },
      {
        code: 'CORP-002-KSKN',
        name: 'Khám sức khỏe nâng cao - Gói công ty',
        category_id: categories[0].id,
        specialty_id: specialties[0]?.id || null,
        price: 450000,
        duration: 45,
        short_description: 'Khám nâng cao kèm cận lâm sàng cho doanh nghiệp lớn',
        detailed_content: 'Bao gồm: khám lâm sàng, đo các chỉ số sức khỏe, X-quang ngực, siêu âm bụng, xét nghiệm máu toàn diện, điện tim.',
        image_url: null,
        doctor_codes: [],
        allow_doctor_choice: false,
        is_corp: true,
        corp_opts: {
          window_days_limit: 90,
          max_participants: 50,
          price_per_person: 450000,
          requires_approval: true // Cần duyệt danh sách từng sự kiện
        },
        status: 'active'
      },
      {
        code: 'CORP-003-KSBC',
        name: 'Khám sức khỏe bán công - Gói sự kiện',
        category_id: categories[0].id,
        specialty_id: null,
        price: 150000,
        duration: 20,
        short_description: 'Kiểm tra sức khỏe nhanh tại sự kiện, lớp học',
        detailed_content: 'Kiểm tra sơ cấp: huyết áp, nhịp tim, nhiệt độ, cân nặng, BMI, kiểm tra tay chân. Khám bệnh lâm sàng cơ bản.',
        image_url: null,
        doctor_codes: [],
        allow_doctor_choice: false,
        is_corp: true,
        corp_opts: {
          window_days_limit: 30,
          max_participants: 200,
          price_per_person: 150000,
          requires_approval: false
        },
        status: 'active'
      }
    ];

    console.log(`[SEED] 📋 Tạo ${corporateServices.length} corporate services...`);

    const created = await Service.bulkCreate(
      corporateServices,
      { transaction, ignoreDuplicates: true }
    );

    console.log(`[SEED] ✅ Tạo ${created.length} corporate services thành công`);

    // Seed sample corporate windows (nếu cần)
    console.log('[SEED] 💡 Ghi chú: Dùng API POST /api/corporate/windows để tạo windows');

    return created;
  } catch (error) {
    console.error('[SEED] ❌ corporateServicesSeed error:', error.message);
    throw error;
  }
};
