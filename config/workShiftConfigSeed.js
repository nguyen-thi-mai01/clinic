// server/config/workShiftConfigSeed.js
/**
 * Seed dữ liệu cho WorkShiftConfig (Ca làm việc của hệ thống)
 */
module.exports = async function seedWorkShiftConfig(models, transaction) {
  try {
    // Kiểm tra xem đã có dữ liệu chưa
    const existingCount = await models.WorkShiftConfig.count({ transaction });
    if (existingCount > 0) {
      console.log('⚠️  WorkShiftConfig đã tồn tại, bỏ qua seeding.');
      return await models.WorkShiftConfig.findAll({ transaction });
    }

    const shifts = [
      {
        shift_name: 'morning',
        display_name: 'Ca Sáng',
        start_time: '07:00:00',
        end_time: '12:00:00',
        days_of_week: [1, 2, 3, 4, 5, 6], // Thứ 2-7
        is_active: true
      },
      {
        shift_name: 'afternoon',
        display_name: 'Ca Chiều',
        start_time: '12:00:00',
        end_time: '17:00:00',
        days_of_week: [1, 2, 3, 4, 5, 6], // Thứ 2-7
        is_active: true
      },
      {
        shift_name: 'evening',
        display_name: 'Ca Tối',
        start_time: '17:00:00',
        end_time: '21:00:00',
        days_of_week: [1, 2, 3, 4, 5, 6], // Thứ 2-7
        is_active: true
      },
      {
        shift_name: 'night',
        display_name: 'Ca Đêm',
        start_time: '21:00:00',
        end_time: '06:00:00',
        days_of_week: [1, 2, 3, 4, 5, 6], // Thứ 2-7
        is_active: false
      }
    ];

    const created = await models.WorkShiftConfig.bulkCreate(shifts, {
      transaction,
      ignoreDuplicates: true
    });

    console.log(`✅ Đã tạo ${created.length} ca làm việc trong WorkShiftConfig`);
    return created;
  } catch (error) {
    console.error('❌ Lỗi seeding WorkShiftConfig:', error.message);
    return [];
  }
};
