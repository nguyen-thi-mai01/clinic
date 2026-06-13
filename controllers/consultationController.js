// server/controllers/consultationController.js
//  FIXED VERSION - Sửa tất cả lỗi

const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const moment = require('moment'); // Thêm Moment.js
const emailSender = require('../utils/emailSender');
const appointmentHelper = require('../utils/appointmentHelper');

// Helper (Copy từ appointmentController)
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const rangesOverlap = (startA, endA, startB, endB) => startA < endB && endA > startB;

/**
 * ==================== PATIENT METHODS ====================
 */

/**
 * Tạo tư vấn mới (Đặt lịch tư vấn)
 * POST /api/consultations
 */
exports.createConsultation = async (req, res) => {
  try {
    const { 
      doctor_id, 
      consultation_pricing_id,
      specialty_id,
      appointment_time,
      chief_complaint,
      medical_history,
      current_medications,
      symptom_duration,
      attachments,
      notes,
      name,
      email,
      phone,
      dob,
      gender,
      // ✅ Nhận voucher từ FE
      voucher_code,
      promotion_id
    } = req.body;

    const isReceptionBooking = req.user?.role === 'staff' || req.user?.role === 'admin';
    let patient_id = req.user.id;

    const normalizeGender = (value) => {
      const raw = String(value || '').trim().toLowerCase();
      if (raw === 'male' || raw === 'nam' || raw === 'm') return 'male';
      if (raw === 'female' || raw === 'nu' || raw === 'nữ' || raw === 'f') return 'female';
      if (raw === 'other' || raw === 'khac' || raw === 'khác') return 'other';
      return null;
    };

    // Validate
    if (!doctor_id || !consultation_pricing_id || !appointment_time || !chief_complaint) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc (bác sĩ, gói dịch vụ, thời gian, triệu chứng)'
      });
    }

    if (isReceptionBooking && (!name || !phone)) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bệnh nhân (họ tên, số điện thoại) cho đặt lịch tại quầy'
      });
    }

    // Staff/Admin đặt giúp bệnh nhân: resolve user bệnh nhân theo phone/email, nếu chưa có thì tạo mới.
    if (isReceptionBooking) {
      const trimmedEmail = String(email || '').trim().toLowerCase();
      const trimmedPhone = String(phone || '').trim();
      const trimmedName = String(name || '').trim();

      let patientUser = null;
      if (trimmedEmail || trimmedPhone) {
        const searchConditions = [];
        if (trimmedEmail) searchConditions.push({ email: trimmedEmail });
        if (trimmedPhone) searchConditions.push({ phone: trimmedPhone });

        if (searchConditions.length > 0) {
          patientUser = await models.User.findOne({
            where: {
              role: 'patient',
              [Op.or]: searchConditions
            }
          });
        }
      }

      if (!patientUser) {
        let generatedEmail = trimmedEmail;
        if (!generatedEmail) {
          generatedEmail = `walkin.${Date.now()}.${Math.floor(Math.random() * 10000)}@clinic.local`;
        } else {
          const existingByEmail = await models.User.findOne({ where: { email: generatedEmail } });
          if (existingByEmail && existingByEmail.role !== 'patient') {
            generatedEmail = `walkin.${Date.now()}.${Math.floor(Math.random() * 10000)}@clinic.local`;
          }
        }

        const existingGenerated = await models.User.findOne({ where: { email: generatedEmail } });
        if (existingGenerated && existingGenerated.role !== 'patient') {
          generatedEmail = `walkin.${Date.now()}.${Math.floor(Math.random() * 10000)}@clinic.local`;
        }

        const passwordHash = await bcrypt.hash(`WalkIn@${Date.now()}`, 10);
        patientUser = await models.User.create({
          email: generatedEmail,
          username: trimmedPhone || generatedEmail.split('@')[0],
          password_hash: passwordHash,
          full_name: trimmedName,
          phone: trimmedPhone || null,
          dob: dob || null,
          gender: normalizeGender(gender),
          role: 'patient',
          is_active: true,
          is_verified: false
        });
      } else {
        const updates = {};
        if (trimmedName && !patientUser.full_name) updates.full_name = trimmedName;
        if (trimmedPhone && !patientUser.phone) updates.phone = trimmedPhone;
        if (dob && !patientUser.dob) updates.dob = dob;
        if (gender && !patientUser.gender) {
          const mappedGender = normalizeGender(gender);
          if (mappedGender) updates.gender = mappedGender;
        }
        if (Object.keys(updates).length > 0) {
          await patientUser.update(updates);
        }
      }

      patient_id = patientUser.id;
    }

    // 1. Kiểm tra Gói dịch vụ (Package)
    const pkg = await models.ConsultationPricing.findOne({
      where: { id: consultation_pricing_id, is_active: true }
    });
    
    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: 'Gói dịch vụ không tồn tại hoặc đã bị khóa'
      });
    }
    
    // 2. Kiểm tra bác sĩ
    const doctor = await models.User.findOne({
      where: { id: doctor_id, role: 'doctor', is_active: true },
      include: [{ model: models.Doctor, attributes: ['id'] }] // Lấy Doctor.id để check Appointment
    });

    if (!doctor || !doctor.Doctor) {
      return res.status(404).json({
        success: false,
        message: 'Bác sĩ không tồn tại, đã bị khóa, hoặc chưa có hồ sơ Doctor'
      });
    }

    // Lấy thông tin Patient
    let patient = await models.Patient.findOne({
      where: { user_id: patient_id },
      attributes: ['id'],
      raw: true
    });

    // Dữ liệu cũ có thể thiếu bản ghi patient profile, tạo bổ sung để đảm bảo tính nhất quán.
    if (!patient) {
      await models.Patient.create({ user_id: patient_id });
      patient = await models.Patient.findOne({
        where: { user_id: patient_id },
        attributes: ['id'],
        raw: true
      });
    }

    // 3. Lấy thông tin Gói
const consultation_type = pkg.package_type;
const duration_minutes = pkg.duration_minutes || 30; // Mặc định 30 phút nếu gói không set

// 4. Tính toán thời gian
const appointmentStartTime = moment(appointment_time);
const appointmentEndTime = moment(appointment_time).add(duration_minutes, 'minutes');
const appointmentDate = appointmentStartTime.format('YYYY-MM-DD');
const startTimeStr = appointmentStartTime.format('HH:mm:ss');
const endTimeStr = appointmentEndTime.format('HH:mm:ss');

// === BẮT ĐẦU KIỂM TRA XUNG ĐỘT ===
const transaction = await sequelize.transaction();
try {
  const availabilityContext = await appointmentHelper.getDoctorAvailabilityContext({
    doctorId: doctor.Doctor.id,
    appointmentDate: appointmentDate,
    transaction
  });

  if (availabilityContext.leaveBlocksAll) {
    await transaction.rollback();
    return res.status(400).json({
      success: false,
      message: 'Bác sĩ đang nghỉ trong ngày này.'
    });
  }

  const sourceShifts = availabilityContext.sourceShifts || [];
  const leave = availabilityContext.leave;
  const leaveShiftNames = new Set((availabilityContext.leaveShiftNames || []).map((value) => String(value)));

  console.log('DEBUG getAvailableSlots:', {
    selectedDate: appointmentDate,
    dayOfWeek: availabilityContext.dayOfWeek,
    sourceShiftsCount: sourceShifts.length,
    busyCount: (availabilityContext.busyIntervals || []).length,
    leaveType: leave?.leave_type || null,
    sourceShifts: sourceShifts.map(s => ({ start: s.start_time, end: s.end_time, days: s.days_of_week }))
  });
  const slotStartMinutes = appointmentStartTime.hours() * 60 + appointmentStartTime.minutes();
  const slotEndMinutes = slotStartMinutes + duration_minutes;

  const isDoctorAvailable = sourceShifts.some(shift => {
    if (leaveShiftNames.has(String(shift.shift_name || ''))) return false;
      const shiftStart = timeToMinutes(shift.start_time);
      const shiftEnd = timeToMinutes(shift.end_time);
      return slotStartMinutes >= shiftStart && slotEndMinutes <= shiftEnd;
  });

  const overlapsLeaveTimeRange = leave && leave.leave_type === 'time_range'
  ? rangesOverlap(slotStartMinutes, slotEndMinutes, timeToMinutes(leave.time_from), timeToMinutes(leave.time_to))
  : false;

  const hasBusyConflict = (availabilityContext.busyIntervals || []).some(busy => rangesOverlap(slotStartMinutes, slotEndMinutes, busy.start, busy.end));

  if (!isDoctorAvailable || overlapsLeaveTimeRange || hasBusyConflict) {
      await transaction.rollback();
      return res.status(400).json({
          success: false,
      message: 'Bác sĩ không có lịch làm việc hoặc lịch đã kín vào thời gian này.'
      });
  }

  // QUY TẮC 2: Bác sĩ có bận không?
  // 2a. Kiểm tra Appointment (khám tại quầy)
  const doctorApptConflict = await models.Appointment.findOne({
      where: {
          doctor_id: doctor.Doctor.id, // Appointment dùng doctor_id (từ model Doctor)
          status: { [Op.notIn]: ['cancelled', 'completed'] },
          appointment_date: appointmentDate,
          [Op.or]: [ // Check overlap
              { appointment_start_time: { [Op.lt]: endTimeStr }, appointment_end_time: { [Op.gt]: startTimeStr } }
          ]
      }, transaction
  });

  // 2b. Kiểm tra Consultation (tư vấn)
  // EndB = appointment_time + duration_minutes
  // Overlap if (StartA < EndB) AND (EndA > StartB)
  const doctorConsultConflict = await models.Consultation.findOne({
      where: {
          doctor_id: doctor_id,
          status: { [Op.notIn]: ['cancelled', 'rejected', 'expired', 'completed'] },
          // StartB < EndA
          appointment_time: { [Op.lt]: appointmentEndTime.toISOString() },
          // EndB > StartA
          [Op.and]: sequelize.literal(`TIMESTAMPADD(MINUTE, COALESCE(duration_minutes, 30), \`Consultation\`.\`appointment_time\`) > '${appointmentStartTime.toISOString()}'`)
      }, 
      transaction
  });

  if (doctorApptConflict || doctorConsultConflict) {
      await transaction.rollback();
      return res.status(400).json({
          success: false,
          message: 'Bác sĩ đã có lịch hẹn/tư vấn khác trùng với thời gian này.'
      });
  }

  // QUY TẮC 3: Bệnh nhân có bận không?
  if (patient) { // Chỉ check nếu patient có hồ sơ
    // 3a. Kiểm tra Appointment
    const patientApptConflict = await models.Appointment.findOne({
        where: {
            patient_id: patient.id,
            status: { [Op.notIn]: ['cancelled', 'completed'] },
            appointment_date: appointmentDate,
            [Op.or]: [
                { appointment_start_time: { [Op.lt]: endTimeStr }, appointment_end_time: { [Op.gt]: startTimeStr } }
            ]
        }, transaction
    });

    // 3b. Kiểm tra Consultation
    const patientConsultConflict = await models.Consultation.findOne({
        where: {
            patient_id: patient_id,
            status: { [Op.notIn]: ['cancelled', 'rejected', 'expired', 'completed'] },
            appointment_time: { [Op.lt]: appointmentEndTime.toISOString() },
            [Op.and]: sequelize.literal(`TIMESTAMPADD(MINUTE, COALESCE(duration_minutes, 30), \`Consultation\`.\`appointment_time\`) > '${appointmentStartTime.toISOString()}'`)

        }, 
        transaction
    });

    if (patientApptConflict || patientConsultConflict) {
        await transaction.rollback();
        return res.status(400).json({
            success: false,
            message: 'Bạn đã có một lịch hẹn/tư vấn khác trùng với thời gian này.'
        });
    }
  }
  // === KẾT THÚC KIỂM TRA XUNG ĐỘT ===

  // 5. Tính phí
  const baseFee = pkg.price;
  const platformFee = 0;
  const grossFee = parseFloat(baseFee);

  // Tính discount từ voucher/promotion
  let discountAmount = 0;
  let resolvedPromotionIdForFee = null;

  if (voucher_code || promotion_id) {
    let promo = null;
    if (voucher_code && patient_id) {
      promo = await models.Promotion.findOne({
        where: {
          code:       voucher_code.toUpperCase(),
          is_active:  true,
          start_date: { [Op.lte]: new Date() },
          end_date:   { [Op.gte]: new Date() }
        }
      });
      if (promo) {
        const uv = await models.UserVoucher.findOne({
          where: { user_id: patient_id, promotion_id: promo.id, is_used: false }
        });
        if (!uv) promo = null;
      }
    } else if (promotion_id) {
      promo = await models.Promotion.findOne({
        where: { id: Number(promotion_id), is_active: true }
      });
    }
    if (promo) {
      resolvedPromotionIdForFee = promo.id;
      if (promo.discount_type === 'percentage') {
        discountAmount = Math.round(grossFee * parseFloat(promo.discount_value) / 100);
        if (promo.max_discount_amount > 0) {
          discountAmount = Math.min(discountAmount, parseFloat(promo.max_discount_amount));
        }
      } else if (promo.discount_type === 'fixed') {
        discountAmount = Math.min(parseFloat(promo.discount_value), grossFee);
      }
    }
  }

  const totalFee = Math.max(0, grossFee - discountAmount);

  

  // 6. Xác định trạng thái dựa trên phí và phương thức thanh toán
  let initialStatus = 'pending'; // Luôn là 'pending' khi tạo mới (payment_status xử lý riêng)
  
  // Payment status dựa trên phương thức thanh toán
  let initialPaymentStatus = 'unpaid'; // Mặc định chưa thanh toán
  if (totalFee <= 0) {
    initialPaymentStatus = 'not_required'; // Miễn phí không cần thanh toán
  }
  // Nếu có payment_method từ req.body, set theo phương thức
  const { payment_method } = req.body;
  if (payment_method === 'vnpay' || payment_method === 'momo') {
    // Sau khi thanh toán online thành công sẽ update thành paid_online
    initialPaymentStatus = 'unpaid'; // Tạm thời unpaid, đợi callback từ gateway
  }

  // Deadline thanh toán: 30 phút trước giờ tư vấn (áp dụng với ca có phí và chưa thanh toán)
  const paymentDueAt = initialPaymentStatus === 'unpaid'
    ? appointmentStartTime.clone().subtract(30, 'minutes').toDate()
    : null;


  // 7. Tạo mã tư vấn
  const consultationCode = `CS${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const consultation = await models.Consultation.create({
    consultation_code: consultationCode,
    patient_id,
    doctor_id,
    specialty_id: specialty_id || null,
    consultation_pricing_id: pkg.id, 
    consultation_type, 
    duration_minutes, 
    appointment_time,
    chief_complaint,
    medical_history: medical_history || null,
    current_medications: current_medications || null,
    symptom_duration: symptom_duration || null,
    attachments: attachments || null, 
    notes: notes || null,
    status: initialStatus,
    base_fee: baseFee,
    platform_fee: 0,
    discount_amount: discountAmount,
    total_fee: totalFee,
    payment_status: initialPaymentStatus,
    payment_method: payment_method || null,
    payment_due_at: paymentDueAt
  }, { transaction });

  // ✅ Tạo Payment record (chỉ khi có phí) - dùng totalFee đã trừ discount
  if (totalFee > 0) {
    await models.Payment.create({
      user_id:         patient_id,
      consultation_id: consultation.id,
      amount:          totalFee,
      status:          'pending',
      method:          payment_method || 'vnpay',
      transaction_id:  `CS_${consultationCode}_${Date.now()}`,
      promotion_id:    resolvedPromotionIdForFee,
    }, { transaction });
  }

  // 9. SỬA LỖI: Gửi thông báo cho BÁC SĨ (THÊM LẠI)
  await models.Notification.create({
    user_id: doctor_id,
    type: 'appointment',
    message: '🔔 Bạn có lịch tư vấn mới cần xác nhận',
    link: `/quan-ly-tu-van/realtime`,
    is_read: false
  }, { transaction });
// 10.  THÊM MỚI: Gửi thông báo cho TẤT CẢ ADMIN
const admins = await models.User.findAll({
  where: { role: 'admin', is_active: true },
  attributes: ['id'],
  transaction
});

// Tạo thông báo cho từng admin
for (const admin of admins) {
  await models.Notification.create({
    user_id: admin.id,
    type: 'appointment',
    message: `📋 Lịch tư vấn mới ${consultation.consultation_code} cần phê duyệt`,
    link: `/quan-ly-tu-van/realtime`,// Link đến trang quản lý admin
    is_read: false
  }, { transaction });
}

await transaction.commit(); 

  res.status(201).json({
    success: true,
    message: 'Đặt lịch tư vấn thành công',
    data: consultation
  });

} catch (error) { // <-- Catch của transaction
  if (transaction) await transaction.rollback();
  console.error('Error during consultation creation transaction:', error);
  res.status(500).json({
    success: false,
    message: error.message || 'Lỗi khi tạo lịch tư vấn (transaction failed)',
    error: error.message
  });
  }
  } catch (error) {
    console.error('Error creating consultation:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo lịch tư vấn',
      error: error.message
    });
  }
};
/**
 *  FIX: Lấy danh sách tư vấn của bệnh nhân
 * GET /api/consultations/my-consultations
 */
exports.getMyConsultations = async (req, res) => {
  try {
    const patient_id = req.user.id;
    const { status, type, page = 1, limit = 10 } = req.query;

    const where = { patient_id };
    if (status && status !== 'all') where.status = status; // <-- SỬA DÒNG NÀY
    if (type && type !== 'all') where.consultation_type = type; // <-- SỬA DÒNG NÀY

    const offset = (page - 1) * limit;

    const { count, rows } = await models.Consultation.findAndCountAll({
      where,
      include: [
        {
          model: models.User,
          as: 'doctor',
          attributes: ['id', 'full_name', 'avatar_url', 'phone'],
          include: [{
            model: models.Doctor,
            include: [{
              model: models.Specialty,
              as: 'specialty',
              attributes: ['id', 'name']
            }]
          }]
        }
      ],
      order: [['appointment_time', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error getting my consultations:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách tư vấn',
      error: error.message
    });
  }
};

/**
 * Đánh giá buổi tư vấn
 * PUT /api/consultations/:id/rate
 */
exports.rateConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const patient_id = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Đánh giá phải từ 1-5 sao'
      });
    }

    const consultation = await models.Consultation.findOne({
      where: { id, patient_id, status: 'completed' }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn hoặc chưa hoàn thành'
      });
    }

    if (consultation.rating) {
      return res.status(400).json({
        success: false,
        message: 'Đã đánh giá buổi tư vấn này rồi'
      });
    }

    consultation.rating = rating;
    consultation.review = review;
    await consultation.save();

    // Cập nhật rating trung bình của bác sĩ
    const doctor = await models.Doctor.findOne({
      where: { user_id: consultation.doctor_id }
    });

    if (doctor) {
      const avgRating = await models.Consultation.findOne({
        where: {
          doctor_id: consultation.doctor_id,
          rating: { [Op.ne]: null }
        },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating']
        ],
        raw: true
      });

      doctor.rating = parseFloat(avgRating.avg_rating || 0).toFixed(2);
      await doctor.save();
    }

    res.json({
      success: true,
      message: 'Đánh giá thành công',
      data: consultation
    });

  } catch (error) {
    console.error('Error rating consultation:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi đánh giá tư vấn',
      error: error.message
    });
  }
};

/**
 * (MỚI) Bệnh nhân gửi Đánh giá
 * POST /api/consultations/feedback
 *
 *  SỬA LỖI: Lưu đánh giá trực tiếp vào bảng 'consultations'
 * vì đã có sẵn cột 'rating' và 'review'.
 */
exports.submitConsultationFeedback = async (req, res) => {
  try {
    const patient_id = req.user.id;
    const { consultation_id, rating, review } = req.body;

    if (!consultation_id || !rating) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin ID hoặc xếp hạng' });
    }

    // 1. Tìm buổi tư vấn
    const consultation = await models.Consultation.findByPk(consultation_id);
    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tư vấn' });
    }

    // 2. Kiểm tra quyền
    if (consultation.patient_id !== patient_id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền đánh giá buổi tư vấn này' });
    }

    // 3. Kiểm tra xem đã đánh giá CHƯA (ngay trên bảng Consultation)
    if (consultation.rating) {
      return res.status(400).json({ success: false, message: 'Bạn đã đánh giá buổi tư vấn này rồi' });
    }
    
    // 4. Lưu trực tiếp vào bảng Consultation
    consultation.rating = parseInt(rating);
    consultation.review = review || null;
    consultation.reviewed_at = new Date(); // Thêm thời gian đánh giá
    await consultation.save();

    // 5. Cập nhật rating trung bình của bác sĩ (logic từ hàm rateConsultation cũ)
    const doctor = await models.Doctor.findOne({
      where: { user_id: consultation.doctor_id }
    });

    if (doctor) {
      const avgRating = await models.Consultation.findOne({
        where: {
          doctor_id: consultation.doctor_id,
          rating: { [Op.ne]: null } // Op đã được import ở đầu file
        },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating']
        ],
        raw: true
      });

      doctor.rating = parseFloat(avgRating.avg_rating || 0).toFixed(2);
      await doctor.save();
    }

    // Trả về chính consultation đã được cập nhật
    res.status(201).json({ success: true, message: 'Gửi đánh giá thành công', data: consultation });

  } catch (error) {
    console.error('Error submitConsultationFeedback:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi đánh giá',
      error: error.message
    });
  }
};

/**
 *  FIX: Thống kê tư vấn của bệnh nhân
 * GET /api/consultations/patient/stats
 */
exports.getPatientStats = async (req, res) => {
  try {
    const patient_id = req.user.id;

    const stats = await models.Consultation.findOne({
      where: { patient_id },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_consultations'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = "completed" THEN 1 END')), 'completed'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = "cancelled" THEN 1 END')), 'cancelled'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN payment_status = "paid" THEN total_fee ELSE 0 END')), 'total_spent']
      ],
      raw: true
    });

    res.json({
      success: true,
      data: {
        stats: stats || {
          total_consultations: 0,
          completed: 0,
          cancelled: 0,
          total_spent: 0
        }
      }
    });

  } catch (error) {
    console.error('Error getting patient stats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy thống kê',
      error: error.message
    });
  }
};

/**
 * ==================== DOCTOR METHODS ====================
 */

/**
 *  FIX: Lấy danh sách tư vấn của bác sĩ
 * GET /api/consultations/doctor/my-consultations
 */
exports.getDoctorConsultations = async (req, res) => {
  try {
    const doctor_id = req.user.id;
    const { status, type, date, page = 1, limit = 20 } = req.query;

    const where = { doctor_id };
    if (status && status !== 'all') where.status = status;
    if (type && type !== 'all') where.consultation_type = type;
    if (date) {
      where.appointment_time = {
        [Op.between]: [
          new Date(date + ' 00:00:00'),
          new Date(date + ' 23:59:59')
        ]
      };
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await models.Consultation.findAndCountAll({
      where,
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['id', 'full_name', 'avatar_url', 'phone', 'dob', 'gender'],
          include: [{
            model: models.Patient
          }]
        }
      ],
      order: [['appointment_time', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error getting doctor consultations:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách tư vấn',
      error: error.message
    });
  }
};

/**
 *  FIX: Xác nhận tư vấn (Bác sĩ chấp nhận)
 * PUT /api/consultations/:id/confirm
 */
exports.confirmConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor_id = req.user.id;

    const consultation = await models.Consultation.findOne({
      where: { id, doctor_id, status: 'pending' }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn hoặc không thể xác nhận'
      });
    }

    consultation.status = 'confirmed';
    consultation.confirmed_at = new Date();
    await consultation.save();

    //  FIX: Tạo thông báo cho bệnh nhân
    await models.Notification.create({
      user_id: consultation.patient_id,
      type: 'appointment', //  ĐỔI 'consultation' → 'appointment'
      message: ' Bác sĩ đã xác nhận lịch tư vấn của bạn',
      link: `/tu-van/${consultation.id}`,
      is_read: false
    });

    res.json({
      success: true,
      message: 'Xác nhận thành công',
      data: consultation
    });

  } catch (error) {
    console.error('Error confirming consultation:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi xác nhận tư vấn',
      error: error.message
    });
  }
};

/**
 * Kết thúc tư vấn và điền kết quả
 * PUT /api/consultations/:id/complete
 */
exports.completeConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, prescription, notes, treatment_plan, severity_level, need_followup, followup_date, followup_notes, advice, symptoms, vitals_json, clinical_note, service_indications, test_images_json, report_files_json, result_snapshot } = req.body;
    const doctor_id = req.user.id;

    if (!diagnosis) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập chẩn đoán'
      });
    }

    const consultation = await models.Consultation.findOne({
      where: { 
        id, 
        doctor_id, 
        status: { [Op.in]: ['in_progress', 'confirmed'] }
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn hoặc chưa bắt đầu'
      });
    }

    consultation.status = 'completed';
    consultation.diagnosis = diagnosis;
    consultation.prescription = prescription;
    if (typeof symptoms !== 'undefined') consultation.symptoms = symptoms || null;
    if (typeof advice !== 'undefined') consultation.advice = advice || null;
    if (typeof treatment_plan !== 'undefined') consultation.treatment_plan = treatment_plan;
    if (typeof severity_level !== 'undefined') consultation.severity_level = severity_level;
    if (typeof need_followup !== 'undefined') consultation.need_followup = String(need_followup) === 'true' || need_followup === true;
    if (typeof followup_date !== 'undefined') consultation.followup_date = followup_date || null;
    if (typeof followup_notes !== 'undefined') consultation.followup_notes = followup_notes || null;
    consultation.notes = notes;
    if (typeof vitals_json !== 'undefined') consultation.vitals_json = typeof vitals_json === 'string' ? JSON.parse(vitals_json || 'null') : vitals_json;
    if (typeof clinical_note !== 'undefined') consultation.clinical_note = clinical_note || null;
    if (typeof service_indications !== 'undefined') consultation.service_indications = typeof service_indications === 'string' ? JSON.parse(service_indications || 'null') : service_indications;
    if (typeof test_images_json !== 'undefined') consultation.test_images_json = typeof test_images_json === 'string' ? JSON.parse(test_images_json || 'null') : test_images_json;
    if (typeof report_files_json !== 'undefined') consultation.report_files_json = typeof report_files_json === 'string' ? JSON.parse(report_files_json || 'null') : report_files_json;
    if (typeof result_snapshot !== 'undefined') consultation.result_snapshot = typeof result_snapshot === 'string' ? JSON.parse(result_snapshot || 'null') : result_snapshot;
    consultation.ended_at = new Date();
    consultation.completed_at = new Date();
    consultation.medical_record_status = 'has_record';
    await consultation.save();

    await models.Notification.create({
      user_id: consultation.patient_id,
      type: 'consultation',
      message: '✅ Buổi tư vấn đã hoàn thành. Bác sĩ đã gửi kết quả',
      link: `/danh-sach-ho-so?tab=records`,
      is_read: false
    });

    res.json({
      success: true,
      message: 'Hoàn thành tư vấn thành công',
      data: consultation
    });

  } catch (error) {
    console.error('Error completing consultation:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hoàn thành tư vấn',
      error: error.message
    });
  }
};

/**
 * Lưu nháp kết quả tư vấn (không hoàn thành buổi tư vấn)
 * PUT /api/consultations/:id/draft
 */
exports.saveConsultationDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor_id = req.user.id;
    const {
      diagnosis,
      treatment_plan,
      prescription,
      notes,
      severity_level,
      need_followup,
      followup_date,
      followup_notes,
      advice,
      symptoms,
      vitals_json,
      clinical_note,
      service_indications,
      test_images_json,
      report_files_json,
      draft_data
    } = req.body;

    const consultation = await models.Consultation.findOne({
      where: { id, doctor_id }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn hoặc bạn không có quyền chỉnh sửa'
      });
    }

    let parsedPrescription = prescription;
    if (typeof parsedPrescription === 'string' && parsedPrescription.trim()) {
      try {
        parsedPrescription = JSON.parse(parsedPrescription);
      } catch (error) {
        // giữ nguyên string nếu không parse được
      }
    }

    let parsedDraftData = draft_data;
    if (typeof parsedDraftData === 'string' && parsedDraftData.trim()) {
      try {
        parsedDraftData = JSON.parse(parsedDraftData);
      } catch (error) {
        parsedDraftData = null;
      }
    }

    const currentMetadata = consultation.metadata && typeof consultation.metadata === 'object'
      ? consultation.metadata
      : {};

    const nextDraftData = {
      ...(currentMetadata.result_draft || {}),
      ...(parsedDraftData || {}),
      diagnosis: typeof diagnosis !== 'undefined' ? diagnosis : (currentMetadata.result_draft?.diagnosis || consultation.diagnosis || ''),
      treatment_plan: typeof treatment_plan !== 'undefined' ? treatment_plan : (currentMetadata.result_draft?.treatment_plan || consultation.treatment_plan || ''),
      prescription: typeof parsedPrescription !== 'undefined' ? parsedPrescription : (currentMetadata.result_draft?.prescription || consultation.prescription_data || null),
      notes: typeof notes !== 'undefined' ? notes : (currentMetadata.result_draft?.notes || consultation.notes || ''),
      severity_level: typeof severity_level !== 'undefined' ? severity_level : (currentMetadata.result_draft?.severity_level || consultation.severity_level || 'normal'),
      need_followup: typeof need_followup !== 'undefined' ? String(need_followup) === 'true' || need_followup === true : (currentMetadata.result_draft?.need_followup ?? consultation.need_followup ?? false),
      followup_date: typeof followup_date !== 'undefined' ? followup_date : (currentMetadata.result_draft?.followup_date || consultation.followup_date || null),
      followup_notes: typeof followup_notes !== 'undefined' ? followup_notes : (currentMetadata.result_draft?.followup_notes || consultation.followup_notes || ''),
      advice: typeof advice !== 'undefined' ? advice : (currentMetadata.result_draft?.advice || consultation.advice || ''),
      symptoms: typeof symptoms !== 'undefined' ? symptoms : (currentMetadata.result_draft?.symptoms || consultation.symptoms || ''),
      vitals_json: typeof vitals_json !== 'undefined'
        ? (typeof vitals_json === 'string' ? JSON.parse(vitals_json || 'null') : vitals_json)
        : (currentMetadata.result_draft?.vitals_json || consultation.vitals_json || null),
      clinical_note: typeof clinical_note !== 'undefined' ? clinical_note : (currentMetadata.result_draft?.clinical_note || consultation.clinical_note || ''),
      service_indications: typeof service_indications !== 'undefined'
        ? (typeof service_indications === 'string' ? JSON.parse(service_indications || 'null') : service_indications)
        : (currentMetadata.result_draft?.service_indications || consultation.service_indications || null),
      test_images_json: typeof test_images_json !== 'undefined'
        ? (typeof test_images_json === 'string' ? JSON.parse(test_images_json || 'null') : test_images_json)
        : (currentMetadata.result_draft?.test_images_json || consultation.test_images_json || null),
      report_files_json: typeof report_files_json !== 'undefined'
        ? (typeof report_files_json === 'string' ? JSON.parse(report_files_json || 'null') : report_files_json)
        : (currentMetadata.result_draft?.report_files_json || consultation.report_files_json || null),
      updated_at: new Date().toISOString(),
    };

    consultation.diagnosis = nextDraftData.diagnosis || null;
    consultation.treatment_plan = nextDraftData.treatment_plan || null;
    consultation.prescription_data = nextDraftData.prescription || null;
    consultation.notes = nextDraftData.notes || null;
    consultation.symptoms = nextDraftData.symptoms || null;
    consultation.advice = nextDraftData.advice || null;
    consultation.severity_level = nextDraftData.severity_level || consultation.severity_level;
    consultation.need_followup = !!nextDraftData.need_followup;
    consultation.followup_date = nextDraftData.followup_date || null;
    consultation.followup_notes = nextDraftData.followup_notes || null;
    consultation.vitals_json = nextDraftData.vitals_json || null;
    consultation.clinical_note = nextDraftData.clinical_note || null;
    consultation.service_indications = nextDraftData.service_indications || null;
    consultation.test_images_json = nextDraftData.test_images_json || null;
    consultation.report_files_json = nextDraftData.report_files_json || null;
    consultation.result_snapshot = {
      diagnosis: nextDraftData.diagnosis,
      treatment_plan: nextDraftData.treatment_plan,
      prescription: nextDraftData.prescription,
      notes: nextDraftData.notes,
      symptoms: nextDraftData.symptoms,
      advice: nextDraftData.advice,
      severity_level: nextDraftData.severity_level,
      need_followup: nextDraftData.need_followup,
      followup_date: nextDraftData.followup_date,
      followup_notes: nextDraftData.followup_notes,
      vitals_json: nextDraftData.vitals_json,
      clinical_note: nextDraftData.clinical_note,
      service_indications: nextDraftData.service_indications,
      test_images_json: nextDraftData.test_images_json,
      report_files_json: nextDraftData.report_files_json,
      updated_at: nextDraftData.updated_at,
    };
    consultation.metadata = {
      ...currentMetadata,
      result_draft: nextDraftData
    };
    consultation.medical_record_status = 'no_record';

    await consultation.save();

    return res.status(200).json({
      success: true,
      message: 'Lưu nháp kết quả tư vấn thành công',
      data: consultation
    });
  } catch (error) {
    console.error('Error saving consultation draft:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi lưu nháp kết quả tư vấn',
      error: error.message
    });
  }
};

/**
 * Thống kê tư vấn của bác sĩ
 * GET /api/consultations/doctor/stats
 */
exports.getDoctorStats = async (req, res) => {
  try {
    const doctor_id = req.user.id;

    const stats = await models.Consultation.findOne({
      where: { doctor_id },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_consultations'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = "completed" THEN 1 END')), 'completed'],
        [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating'],
        [sequelize.fn('COUNT', sequelize.literal('DISTINCT patient_id')), 'total_patients']
      ],
      raw: true
    });

    res.json({
      success: true,
      data: {
        stats: stats || {
          total_consultations: 0,
          completed: 0,
          avg_rating: 0,
          total_patients: 0
        }
      }
    });

  } catch (error) {
    console.error('Error getting doctor stats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy thống kê',
      error: error.message
    });
  }
};

/**
 * ==================== COMMON METHODS ====================
 */

/**
 *  FIX: Lấy chi tiết một tư vấn
 * GET /api/consultations/:id
 */
exports.getConsultationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    //  THÊM: Log để debug
    console.log('🔍 [getConsultationById] Tìm kiếm:', {
      id,
      idType: typeof id,
      userId,
      userRole: req.user.role
    });

    let consultation = await models.Consultation.findByPk(id, {
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['id', 'full_name', 'avatar_url', 'phone', 'dob', 'gender'],
          include: [{ model: models.Patient }]
        },
        {
          model: models.User,
          as: 'doctor',
          attributes: ['id', 'full_name', 'avatar_url', 'phone'],
          include: [{
            model: models.Doctor,
            include: [{
              model: models.Specialty,
              as: 'specialty',
              attributes: ['id', 'name']
            }]
          }]
        },
        {
          model: models.ConsultationPricing,
          as: 'package',
          attributes: ['package_name', 'duration_minutes', 'price']
        }
      ]
    });

    //  THÊM: Nếu không tìm thấy theo ID, thử tìm theo consultation_code
    if (!consultation && isNaN(id)) {
      console.log('⚠️ [getConsultationById] Không tìm thấy theo ID, thử tìm theo code:', id);
      consultation = await models.Consultation.findOne({
        where: { consultation_code: id },
        include: [
          {
            model: models.User,
            as: 'patient',
            attributes: ['id', 'full_name', 'avatar_url', 'phone', 'dob', 'gender'],
            include: [{ model: models.Patient }]
          },
          {
            model: models.User,
            as: 'doctor',
            attributes: ['id', 'full_name', 'avatar_url', 'phone'],
            include: [{
              model: models.Doctor,
              include: [{
                model: models.Specialty,
                as: 'specialty',
                attributes: ['id', 'name']
              }]
            }]
          },
          {
            model: models.ConsultationPricing,
            as: 'package',
            attributes: ['package_name', 'duration_minutes', 'price']
          }
        ]
      });
    }

    if (!consultation) {
      console.log('❌ [getConsultationById] Không tìm thấy consultation:', id);
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn'
      });
    }

    console.log(' [getConsultationById] Tìm thấy consultation:', {
      id: consultation.id,
      code: consultation.consultation_code,
      status: consultation.status
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn'
      });
    }

    // Kiểm tra quyền xem
    const allowedRoles = ['admin', 'staff'];
    if (!allowedRoles.includes(req.user.role)) {
      if (consultation.patient_id !== userId && consultation.doctor_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xem buổi tư vấn này'
        });
      }
    }

    res.json({
      success: true,
      data: consultation
    });

  } catch (error) {
    console.error('Error getting consultation:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy thông tin tư vấn',
      error: error.message
    });
  }
};

/**
 * Bắt đầu tư vấn (Vào phòng chat)
 * PUT /api/consultations/:id/start
 */
exports.startConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const consultation = await models.Consultation.findOne({
    where: {
      id,
      status: { [Op.in]: ['confirmed', 'in_progress', 'completed'] },
      [Op.or]: [
        { patient_id: userId },
        { doctor_id: userId }
      ]
    }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn hoặc chưa được xác nhận'
      });
    }

    // Chặn vào phòng nếu chưa thanh toán với ca có yêu cầu thanh toán
    const isPaid = ['paid_online', 'paid_at_clinic'].includes(consultation.payment_status);
    const paymentRequired = consultation.payment_status !== 'not_required';
    if (paymentRequired && !isPaid) {
      const dueAt = consultation.payment_due_at ? new Date(consultation.payment_due_at) : null;
      const now = new Date();

      if (dueAt && dueAt < now) {
        consultation.status = 'cancelled';
        consultation.cancelled_by = 'system';
        consultation.cancel_reason = 'Quá hạn thanh toán trước giờ tư vấn';
        consultation.cancelled_at = now;
        await consultation.save();

        return res.status(400).json({
          success: false,
          message: 'Lịch tư vấn đã bị huỷ do quá hạn thanh toán.'
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Vui lòng hoàn tất thanh toán trước khi vào phòng tư vấn.'
      });
    }

    // Kiểm tra thời gian có hợp lệ không (có thể vào trước 15 phút)
    const now = new Date();
    const appointmentTime = new Date(consultation.appointment_time);
    const timeDiff = (now - appointmentTime) / 60000; // phút

    if (timeDiff < -15) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể vào phòng tư vấn trước 15 phút'
      });
    }

    if (timeDiff > 30) {
      return res.status(400).json({
        success: false,
        message: 'Đã quá thời gian vào phòng tư vấn'
      });
    }

    consultation.status = 'in_progress';
    consultation.started_at = new Date();
    await consultation.save();

    res.json({
      success: true,
      message: 'Bắt đầu tư vấn thành công',
      data: consultation
    });

  } catch (error) {
    console.error('Error starting consultation:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi bắt đầu tư vấn',
      error: error.message
    });
  }
};

/**
 *  FIX: Hủy tư vấn
 * PUT /api/consultations/:id/cancel
 */
exports.cancelConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const consultation = await models.Consultation.findOne({
      where: {
        id,
        [Op.or]: [
          { patient_id: userId },
          { doctor_id: userId }
        ],
        status: { [Op.in]: ['pending', 'confirmed', 'upcoming'] }
      }
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn hoặc không thể hủy'
      });
    }

    // Tính % hoàn tiền
    const now = new Date();
    const appointmentTime = new Date(consultation.appointment_time);
    const hoursBeforeAppointment = (appointmentTime - now) / 3600000;

    let refundPercent = 0;
    if (userRole === 'doctor') {
      refundPercent = 100; // Bác sĩ hủy -> hoàn 100%
    } else if (hoursBeforeAppointment >= 24) {
      refundPercent = 100;
    } else if (hoursBeforeAppointment >= 6) {
      refundPercent = 50;
    } else {
      refundPercent = 0;
    }

    consultation.status = 'cancelled';
    consultation.cancelled_at = new Date();
    consultation.cancelled_by = userRole; // 'patient' | 'doctor' | 'admin'
    consultation.cancel_reason = reason;  // sửa tên field đúng với DB
    await consultation.save();
    await consultation.save();

    //  FIX: Tạo thông báo cho người còn lại
    const recipientId = userId === consultation.patient_id 
      ? consultation.doctor_id 
      : consultation.patient_id;

    await models.Notification.create({
      user_id: recipientId,
      type: 'system',
      message: `❌ Buổi tư vấn đã bị hủy. Lý do: ${reason || 'Không có lý do'}`,
      link: `/tu-van/${consultation.id}`,
      is_read: false
    });

    res.json({
      success: true,
      message: 'Hủy tư vấn thành công',
      data: {
        ...consultation.toJSON(),
        refund_amount: Math.round(consultation.total_fee * refundPercent / 100)
      }
    });

  } catch (error) {
    console.error('Error cancelling consultation:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hủy tư vấn',
      error: error.message
    });
  }
};

/**
 * Bệnh nhân đổi lịch tư vấn (chỉ 1 lần, trước 24h)
 * PUT /api/consultations/:id/reschedule
 */
exports.rescheduleConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_appointment_time, reason } = req.body;
    const userId = req.user.id;

    // 1. Validate input
    if (!new_appointment_time) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn thời gian mới' });
    }

    // 2. Tìm buổi tư vấn - chỉ patient owner mới được đổi
    const consultation = await models.Consultation.findOne({
      where: {
        id,
        patient_id: userId,
        status: { [Op.in]: ['pending', 'confirmed'] }
      },
      include: [
        { model: models.User, as: 'doctor', attributes: ['id', 'full_name', 'email'] },
        { model: models.User, as: 'patient', attributes: ['id', 'full_name', 'email'] }
      ]
    });

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy buổi tư vấn hoặc không thể đổi lịch ở trạng thái này'
      });
    }

    // 3. Chỉ được đổi lịch 1 lần duy nhất
    if (consultation.is_rescheduled) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã sử dụng quyền đổi lịch cho buổi tư vấn này. Mỗi buổi tư vấn chỉ được đổi lịch 1 lần.'
      });
    }

    // 4. Phải đổi trước ít nhất 24 tiếng
    const now = new Date();
    const oldTime = new Date(consultation.appointment_time);
    const hoursLeft = (oldTime - now) / 3600000;
    if (hoursLeft < 24) {
      return res.status(400).json({
        success: false,
        message: `Không thể đổi lịch. Chỉ được đổi lịch trước ít nhất 24 giờ so với giờ hẹn. Hiện còn ${hoursLeft.toFixed(1)} giờ.`
      });
    }

    // 5. Giờ mới phải ở tương lai
    const newTime = new Date(new_appointment_time);
    if (newTime <= now) {
      return res.status(400).json({ success: false, message: 'Thời gian mới phải ở tương lai' });
    }

    // 6. Giờ mới phải cách hiện tại ít nhất 2 tiếng
    const hoursToNew = (newTime - now) / 3600000;
    if (hoursToNew < 2) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian hẹn mới phải cách thời điểm hiện tại ít nhất 2 giờ'
      });
    }

    // 7. Kiểm tra slot mới có bị trùng với lịch khác của bác sĩ không
    const duration = consultation.duration_minutes || 30;
    const conflict = await models.Consultation.findOne({
      where: {
        id: { [Op.ne]: id },
        doctor_id: consultation.doctor_id,
        status: { [Op.in]: ['pending', 'confirmed', 'in_progress'] },
        appointment_time: {
          [Op.between]: [
            new Date(newTime.getTime() - duration * 60000),
            new Date(newTime.getTime() + duration * 60000)
          ]
        }
      }
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'Bác sĩ đã có lịch vào khung giờ này. Vui lòng chọn giờ khác.'
      });
    }

    // 8. Lưu giờ gốc, cập nhật
    const originalTime = consultation.appointment_time;
    consultation.original_appointment_time = originalTime;
    consultation.appointment_time         = newTime;
    consultation.is_rescheduled           = true;
    consultation.rescheduled_at           = now;
    consultation.reschedule_reason        = reason || null;
    // Slot rảnh → tự xác nhận luôn, không cần về pending
    // Giữ nguyên status (confirmed vẫn confirmed, pending vẫn pending)
    await consultation.save();

    const formatVN = (d) => new Date(d).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // 9. Thông báo cho BỆNH NHÂN
    await models.Notification.create({
      user_id: consultation.patient_id,
      type: 'system',
      message: `✅ Đổi lịch thành công! Buổi tư vấn ${consultation.consultation_code} đã được dời sang ${formatVN(newTime)}.`,
      link: `/tu-van/${consultation.id}`,
      is_read: false
    });

    // 10. Thông báo cho BÁC SĨ
    await models.Notification.create({
      user_id: consultation.doctor_id,
      type: 'system',
      message: `🔄 Bệnh nhân ${consultation.patient?.full_name || ''} đã đổi lịch tư vấn ${consultation.consultation_code}: ${formatVN(originalTime)} → ${formatVN(newTime)}. Lý do: ${reason || 'Không có lý do'}.`,
      link: `/tu-van/${consultation.id}`,
      is_read: false
    });

    // 11. Thông báo cho ADMIN (tìm tất cả admin)
    const admins = await models.User.findAll({ where: { role: 'admin' } });
    await Promise.all(admins.map(admin =>
      models.Notification.create({
        user_id: admin.id,
        type: 'system',
        message: `🔄 Đổi lịch: ${consultation.consultation_code} — ${formatVN(originalTime)} → ${formatVN(newTime)}`,
        link: `/tu-van/${consultation.id}`,
        is_read: false
      })
    ));

    res.json({
      success: true,
      message: 'Đổi lịch thành công! Lịch mới đã được xác nhận.',
      data: {
        id: consultation.id,
        consultation_code: consultation.consultation_code,
        new_appointment_time: newTime,
        original_appointment_time: originalTime,
        status: consultation.status
      }
    });

  } catch (error) {
    console.error('Error rescheduling consultation:', error);
    res.status(500).json({ success: false, message: 'Lỗi đổi lịch', error: error.message });
  }
};

/**
 * ==================== ADMIN METHODS ====================
 */

/**
 *  FIX: Lấy tất cả tư vấn (Admin)
 * GET /api/consultations/admin/all
 */
exports.getAllConsultations = async (req, res) => {
  try {
    const { status, type, doctor_id, patient_id, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (type) where.consultation_type = type;
    if (doctor_id) where.doctor_id = doctor_id;
    if (patient_id) where.patient_id = patient_id;

    const offset = (page - 1) * limit;

    const { count, rows } = await models.Consultation.findAndCountAll({
      where,
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['id', 'full_name', 'phone']
        },
        {
          model: models.User,
          as: 'doctor',
          attributes: ['id', 'full_name', 'phone'],
          include: [{
            model: models.Doctor,
            include: [{
              model: models.Specialty,
              as: 'specialty',
              attributes: ['id', 'name']
            }]
          }]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error getting all consultations:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách tư vấn',
      error: error.message
    });
  }
};

/**
 * Thống kê tổng quan hệ thống (Admin)
 * GET /api/consultations/admin/stats
 */
exports.getSystemStats = async (req, res) => {
  try {
    const stats = await models.Consultation.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = "completed" THEN 1 END')), 'completed'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = "cancelled" THEN 1 END')), 'cancelled'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN payment_status = "paid" THEN total_fee ELSE 0 END')), 'total_revenue'],
        [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating']
      ],
      raw: true
    });

    res.json({
      success: true,
      data: {
        stats: stats || {
          total: 0,
          completed: 0,
          cancelled: 0,
          total_revenue: 0,
          avg_rating: 0
        }
      }
    });

  } catch (error) {
    console.error('Error getting system stats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy thống kê hệ thống',
      error: error.message
    });
  }
};

/**
 * ==================== PRICING METHODS ====================
 */

/**
 * Lấy bảng giá tư vấn của bác sĩ
 * GET /api/consultations/pricing/:doctor_id
 */
exports.getDoctorPricing = async (req, res) => {
  try {
    // Bỏ qua doctor_id, lấy tất cả các gói đang hoạt động
    const packages = await models.ConsultationPricing.findAll({
      where: { is_active: true },
      order: [['price', 'ASC']]
    });

    if (!packages || packages.length === 0) {
      // Trả về mảng rỗng với status 200 để Frontend không báo lỗi
      return res.json({ 
        success: true,
        data: [] 
      });
    }
    
    // Trả về data.data (thay vì data) để khớp với code cũ của frontend
    res.json({
      success: true,
      data: packages // Trả về MẢNG các gói
    });

  } catch (error) {
    console.error('Error getting packages (Logic B):', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách gói dịch vụ',
      error: error.message
    });
  }
};

/**
 * Tính phí tư vấn
 * POST /api/consultations/calculate-fee
 */
exports.calculateConsultationFee = async (req, res) => {
  try {
    const { doctor_id, consultation_type } = req.body;

    if (!doctor_id || !consultation_type) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin'
      });
    }

    const pricing = await models.ConsultationPricing.findOne({
      where: { doctor_id }
    });

    let baseFee;
    if (pricing) {
      baseFee = consultation_type === 'chat' ? pricing.chat_fee :
                consultation_type === 'video' ? pricing.video_fee :
                pricing.offline_fee;
    } else {
      baseFee = consultation_type === 'chat' ? 100000 :
                consultation_type === 'video' ? 300000 : 500000;
    }

    const platformFee = Math.round(baseFee * 0.1);
    const totalFee = baseFee + platformFee;

    res.json({
      success: true,
      data: {
        base_fee: baseFee,
        platform_fee: platformFee,
        discount_amount: 0,
        total_fee: totalFee,
      }
    });

  } catch (error) {
    console.error('Error calculating fee:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi tính phí',
      error: error.message
    });
  }
};

// Export thêm các methods khác nếu cần...
exports.getDoctorRevenue = async (req, res) => {
  res.json({ success: true, message: 'Feature coming soon' });
};

exports.processRefund = async (req, res) => {
  res.json({ success: true, message: 'Feature coming soon' });
};

exports.updateDoctorPricing = async (req, res) => {
  res.json({ success: true, message: 'Feature coming soon' });
};

exports.bookConsultationForPatient = async (req, res) => {
  res.json({ success: true, message: 'Feature coming soon' });
};

exports.confirmCashPayment = async (req, res) => {
  res.json({ success: true, message: 'Feature coming soon' });
};

exports.searchConsultations = async (req, res) => {
  res.json({ success: true, message: 'Feature coming soon' });
};

exports.exportConsultations = async (req, res) => {
  res.json({ success: true, message: 'Feature coming soon' });
};

/**
 * Lấy danh sách bác sĩ có thể đặt lịch tư vấn
 * GET /api/consultations/chon-bac-si
 */
exports.getAvailableDoctors = async (req, res) => {
  try {
    const { specialty_id, consultation_type } = req.query;

    const where = {};
    if (specialty_id) {
      where.specialty_id = specialty_id;
    }

    const doctors = await models.Doctor.findAll({
      where,
      include: [
        {
          model: models.User,
          as: 'user', //  THÊM ALIAS
          attributes: ['id', 'full_name', 'avatar_url', 'email', 'phone'],
          where: { 
            is_active: true,
            is_verified: true,
            role: 'doctor'
          }
        },
        {
          model: models.Specialty,
          as: 'specialty',
          attributes: ['id', 'name', 'description']
        }
      ]
    });

    res.json({
      success: true,
      data: doctors
    });

  } catch (error) {
    console.error('Error getting available doctors:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách bác sĩ',
      error: error.message
    });
  }
};



/**
 * LẤY KHUNG GIỜ KHẢ DỤNG CHO TƯ VẤN
 * GET /api/consultations/available-slots
 */
exports.getAvailableSlots = async (req, res) => {
  try {
    const { doctor_id, date, consultation_pricing_id } = req.query;
    
    //  LOG ĐẦU TIÊN - Xem API có được gọi không
    console.log('[getAvailableSlots] API ĐƯỢC GỌI:', {
      doctor_id,
      date,
      consultation_pricing_id,
      rawQuery: req.query
    });
    if (!doctor_id || !date || !consultation_pricing_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Thiếu thông tin doctor_id, date, hoặc consultation_pricing_id' 
      });
    }

    // 1. Lấy thông tin gói để biết duration
    const pkg = await models.ConsultationPricing.findByPk(consultation_pricing_id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gói dịch vụ' });
    }
    const duration_minutes = pkg.duration_minutes || 30; // Lấy duration từ gói

    // 2. Lấy thông tin bác sĩ (cần Doctor.id cho Appointment)
    const doctor = await models.User.findOne({
      where: { id: doctor_id, role: 'doctor' },
      include: [{ model: models.Doctor, attributes: ['id'] }]
    });
    if (!doctor || !doctor.Doctor) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ bác sĩ' });
    }

    const appointmentDate = moment(date).format('YYYY-MM-DD');

    const availabilityContext = await appointmentHelper.getDoctorAvailabilityContext({
      doctorId: doctor.Doctor.id,
      appointmentDate,
      transaction: null
    });

    if (availabilityContext.leaveBlocksAll) {
      return res.json({ success: true, data: { availableSlots: [] } });
    }

    const sourceShifts = availabilityContext.sourceShifts || [];
    const busySlotsInMinutes = availabilityContext.busyIntervals || [];
    const leave = availabilityContext.leave;
    const leaveShiftNames = new Set((availabilityContext.leaveShiftNames || []).map((value) => String(value)));

    if (sourceShifts.length === 0) {
      return res.json({ success: true, data: { availableSlots: [] } });
    }

    console.log('🔍 [getAvailableSlots] Busy Slots:', {
      date: date,
      doctorId: doctor.user_id,
      sourceShiftCount: sourceShifts.length,
      busyCount: busySlotsInMinutes.length,
      leaveType: leave?.leave_type || null
    });
    
    // 6. Tạo ra các slot tiềm năng và kiểm tra
    const availableSlots = [];
    const slotInterval = 30; // Tạo slot mỗi 30 phút

    for (const shift of sourceShifts) {
      if (leaveShiftNames.has(String(shift.shift_name || ''))) continue;

        const shiftStart = timeToMinutes(shift.start_time);
        const shiftEnd = timeToMinutes(shift.end_time);
        
        for (let slotStartMinutes = shiftStart; slotStartMinutes < shiftEnd; slotStartMinutes += slotInterval) {
            const slotEndMinutes = slotStartMinutes + duration_minutes;

            // Slot phải nằm trọn trong ca làm việc
            if (slotEndMinutes > shiftEnd) continue;

        if (leave && leave.leave_type === 'time_range') {
          const leaveStart = timeToMinutes(leave.time_from);
          const leaveEnd = timeToMinutes(leave.time_to);
          if ((slotStartMinutes < leaveEnd) && (slotEndMinutes > leaveStart)) continue;
        }

            // Kiểm tra xung đột với lịch bận
            const isBusy = busySlotsInMinutes.some(busy => {
                // (StartA < EndB) AND (EndA > StartB)
                return (slotStartMinutes < busy.end) && (slotEndMinutes > busy.start);
            });

            const timeStr = `${String(Math.floor(slotStartMinutes / 60)).padStart(2, '0')}:${String(slotStartMinutes % 60).padStart(2, '0')}`;
            
            availableSlots.push({
                time: timeStr,
                isBusy: isBusy
            });
        }
    }

    // Lọc ra các slot trùng lặp (nếu có 2 ca) và sắp xếp
    const uniqueSlots = Array.from(new Map(availableSlots.map(slot => [slot.time, slot])).values())
                            .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

    res.json({
        success: true,
        data: { availableSlots: uniqueSlots }
    });

  } catch (error) {
    console.error('Error getting available slots:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy khung giờ',
      error: error.message
    });
  }
};

/**
 * MỚI: Bệnh nhân/Bác sĩ gửi Báo cáo Vấn đề
 * POST /api/consultations/:id/report
 */
// ========== REPORT CONSULTATION ISSUE ==========
exports.reportConsultationIssue = async (req, res) => {
  try {
    const { id } = req.params; // consultation_id
    const { report_type, description, priority } = req.body;
    const userId = req.user.id;

    // ✅ Validation
    if (!report_type) {
      return res.status(400).json({
        success: false,
        message: 'Loại báo cáo không được để trống'
      });
    }

    if (!description || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Mô tả phải có ít nhất 10 ký tự'
      });
    }

    const validReportTypes = [
      'technical', 'behavior', 'emergency', 'security',
      'no_video', 'no_audio', 'connection_lost',
      'poor_quality', 'network_issue', 'server_error', 'other'
    ];

    if (!validReportTypes.includes(report_type)) {
      return res.status(400).json({
        success: false,
        message: 'Loại báo cáo không hợp lệ'
      });
    }

    // ✅ Kiểm tra consultation tồn tại
    const consultation = await models.Consultation.findByPk(id);
    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Tư vấn không tồn tại'
      });
    }

    const isReporter = 
      consultation.patient_id === userId || 
      consultation.doctor_id === userId;

    if (!isReporter && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền báo cáo tư vấn này'
      });
    }

    const report = await models.ConsultationReport.create({
      consultation_id: id,
      reporter_id: userId,
      report_type: report_type.toLowerCase(),
      description: description.trim(),
      priority: priority || 'medium',
      status: 'pending'
    });

    try {
      await models.AuditLog.create({
        user_id: userId,
        action_type: 'create_report',
        entity_type: 'consultation_report',
        entity_id: report.id,
        changes: JSON.stringify({
          report_type,
          description: description.substring(0, 100),
          priority
        })
      });
    } catch (auditErr) {
      // Không để lỗi AuditLog ảnh hưởng đến báo cáo chính
      console.warn('AuditLog warning:', auditErr.message);
    }

    const adminUsers = await models.User.findAll({
      where: { role: 'admin' }
    });

    for (const admin of adminUsers) {
      await models.Notification.create({
        user_id: admin.id,
        type: 'appointment',
        message: `🚨 Báo cáo sự cố mới từ tư vấn #${id}: ${report_type}`,
        link: `/quan-ly-tu-van/realtime?tab=monitor`,
        is_read: false
      });
    }

    // Broadcast realtime cho admin panel
    if (global.wsBroadcastToAdmins) {
      global.wsBroadcastToAdmins({
        type: 'new_incident',
        payload: {
          id: report.id,
          consultation_id: Number(id),
          consultation_code: consultation.consultation_code,
          report_type,
          priority: priority || 'medium',
          description: description.substring(0, 100),
          status: 'pending',
          reporter_id: userId,
          created_at: report.created_at
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Báo cáo đã gửi thành công',
      data: {
        id: report.id,
        status: report.status,
        created_at: report.created_at
      }
    });

  } catch (error) {
    console.error('Error reporting issue:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi báo cáo',
      error: error.message
    });
  }

};

/**
 * Xác thực mật khẩu để vào phòng chat/video
 * POST /api/consultations/:id/verify-password
 */
exports.verifyRoomPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const userId = req.user.id;

    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng nhập mật khẩu' 
      });
    }

    // Kiểm tra consultation tồn tại và user có quyền
    const consultation = await models.Consultation.findOne({
      where: {
        id,
        [Op.or]: [
          { patient_id: userId },
          { doctor_id: userId }
        ]
      }
    });

    if (!consultation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy buổi tư vấn' 
      });
    }

    // Lấy mật khẩu của user hiện tại
    const user = await models.User.findByPk(userId, {
      attributes: ['password_hash']
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy tài khoản' 
      });
    }

    // So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Mật khẩu không chính xác' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Xác thực thành công' 
    });

  } catch (error) {
    console.error('Error verifyRoomPassword:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi xác thực', 
      error: error.message 
    });
  }
};
exports.createConsultationReport = exports.reportConsultationIssue;

// ========== GET REPORTS (Admin) ==========
exports.getConsultationReports = async (req, res) => {
  try {
    const { status, report_type, priority, limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    const where = {};
    if (status) where.status = status;
    if (report_type) where.report_type = report_type;
    if (priority) where.priority = priority;

    // Bệnh nhân / bác sĩ chỉ xem báo cáo của chính mình
    if (userRole !== 'admin' && userRole !== 'staff') {
      where.reporter_id = userId;
    }

    const reports = await models.ConsultationReport.findAndCountAll({
      where,
      include: [
        {
          model: models.Consultation,
          as: 'consultation',
          attributes: ['id', 'consultation_code', 'appointment_time', 'consultation_type', 'status'],
          include: [
            {
              model: models.User,
              as: 'doctor',
              attributes: ['id', 'full_name', 'phone']
            },
            {
              model: models.User,
              as: 'patient',
              attributes: ['id', 'full_name', 'phone']
            },
            {
              model: models.ConsultationPricing,
              as: 'package',
              attributes: ['id', 'package_name', 'duration_minutes', 'price']
            }
          ]
        },
        { model: models.User, as: 'reporter', attributes: ['id', 'full_name', 'email'] }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: reports.rows,
      pagination: {
        total: reports.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tải báo cáo',
      error: error.message
    });
  }
};

// ========== RESOLVE REPORT (Admin) ==========
exports.resolveReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, admin_notes } = req.body;
    const userId = req.user.id;

    const validStatuses = ['acknowledged', 'investigating', 'resolved', 'wont_fix'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ'
      });
    }

    const report = await models.ConsultationReport.findByPk(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Báo cáo không tồn tại'
      });
    }

    // ✅ Update report
    await report.update({
      status,
      admin_notes: admin_notes || null,
      resolved_at: status === 'resolved' ? new Date() : null,
      resolved_by: status === 'resolved' ? userId : null
    });

    // ✅ Notify reporter
    await models.Notification.create({
      user_id: report.reporter_id,
      type: 'appointment',
      message: `✅ Báo cáo của bạn đã được xử lý: ${status}`,
      link: `/quan-ly-tu-van/realtime`,
      is_read: false
    });

    // Broadcast realtime cho reporter
    if (global.wsSendToUser) {
      global.wsSendToUser(report.reporter_id, {
        type: 'incident_resolved',
        payload: {
          report_id: report.id,
          status,
          admin_notes: admin_notes || null
        }
      });
    }

    res.json({
      success: true,
      message: 'Cập nhật trạng thái báo cáo thành công',
      data: report
    });
  } catch (error) {
    console.error('Error resolving report:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật báo cáo',
      error: error.message
    });
  }
};

/**
 * MỚI: Gửi lại OTP cho phòng chat
 * POST /api/consultations/:id/resend-otp
 */
exports.resendConsultationOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const consultation = await models.Consultation.findOne({
      where: { id },
      include: [
        { model: models.User, as: 'patient', attributes: ['id', 'full_name', 'email'] },
        { model: models.User, as: 'doctor', attributes: ['id', 'full_name', 'email'] }
      ]
    });

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tư vấn' });
    }

    // Kiểm tra quyền (chỉ admin, bệnh nhân, hoặc bác sĩ của ca này)
    if (req.user.role !== 'admin' && 
        consultation.patient_id !== userId && 
        consultation.doctor_id !== userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    // Chỉ áp dụng cho 'chat' và 'confirmed'
    if (consultation.consultation_type !== 'chat') {
      return res.status(400).json({ success: false, message: 'Chỉ áp dụng cho tư vấn Chat' });
    }
    if (consultation.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể gửi lại OTP cho lịch đã xác nhận' });
    }

    // 1. Tạo OTP mới
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60000); // Hết hạn sau 10 phút

    // 2. Cập nhật CSDL
    await consultation.update({ 
      chat_otp: otp, 
      otp_expires_at: expiry,
      reminder_sent: true // Đánh dấu là đã gửi (để cron job không gửi đè)
    });

    const chatLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/tu-van/${consultation.id}/chat`;
    const appointmentTime = new Date(consultation.appointment_time).toLocaleString('vi-VN');

    // 3. Gửi Email cho Bệnh nhân
    await emailSender.sendEmail({
        to: consultation.patient.email,
        subject: `[Gửi lại] Mã OTP tư vấn: ${otp}`,
        template: 'chat_reminder_otp',
        data: {
            patientName: consultation.patient.full_name,
            doctorName: consultation.doctor.full_name,
            appointmentTime: appointmentTime,
            chatLink: chatLink,
            otp: otp
        }
    });

    // 4. Gửi Email cho BÁC SĨ
    await emailSender.sendEmail({
        to: consultation.doctor.email,
        subject: `[Gửi lại] Mã OTP tư vấn: ${otp}`,
        template: 'chat_reminder_otp',
        data: {
            patientName: `Bác sĩ ${consultation.doctor.full_name}`, 
            doctorName: consultation.patient.full_name, 
            appointmentTime: appointmentTime,
            chatLink: chatLink,
            otp: otp
        }
    });

    res.json({ success: true, message: 'Đã gửi lại OTP thành công' });

  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi lại OTP',
      error: error.message
    });
  }
};

/**
 * MỚI: Bệnh nhân xác thực OTP để vào phòng Video
 * POST /api/consultations/:id/verify-video-otp
 */
exports.verifyVideoOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    const patient_id = req.user.id;

    if (!otp) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập OTP' });
    }

    const consultation = await models.Consultation.findOne({
      where: {
        id: id,
        patient_id: patient_id
      }
    });

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tư vấn' });
    }
    
    // Kiểm tra OTP
    if (consultation.video_otp !== otp) {
      return res.status(400).json({ success: false, message: 'Mã OTP không chính xác' });
    }
    
    // SỬA LOGIC: Kiểm tra OTP có hiệu lực trong suốt thời gian hẹn
    
    // 1. Lấy thời gian hiện tại
    const now = moment();
    
    // 2. Lấy thời lượng của gói (từ Model Consultation), fallback 30 phút
    // (Model Consultation.js đã định nghĩa 'duration_minutes')
    const duration = consultation.duration_minutes || 30;
    
    // 3. Tính thời điểm KẾT THÚC của phiên hẹn
    const sessionEndTime = moment(consultation.appointment_time).add(duration, 'minutes');

    // 4. So sánh
    // Nếu thời gian hiện tại đã TRỄ HƠN thời gian kết thúc phiên
    if (now.isAfter(sessionEndTime)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phiên tư vấn này đã kết thúc' // Thông báo chính xác hơn
      });
    }
    
    // Nếu logic này được chạy, nghĩa là OTP vẫn còn trong thời gian hợp lệ của phiên
    // (Chúng ta không cần kiểm tra video_otp_expires_at nữa)

    // Xác thực thành công
    res.status(200).json({
      success: true,
      message: 'Xác thực OTP thành công'
    });

  } catch (error) {
    console.error('Error verifying video OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xác thực OTP',
      error: error.message
    });
  }
};

/**
 * MỚI: Gửi lại OTP cho phòng VIDEO
 * POST /api/consultations/:id/resend-video-otp
 */
exports.resendVideoOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // Chỉ bệnh nhân mới có thể yêu cầu

    const consultation = await models.Consultation.findOne({
      where: { 
        id,
        patient_id: userId
      },
      include: [
        { model: models.User, as: 'patient', attributes: ['id', 'full_name', 'email'] },
        { model: models.User, as: 'doctor', attributes: ['id', 'full_name', 'email'] }
      ]
    });

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tư vấn' });
    }

    // Chỉ áp dụng cho 'video' và 'confirmed'/'in_progress'
    if (consultation.consultation_type !== 'video') {
      return res.status(400).json({ success: false, message: 'Chỉ áp dụng cho tư vấn Video' });
    }
    if (!['confirmed', 'in_progress'].includes(consultation.status)) {
      return res.status(400).json({ success: false, message: 'Chỉ có thể gửi lại OTP cho lịch đã xác nhận hoặc đang diễn ra' });
    }

    // 1. Tạo OTP mới
    const videoOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60000); // Hết hạn sau 10 phút

    // 2. Cập nhật CSDL
    await consultation.update({ 
      video_otp: videoOtp, 
      video_otp_expires_at: expiry,
      reminder_sent: true 
    });

    const videoLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/tu-van/video/${consultation.id}`;
    const appointmentTime = new Date(consultation.appointment_time).toLocaleString('vi-VN');

    // 3. Gửi Email cho Bệnh nhân
    await emailSender.sendEmail({
        to: consultation.patient.email,
        subject: `[Gửi lại] Mã OTP Video Call: ${videoOtp}`,
        template: 'video_reminder', // Dùng template video đã tạo
        data: {
            patientName: consultation.patient.full_name,
            doctorName: consultation.doctor.full_name,
            appointmentTime: appointmentTime,
            videoLink: videoLink,
            otp: videoOtp
        }
    });

    // 4. (Tùy chọn) Gửi Email cho BÁC SĨ (để họ cũng biết mã)
    await emailSender.sendEmail({
        to: consultation.doctor.email,
        subject: `[Gửi lại] Mã OTP Video Call: ${videoOtp}`,
        template: 'video_reminder',
        data: {
            patientName: `Bác sĩ ${consultation.doctor.full_name}`, 
            doctorName: consultation.patient.full_name, 
            appointmentTime: appointmentTime,
            videoLink: videoLink,
            otp: videoOtp
        }
    });

    res.json({ success: true, message: 'Đã gửi lại OTP thành công' });

  } catch (error) {
    console.error('Error resending Video OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi lại OTP',
      error: error.message
    });
  }
};

/**
 * MỚI: Staff lấy danh sách tư vấn của bác sĩ được phân công
 * GET /api/consultations/staff/managed
 */
exports.getStaffManagedConsultations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, type, page = 1, limit = 20 } = req.query;
    
    // 1. Lấy Staff profile
    const staffProfile = await models.Staff.findOne({ 
      where: { user_id: userId } 
    });
    
    if (!staffProfile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy hồ sơ nhân viên' 
      });
    }
    
    // 2. Lấy danh sách doctor user_id được phân công
    const managedDoctorIds = staffProfile.managed_doctors?.doctor_ids || [];
    
    if (managedDoctorIds.length === 0) {
      return res.status(200).json({ 
        success: true, 
        data: [],
        message: 'Bạn chưa được phân công quản lý bác sĩ nào.'
      });
    }
    
    // 3. Query consultations
    const where = {
      doctor_id: { [Op.in]: managedDoctorIds }
    };
    
    if (status && status !== 'all') where.status = status;
    if (type && type !== 'all') where.consultation_type = type;
    
    const offset = (page - 1) * limit;
    
    const { count, rows } = await models.Consultation.findAndCountAll({
      where,
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['id', 'full_name', 'avatar_url', 'phone']
        },
        {
          model: models.User,
          as: 'doctor',
          attributes: ['id', 'full_name', 'avatar_url'],
          include: [{
            model: models.Doctor,
            include: [{
              model: models.Specialty,
              as: 'specialty',
              attributes: ['id', 'name']
            }]
          }]
        },
        {
          model: models.ConsultationPricing,
          as: 'package',
          attributes: ['package_name', 'duration_minutes', 'price']
        }
      ],
      order: [['appointment_time', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: rows,
      managedDoctorIds,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
    
  } catch (error) {
    console.error('Error in getStaffManagedConsultations:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách tư vấn',
      error: error.message
    });
  }
};

/**
 * ==================== PUBLIC METHODS ====================
 */

/**
 * (PUBLIC) Lấy danh sách gói tư vấn để hiển thị trên trang chủ
 * GET /api/consultations/packages
 * No authentication required - Public endpoint
 */
exports.getAllPublicPackages = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    // Query ConsultationPricing table, lấy các gói đang hoạt động
    const packages = await models.ConsultationPricing.findAll({
      where: { is_active: true },
      order: [['created_at', 'DESC']], // Sắp xếp theo mới nhất
      limit: parseInt(limit),
      attributes: [
        'id',
        'package_name',
        'package_type',
        'duration_minutes',
        'price',
        'description',
        'doctor_codes',
        'is_active',
        'created_at'
      ]
    });

    res.json({
      success: true,
      data: packages || []
    });

  } catch (error) {
    console.error('Error getting public packages:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách gói dịch vụ',
      error: error.message
    });
  }
};

// ========== BỆNH NHÂN XEM TIN NHẮN HỆ THỐNG ==========
exports.getConsultationMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const consultation = await models.Consultation.findByPk(id);
    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tư vấn' });
    }

    // Chỉ patient hoặc doctor của phiên mới được xem
    if (consultation.patient_id !== userId && consultation.doctor_id !== userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    const messages = await models.ChatMessage.findAll({
      where: {
        consultation_id: id,
        is_deleted: false,
        [Op.or]: [
          { is_system_message: true },
          { message_type: 'system' }
        ]
      },
      include: [{ model: models.User, as: 'sender', attributes: ['id', 'full_name'] }],
      order: [['created_at', 'ASC']]
    });

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error getting consultation messages:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy tin nhắn', error: error.message });
  }
};




// ========== BỆNH NHÂN GỬI PHẢN HỒI SỰ CỐ ==========
exports.replyToReport = async (req, res) => {
  try {
    const { id } = req.params; // consultation_id
    const { message, report_id } = req.body;
    const userId = req.user.id;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung' });
    }

    const consultation = await models.Consultation.findByPk(id);
    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tư vấn' });
    }

    if (consultation.patient_id !== userId && consultation.doctor_id !== userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }

    // Lưu tin nhắn phản hồi vào ChatMessage
    const chatMsg = await models.ChatMessage.create({
      consultation_id: id,
      sender_id: userId,
      sender_type: consultation.patient_id === userId ? 'patient' : 'doctor',
      receiver_id: consultation.doctor_id === userId ? consultation.patient_id : consultation.doctor_id,
      message_type: 'system',
      content: `[PHẢN HỒI] ${message.trim()}`,
      is_system_message: true,
      is_read: false,
      metadata: { reply_to_report: report_id || null }
    });

    // Thông báo cho admin
    const admins = await models.User.findAll({ where: { role: 'admin' } });
    for (const admin of admins) {
      await models.Notification.create({
        user_id: admin.id,
        type: 'appointment',
        message: `💬 Bệnh nhân phản hồi sự cố tư vấn #${id}`,
        link: `/quan-ly-tu-van/realtime?tab=monitor`,
        is_read: false
      });
    }

    res.json({ success: true, message: 'Gửi phản hồi thành công', data: chatMsg });
  } catch (error) {
    console.error('Error replying to report:', error);
    res.status(500).json({ success: false, message: 'Lỗi gửi phản hồi', error: error.message });
  }
};
