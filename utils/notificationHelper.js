// server/utils/notificationHelper.js
const { models } = require('../config/db');

/**
 * Tạo thông báo cho một user
 */
const createNotification = async ({ user_id, type, title, message, link, data }) => {
  try {
    if (!user_id || !type || !message) {
      console.error(' createNotification: Thiếu thông tin bắt buộc');
      return null;
    }

    const notification = await models.Notification.create({
      user_id,
      type,
      title: title || 'Thông báo',
      message, // Đúng với model và frontend
      link: link || null,
      data: data || null,
      is_read: false,
      created_at: new Date(),
      updated_at: new Date()
    });

    console.log(`Đã tạo thông báo cho user ${user_id}`);
    return notification;

  } catch (error) {
    console.error('Lỗi khi tạo thông báo:', error.message);
    return null;
  }
};

/**
 * Tạo thông báo cho nhiều users
 */
const createNotifications = async (notifications) => {
  try {
    const results = await Promise.all(
      notifications.map(notif => createNotification(notif))
    );
    return results.filter(r => r !== null);
  } catch (error) {
    console.error(' Lỗi khi tạo nhiều thông báo:', error.message);
    return [];
  }
};

/**
 * Gửi thông báo đến tất cả admin
 */
const notifyAllAdmins = async (type, message, link = null) => {
  try {
    const admins = await models.User.findAll({
      where: { 
        role: 'admin',
        is_active: true 
      },
      attributes: ['id']
    });

    if (admins.length === 0) {
      console.warn(' Không tìm thấy admin nào đang hoạt động');
      return [];
    }

    const notifications = admins.map(admin => ({
      user_id: admin.id,
      type,
      message,
      link
    }));

    return await createNotifications(notifications);

  } catch (error) {
    console.error(' Lỗi khi gửi thông báo đến admin:', error.message);
    return [];
  }
};

module.exports = {
  createNotification,
  createNotifications,
  notifyAllAdmins
};