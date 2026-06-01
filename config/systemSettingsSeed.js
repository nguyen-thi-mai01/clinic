// server/config/systemSettingsSeed.js
// Hàm seed dữ liệu cho bảng SystemSetting (site-level settings)
const { getDefaultSystemSettings } = require('./defaultSystemSettings');

module.exports = async function seedSystemSettings(models, transaction, context = {}) {
  const admins = context.admins;
  if (!admins || admins.length === 0) throw new Error('systemSettingsSeed requires admins');

  // Basic settings
  await models.SystemSetting.bulkCreate([
    { setting_key: 'site_name', value_json: 'Easy Medify', updated_by: admins[0].user_id, created_at: new Date(), updated_at: new Date() },
    { setting_key: 'contact_email', value_json: 'support@easymedify.vn', updated_by: admins[1].user_id, created_at: new Date(), updated_at: new Date() }
  ], { transaction });

  // Default page settings from defaultSystemSettings.js
  const defaultSettings = getDefaultSystemSettings();
  for (const setting of defaultSettings) {
    await models.SystemSetting.create({
      setting_key: setting.setting_key,
      value_json: setting.value_json,
      updated_by: admins[0].user_id,
      created_at: new Date(),
      updated_at: new Date()
    }, { transaction });
  }

  return true;
};