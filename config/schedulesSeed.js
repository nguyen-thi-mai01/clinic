// server/config/schedulesSeed.js
module.exports = async function seedSchedules(models, transaction) {
  // Use Doctor model so we can link both user_id and doctor_id on schedules
  const doctors = await models.Doctor.findAll({ include: [{ association: 'user' }], transaction });
  if (!doctors || doctors.length === 0) return [];

  const today = new Date();
  const makeDate = (offsetDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0,10);
  };

  const schedules = [];
  
  // Tạo lịch cho 7 ngày tiếp theo (bao gồm cả hôm nay)
  doctors.forEach((doc) => {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = makeDate(dayOffset);
      
      // Ca sáng: 7:00 - 12:00
      schedules.push({
        user_id: doc.user_id || (doc.user && doc.user.id) || null,
        doctor_id: doc.id,
        schedule_type: 'fixed',
        date,
        start_time: '07:00:00',
        end_time: '12:00:00',
        status: 'available',
        user_type: 'doctor',
        metadata: { note: 'Ca sáng - Auto-seed schedule' }
      });
      
      // Ca chiều: 13:00 - 20:00
      schedules.push({
        user_id: doc.user_id || (doc.user && doc.user.id) || null,
        doctor_id: doc.id,
        schedule_type: 'fixed',
        date,
        start_time: '13:00:00',
        end_time: '20:00:00',
        status: 'available',
        user_type: 'doctor',
        metadata: { note: 'Ca chiều - Auto-seed schedule' }
      });
    }
  });

  try {
    // Xóa lịch cũ trước khi seed mới
    await models.Schedule.destroy({ 
      where: { 
        status: 'available',
        user_type: 'doctor'
      }, 
      transaction 
    });
    
    await models.Schedule.bulkCreate(schedules, { transaction, ignoreDuplicates: true });
    console.log(`✅ Schedules seed: created ${schedules.length} schedules for ${doctors.length} doctors (7 days)`);
  } catch (err) {
    console.error('❌ Error seeding schedules:', err);
  }

  const created = await models.Schedule.findAll({ 
    where: { status: 'available', user_type: 'doctor' }, 
    limit: 200, 
    transaction 
  });
  return created;
};
