// server/config/consultationSeed.js
// Hàm seed cho SystemSetting cụ thể về consultation
module.exports = async function seedConsultationSetting(models, transaction, context = {}) {
  const admins = context.admins;
  if (!admins || admins.length === 0) throw new Error('consultationSeed requires admins');

  await models.SystemSetting.create({
    setting_key: 'consultation',
    value_json: {
      enabled: true,
      allow_chat: true,
      allow_video: true,
      allow_offline: true,
      default_chat_duration: 30,
      default_video_duration: 30,
      default_offline_duration: 60,
      platform_fee_percentage: 10,
      min_fee: 100000,
      max_fee: 2000000,
      cancel_before_hours: 24,
      refund_policy: { full_refund: 24, partial_refund: 12, no_refund: 0 },
      auto_cancel_after_minutes: 10,
      reminder_before_minutes: [30, 60],
      working_hours: {
        monday: { start: '08:00', end: '20:00', enabled: true },
        tuesday: { start: '08:00', end: '20:00', enabled: true },
        wednesday: { start: '08:00', end: '20:00', enabled: true },
        thursday: { start: '08:00', end: '20:00', enabled: true },
        friday: { start: '08:00', end: '20:00', enabled: true },
        saturday: { start: '08:00', end: '17:00', enabled: true },
        sunday: { start: '09:00', end: '17:00', enabled: false }
      }
    },
    updated_by: admins[0].user_id,
    created_at: new Date(),
    updated_at: new Date()
  }, { transaction });

  return true;
};