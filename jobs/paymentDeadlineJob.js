// server/jobs/paymentDeadlineJob.js
// Cron job kiểm tra và xử lý payment deadline
// Cơ chế: Mỗi 5 phút, tìm các appointment online chưa thanh toán với deadline đã qua -> auto-cancel

const cron = require('node-cron');
const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');
const notificationHelper = require('../utils/notificationHelper');
const emailSender = require('../utils/emailSender');

/**
 * Gửi thông báo auto-cancel cho bệnh nhân
 */
async function notifyPaymentDeadlineExpired(appointment) {
  try {
    const patientEmail = appointment.Patient?.user?.email || appointment.guest_email;
    const patientName = appointment.Patient?.user?.full_name || appointment.guest_name || 'Bệnh nhân';
    
    if (!patientEmail) {
      console.warn(`[DeadlineJob] Không tìm thấy email cho appointment ${appointment.code}`);
      return;
    }

    const emailContent = {
      to: patientEmail,
      subject: `[Hủ MẠNG] Lịch hẹn bị huỷ do chưa thanh toán - ${appointment.code}`,
      template: 'appointment_cancelled_payment_deadline',
      data: {
        patient_name: patientName,
        appointment_code: appointment.code,
        doctor_name: appointment.Doctor?.user?.full_name || 'Bác sĩ',
        service_name: appointment.Service?.name || 'Dịch vụ',
        appointment_date: new Date(appointment.appointment_date).toLocaleDateString('vi-VN'),
        appointment_start_time: appointment.appointment_start_time,
        clinic_phone: process.env.CLINIC_PHONE || '(028) 3837 8888',
        clinic_address: process.env.CLINIC_ADDRESS || 'TP. Hồ Chí Minh'
      }
    };

    console.log(`[DeadlineJob] Gửi email huỷ do deadline cho ${patientEmail}`);
    await emailSender.sendEmail(emailContent);

    // Tạo notification cho bệnh nhân
    if (appointment.Patient?.user_id) {
      await notificationHelper.createNotification({
        user_id: appointment.Patient.user_id,
        type: 'appointment_cancelled',
        title: 'Lịch hẹn bị huỷ',
        message: `Lịch hẹn ${appointment.code} đã huỷ do chưa thanh toán trong hạn. Vui lòng đặt lịch mới.`,
        link: `/appointments/${appointment.code}`,
        data: {
          appointment_id: appointment.id,
          reason: 'payment_deadline_expired'
        }
      });
    }

  } catch (error) {
    console.error(`[DeadlineJob] Lỗi gửi thông báo cho appointment ${appointment.code}:`, error.message);
  }
}

/**
 * Gửi thông báo auto-cancel cho tư vấn
 */
async function notifyConsultationPaymentDeadlineExpired(consultation) {
  try {
    const patientEmail = consultation.patient?.email;
    const patientName = consultation.patient?.full_name || 'Bệnh nhân';

    if (patientEmail) {
      console.log(`[DeadlineJob] Gửi email huỷ do deadline cho ${patientEmail}`);
      await emailSender.sendEmail({
        to: patientEmail,
        subject: `[Easy Medify] Lịch tư vấn bị huỷ do chưa thanh toán - ${consultation.consultation_code}`,
        template: 'consultation_cancelled_payment_deadline',
        data: {
          patientName,
          consultationCode: consultation.consultation_code,
          doctorName: consultation.doctor?.full_name || 'Bác sĩ',
          consultationType: consultation.consultation_type === 'video' ? 'Video Call' : consultation.consultation_type === 'offline' ? 'Tại bệnh viện' : 'Chat',
          appointmentTime: new Date(consultation.appointment_time).toLocaleString('vi-VN'),
          paymentDeadline: consultation.payment_due_at ? new Date(consultation.payment_due_at).toLocaleString('vi-VN') : '---',
          consultationLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/tu-van/${consultation.id}`
        }
      });
    }

    await notificationHelper.createNotification({
      user_id: consultation.patient_id,
      type: 'consultation_cancelled',
      title: 'Lịch tư vấn bị huỷ',
      message: `Lịch tư vấn ${consultation.consultation_code} đã bị huỷ do quá hạn thanh toán.`,
      link: `/tu-van/${consultation.id}`,
      data: {
        consultation_id: consultation.id,
        reason: 'payment_deadline_expired'
      }
    });
  } catch (error) {
    console.error(`[DeadlineJob] Lỗi gửi notification cho consultation ${consultation.consultation_code}:`, error.message);
  }
}

/**
 * Job chính: Kiểm tra payment deadline và auto-cancel
 * Quy tắc:
 * - Online appointment (VNPay, MoMo, bank_transfer)
 * - Status = pending, payment_status = unpaid
 * - payment_hold_until < now => auto-cancel
 */
async function checkAndCancelExpiredPayments() {
  try {
    const now = new Date();
    console.log(`[DeadlineJob] Kiểm tra deadline thanh toán lúc ${now.toLocaleString('vi-VN')}`);

    // Tìm các appointment hết deadline nhưng chưa thanh toán
    const expiredAppointments = await models.Appointment.findAll({
      where: {
        status: 'pending',
        payment_status: 'unpaid',
        payment_method: {
          [Op.in]: ['vnpay', 'momo', 'bank_transfer']
        },
        payment_hold_until: {
          [Op.lt]: now // deadline đã qua
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
        { model: models.Service, as: 'Service', attributes: ['name', 'price'] }
      ],
      raw: false
    });

    console.log(`[DeadlineJob] Tìm thấy ${expiredAppointments.length} appointments hết deadline`);

    let cancelledCount = 0;
    for (const appointment of expiredAppointments) {
      try {
        // Auto-cancel appointment
        await appointment.update({
          status: 'cancelled',
          cancelled_at: now,
          cancelled_by: 'system',
          cancel_reason: 'Payment deadline expired - thanh toán không kịp hạn'
        });

        // Thông báo cho bệnh nhân
        await notifyPaymentDeadlineExpired(appointment);
        cancelledCount++;

        console.log(`[DeadlineJob] Huỷ appointment ${appointment.code} do hết deadline`);

      } catch (error) {
        console.error(`[DeadlineJob] Lỗi khi huỷ appointment ${appointment.code}:`, error.message);
      }
    }

    // Tìm các consultation hết hạn thanh toán
    const expiredConsultations = await models.Consultation.findAll({
      where: {
        status: { [Op.in]: ['pending', 'confirmed'] },
        payment_status: 'unpaid',
        payment_due_at: {
          [Op.lt]: now
        }
      },
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['id', 'email', 'full_name']
        },
        {
          model: models.User,
          as: 'doctor',
          attributes: ['id', 'email', 'full_name']
        }
      ],
      raw: false
    });

    console.log(`[DeadlineJob] Tìm thấy ${expiredConsultations.length} consultations hết deadline`);

    let cancelledConsultationCount = 0;
    for (const consultation of expiredConsultations) {
      try {
        await consultation.update({
          status: 'cancelled',
          cancelled_at: now,
          cancelled_by: 'system',
          cancel_reason: 'Payment deadline expired - thanh toán không kịp hạn'
        });

        await notifyConsultationPaymentDeadlineExpired(consultation);
        cancelledConsultationCount++;
        console.log(`[DeadlineJob] Huỷ consultation ${consultation.consultation_code} do hết deadline`);
      } catch (error) {
        console.error(`[DeadlineJob] Lỗi khi huỷ consultation ${consultation.consultation_code}:`, error.message);
      }
    }

    console.log(`[DeadlineJob] Hoàn thành: Huỷ ${cancelledCount}/${expiredAppointments.length} appointments, ${cancelledConsultationCount}/${expiredConsultations.length} consultations`);

  } catch (error) {
    console.error('[DeadlineJob] Lỗi trong checkAndCancelExpiredPayments:', error);
  }
}

/**
 * Khởi động cron job: Chạy mỗi 5 phút
 */
function startPaymentDeadlineJob() {
  console.log('[DeadlineJob] Khởi động payment deadline job (mỗi 5 phút)');
  
  // "0 */5 * * * *" = Mỗi 5 phút
  const job = cron.schedule('0 */5 * * * *', () => {
    console.log(`[DeadlineJob] Chạy lúc ${new Date().toLocaleString('vi-VN')}`);
    checkAndCancelExpiredPayments().catch(err => {
      console.error('[DeadlineJob] Lỗi khi chạy job:', err);
    });
  });

  return job;
}

module.exports = {
  startPaymentDeadlineJob,
  checkAndCancelExpiredPayments // Export riêng để test
};
