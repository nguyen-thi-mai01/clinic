// server/jobs/appointmentReminderJob.js
// Cron job gửi nhắc nhở lịch hẹn 1 tiếng trước appointment cho bệnh nhân
// Nguyên tắc: Mỗi 5 phút chạy một lần, tìm appointments sắp xảy ra trong 60±5 phút

const cron = require('node-cron');
const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');
const emailSender = require('../utils/emailSender');
const notificationHelper = require('../utils/notificationHelper');

/**
 * Tính toán appointment time từ appointment_date + appointment_start_time
 * VD: "2024-01-15" + "14:30:00" => Date object
 */
function getAppointmentDateTime(appointment_date, appointment_start_time) {
  const dateStr = typeof appointment_date === 'string' ? appointment_date : appointment_date.toISOString().split('T')[0];
  const timeStr = typeof appointment_start_time === 'string' ? appointment_start_time : appointment_start_time;
  return new Date(`${dateStr} ${timeStr}`);
}

/**
 * Gửi reminder email cho bệnh nhân
 */
async function sendReminderEmail(appointment) {
  try {
    const patientEmail = appointment.Patient?.user?.email || appointment.guest_email;
    const patientName = appointment.Patient?.user?.full_name || appointment.guest_name || 'Bệnh nhân';
    
    if (!patientEmail) {
      console.warn(`[ReminderJob] Không tìm thấy email cho appointment ${appointment.code}`);
      return false;
    }

    const appointmentDateTime = getAppointmentDateTime(appointment.appointment_date, appointment.appointment_start_time);
    const formattedTime = appointmentDateTime.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const emailContent = {
      to: patientEmail,
      subject: `[NHẮC NHỜ] Lịch hẹn khám bệnh - ${appointment.code}`,
      template: 'appointment_reminder',
      data: {
        patient_name: patientName,
        appointment_code: appointment.code,
        doctor_name: appointment.Doctor?.user?.full_name || 'Bác sĩ',
        service_name: appointment.Service?.name || 'Dịch vụ',
        appointment_time: formattedTime,
        appointment_date: new Date(appointment.appointment_date).toLocaleDateString('vi-VN'),
        appointment_start_time: appointment.appointment_start_time,
        payment_method: appointment.payment_method || 'Chưa xác định',
        payment_status: appointment.payment_status,
        clinic_phone: process.env.CLINIC_PHONE || '(028) 3837 8888',
        clinic_address: process.env.CLINIC_ADDRESS || 'TP. Hồ Chí Minh'
      }
    };

    console.log(`[ReminderJob] Gửi email nhắc nhở cho ${patientEmail}`);
    return await emailSender.sendEmail(emailContent);

  } catch (error) {
    console.error(`[ReminderJob] Lỗi gửi email reminder cho appointment ${appointment.code}:`, error.message);
    return false;
  }
}

/**
 * Gửi notification cho bệnh nhân
 */
async function sendReminderNotification(appointment) {
  try {
    const appointmentDateTime = getAppointmentDateTime(appointment.appointment_date, appointment.appointment_start_time);
    const formattedTime = appointmentDateTime.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });

    const notificationData = {
      appointment_id: appointment.id,
      appointment_code: appointment.code,
      doctor_name: appointment.Doctor?.user?.full_name || 'Bác sĩ'
    };

    let user_id = null;
    if (appointment.Patient?.user_id) {
      user_id = appointment.Patient.user_id;
    } else if (appointment.guest_token) {
      // Nếu là khách, có thể không có user_id, skip notification
      console.log(`[ReminderJob] Appointment ${appointment.code} là khách - bỏ qua notification`);
      return false;
    }

    if (!user_id) {
      console.warn(`[ReminderJob] Không tìm thấy user_id cho appointment ${appointment.code}`);
      return false;
    }

    const notification = await notificationHelper.createNotification({
      user_id,
      type: 'appointment_reminder',
      title: `Nhắc nhở: Khám bệnh ${formattedTime}`,
      message: `Bạn có lịch hẹn khám với ${appointment.Doctor?.user?.full_name || 'bác sĩ'} vào ${formattedTime}. ${appointment.payment_status === 'unpaid' ? '[Cần thanh toán]' : ''}`,
      link: `/appointments/${appointment.code}`,
      data: notificationData
    });

    return notification ? true : false;

  } catch (error) {
    console.error(`[ReminderJob] Lỗi tạo notification reminder cho appointment ${appointment.code}:`, error.message);
    return false;
  }
}

/**
 * Job chính: Tìm appointments trong 60±5 phút và gửi reminder
 */
async function sendAppointmentReminders() {
  try {
    const now = new Date();
    
    // Tính khoảng thời gian: 55 phút đến 65 phút từ bây giờ
    // (để cover trường hợp job chạy hơi muộn)
    const reminderStart = new Date(now.getTime() + 55 * 60 * 1000);
    const reminderEnd = new Date(now.getTime() + 65 * 60 * 1000);

    console.log(`[ReminderJob] Tìm appointments từ ${reminderStart.toLocaleString('vi-VN')} đến ${reminderEnd.toLocaleString('vi-VN')}`);

    // Query appointments có status = 'confirmed' và chưa được reminder (dùng flag hoặc check)
    // NOTE: Nếu muốn tránh gửi lại, có thể thêm field reminder_sent: BOOLEAN
    const appointments = await models.Appointment.findAll({
      where: {
        status: 'confirmed',
        // Loc: appointment_date = hôm nay hoặc ngày mai
        appointment_date: {
          [Op.between]: [
            new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          ]
        }
      },
      include: [
        {
          model: models.Patient,
          as: 'Patient',
          include: [{ model: models.User, as: 'User', attributes: ['id', 'email', 'full_name'] }]
        },
        {
          model: models.Doctor,
          as: 'Doctor',
          include: [{ model: models.User, as: 'user', attributes: ['full_name', 'email'] }]
        },
        { model: models.Service, as: 'Service', attributes: ['name'] }
      ],
      raw: false
    });

    console.log(`[ReminderJob] Tìm thấy ${appointments.length} appointments`);

    let reminderSent = 0;
    for (const appointment of appointments) {
      const appointmentDateTime = getAppointmentDateTime(appointment.appointment_date, appointment.appointment_start_time);
      
      // Kiểm tra xem appointment có nằm trong khoảng 55-65 phút không
      if (appointmentDateTime >= reminderStart && appointmentDateTime <= reminderEnd) {
        console.log(`[ReminderJob] Gửi reminder cho ${appointment.code}`);
        
        const emailOk = await sendReminderEmail(appointment);
        const notifOk = await sendReminderNotification(appointment);
        
        if (emailOk || notifOk) {
          reminderSent++;
          // Optional: Đánh dấu đã gửi (nếu có field reminder_sent)
          // await appointment.update({ reminder_sent: true });
        }
      }
    }

    console.log(`[ReminderJob] Hoàn thành: Gửi ${reminderSent} reminder`);

  } catch (error) {
    console.error('[ReminderJob] Lỗi trong sendAppointmentReminders:', error);
  }
}

/**
 * Khởi động cron job: Chạy mỗi 5 phút
 */
function startAppointmentReminderJob() {
  console.log('[ReminderJob] Khởi động appointment reminder job (mỗi 5 phút)');
  
  // "0 */5 * * * *" = Mỗi 5 phút
  const job = cron.schedule('0 */5 * * * *', () => {
    console.log(`[ReminderJob] Chạy lúc ${new Date().toLocaleString('vi-VN')}`);
    sendAppointmentReminders().catch(err => {
      console.error('[ReminderJob] Lỗi khi chạy job:', err);
    });
  });

  return job;
}

module.exports = {
  startAppointmentReminderJob,
  sendAppointmentReminders // Export riêng để test
};
