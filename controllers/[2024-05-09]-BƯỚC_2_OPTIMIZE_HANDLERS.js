// ===== [BƯỚC 2: OPTIMIZE] APPOINTMENT RATING HANDLERS - Reuse ConsultationFeedback =====
// File chứa 3 handlers tối ưu: Sử dụng bảng ConsultationFeedback chung cho cả Consultation & Appointment
// Ngày: 2024-05-09
// Chi tiết implementation: /IMPLEMENTATION_LOG.md → BƯỚC 2 (OPTIMIZED)
// ==================================================================================

/**
 * BƯỚC 2 (OPTIMIZE): Bệnh nhân submit rating/review appointment
 * ────────────────────────────────────────────────────────────
 * Route: PUT /api/appointments/:id/submit-rating
 * Auth: Patient only
 * Body: { rating (1-5), review (text ≤1000 chars) }
 * 
 * Logic:
 * 1. Kiểm tra appointment tồn tại + patient_id = user.id
 * 2. Kiểm tra appointment.status === 'completed'
 * 3. Kiểm tra chưa có feedback (query ConsultationFeedback where appointment_id = id AND service_type = 'appointment')
 * 4. Validate rating 1-5
 * 5. Create ConsultationFeedback record:
 *    - appointment_id = appointment.id
 *    - consultation_id = NULL
 *    - service_type = 'appointment'
 *    - rating, review, patient_id, doctor_id
 *    - status = 'pending' (chờ admin duyệt)
 *    - reviewed_at = NULL (chưa duyệt)
 * 6. Audit log
 * 
 * AC (Access Control):
 * - Chỉ patient của appointment đó
 * - Appointment phải completed
 * - Chỉ 1 feedback per appointment
 * 
 * Response:
 * {
 *   success: true,
 *   message: 'Cảm ơn đánh giá! Sẽ được duyệt sớm.',
 *   data: { feedback_id, rating, status: 'pending' }
 * }
 * 
 * Errors:
 * - 400: Rating invalid / Appointment chưa complete / Đã feedback
 * - 403: Không phải patient
 * - 404: Appointment not found
 */
exports.submitAppointmentRating = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;  // appointment ID hoặc CODE
    const { rating, review } = req.body;
    const patient = req.user;

    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating phải nằm trong khoảng 1-5 sao'
      });
    }

    if (review && review.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung review không vượt quá 1000 ký tự'
      });
    }

    // 1. Tìm appointment (bằng code hoặc id)
    let appointment = await models.Appointment.findOne({
      where: { code: id },
      transaction: t
    });

    if (!appointment && !isNaN(id)) {
      appointment = await models.Appointment.findByPk(id, { transaction: t });
    }

    if (!appointment) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // 2. Kiểm tra appointment thuộc patient này
    if (appointment.patient_id !== patient.id) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền đánh giá lịch hẹn này'
      });
    }

    // 3. Kiểm tra status = completed
    if (appointment.status !== 'completed') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể đánh giá lịch hẹn đã hoàn thành'
      });
    }

    // 4. Kiểm tra chưa có feedback (query ConsultationFeedback)
    const existingFeedback = await models.ConsultationFeedback.findOne({
      where: {
        appointment_id: appointment.id,
        service_type: 'appointment'
      },
      transaction: t
    });

    if (existingFeedback) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: 'Bạn đã đánh giá lịch hẹn này rồi'
      });
    }

    // 5. Create ConsultationFeedback record (reuse bảng chung)
    const feedback = await models.ConsultationFeedback.create({
      appointment_id: appointment.id,
      consultation_id: null,  // NULL vì appointment, không consultation
      service_type: 'appointment',  // 📌 Phân loại loại dịch vụ
      patient_id: patient.id,
      doctor_id: appointment.doctor_id,
      rating: parseInt(rating),
      review: review || null,
      status: 'pending',  // Chờ admin duyệt
      reviewed_at: null  // Chưa duyệt
    }, { transaction: t });

    // 6. Audit log
    await createAuditLog({
      user_id: patient.id,
      action: 'APPOINTMENT_RATING_SUBMITTED',
      entity: 'ConsultationFeedback',
      entity_id: feedback.id,
      changes: { rating, review: review ? 'text...' : null, service_type: 'appointment' },
      status: 'success'
    }, t);

    await t.commit();

    return res.status(201).json({
      success: true,
      message: 'Cảm ơn đánh giá của bạn! Feedback sẽ được duyệt sớm.',
      data: {
        feedback_id: feedback.id,
        appointment_id: appointment.id,
        rating: feedback.rating,
        status: feedback.status
      }
    });

  } catch (error) {
    await t.rollback();
    console.error('ERROR submitAppointmentRating:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi đánh giá'
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// BƯỚC 2 (OPTIMIZE): Xem danh sách feedbacks (appointment + consultation?)
// ─────────────────────────────────────────────────────────────────
/**
 * Route: GET /api/appointments/admin/feedbacks
 * Auth: Admin/Staff
 * Query: { doctor_id?, rating?, status?, service_type?, page=1, limit=20 }
 * 
 * Logic:
 * 1. Query ConsultationFeedback WHERE appointment_id IS NOT NULL (hoặc service_type='appointment')
 * 2. Filter: doctor_id, rating, status (pending/approved/hidden)
 * 3. Optional: service_type để filter chỉ appointment hoặc cả 2
 * 4. Include: Patient (full_name), Doctor (full_name, specialty), Appointment (code, service)
 * 5. Order: created_at DESC (mới nhất)
 * 6. Pagination
 * 
 * AC:
 * - Admin: xem tất cả
 * - Staff: xem feedback appointment của bác sĩ mình quản lý
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     feedbacks: [...],
 *     pagination: { total, page, limit, totalPages }
 *   }
 * }
 */
exports.listAppointmentFeedbacks = async (req, res) => {
  try {
    const {
      doctor_id,
      rating,
      status = 'all',
      service_type = 'appointment',  // Default: chỉ appointment
      page = 1,
      limit = 20
    } = req.query;

    const user = req.user;
    const whereClause = {
      appointment_id: { [Op.ne]: null },  // Chỉ lấy appointment feedbacks
      service_type: service_type || 'appointment'
    };

    // AC: Staff chỉ xem feedback của bác sĩ mình quản lý
    if (user.role === 'staff') {
      const staff = await models.Staff.findOne({ where: { user_id: user.id } });
      if (staff && staff.managed_doctors && staff.managed_doctors.doctor_ids) {
        const managedDoctorIds = staff.managed_doctors.doctor_ids;
        const doctors = await models.Doctor.findAll({
          where: { id: { [Op.in]: managedDoctorIds } },
          attributes: ['user_id']
        });
        const doctorUserIds = doctors.map(d => d.user_id);
        whereClause.doctor_id = { [Op.in]: doctorUserIds };
      } else {
        return res.json({
          success: true,
          data: { feedbacks: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } }
        });
      }
    }

    // Filter by doctor_id
    if (doctor_id) {
      whereClause.doctor_id = parseInt(doctor_id);
    }

    // Filter by rating
    if (rating && rating !== 'all') {
      whereClause.rating = parseInt(rating);
    }

    // Filter by status
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Query feedbacks with includes
    const { count, rows: feedbacks } = await models.ConsultationFeedback.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['id', 'full_name', 'avatar_url', 'phone']
        },
        {
          model: models.User,
          as: 'doctor',
          attributes: ['id', 'full_name', 'avatar_url']
        },
        {
          model: models.Appointment,
          as: 'appointment',
          attributes: ['id', 'code', 'appointment_date', 'status'],
          include: [
            {
              model: models.Service,
              as: 'Service',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    return res.status(200).json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('ERROR listAppointmentFeedbacks:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách feedback'
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// BƯỚC 2 (OPTIMIZE): Admin duyệt/ẩn feedback appointment
// ─────────────────────────────────────────────────────────────────
/**
 * Route: PUT /api/appointments/admin/feedbacks/:feedback_id/toggle-status
 * Auth: Admin/Staff
 * Body: { status ('approved'|'hidden'), admin_note? }
 * 
 * Logic:
 * 1. Tìm ConsultationFeedback record
 * 2. Kiểm tra feedback.appointment_id != NULL (là appointment feedback)
 * 3. Kiểm tra phân quyền Staff
 * 4. Validate status (approved/hidden)
 * 5. Update: status, admin_note, reviewed_by, reviewed_at
 * 6. Audit log
 * 
 * AC:
 * - Admin: approve/hide bất kỳ
 * - Staff: approve/hide chỉ feedback của bác sĩ mình quản lý
 * 
 * Response:
 * { success: true, message: 'Feedback được phê duyệt' }
 */
exports.toggleAppointmentFeedbackStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { feedback_id } = req.params;
    const { status, admin_note } = req.body;
    const reviewer = req.user;

    // Validate status
    if (!['approved', 'hidden'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái phải là "approved" hoặc "hidden"'
      });
    }

    // Tìm feedback
    const feedback = await models.ConsultationFeedback.findByPk(feedback_id, { transaction: t });

    if (!feedback) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy feedback'
      });
    }

    // Kiểm tra là appointment feedback
    if (!feedback.appointment_id || feedback.service_type !== 'appointment') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Feedback này không phải từ appointment'
      });
    }

    // AC: Staff chỉ duyệt feedback của bác sĩ mình quản lý
    if (reviewer.role === 'staff') {
      const staff = await models.Staff.findOne({ where: { user_id: reviewer.id } });
      if (staff && staff.managed_doctors && staff.managed_doctors.doctor_ids) {
        const managedDoctorIds = staff.managed_doctors.doctor_ids;
        const doctors = await models.Doctor.findAll({
          where: { id: { [Op.in]: managedDoctorIds } },
          attributes: ['user_id']
        });
        const doctorUserIds = doctors.map(d => d.user_id);
        if (!doctorUserIds.includes(feedback.doctor_id)) {
          await t.rollback();
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền duyệt feedback của bác sĩ này'
          });
        }
      }
    }

    // Update feedback
    await feedback.update({
      status: status,
      admin_note: admin_note || null,
      reviewed_by: reviewer.id,
      reviewed_at: new Date()
    }, { transaction: t });

    // Audit log
    await createAuditLog({
      user_id: reviewer.id,
      action: 'APPOINTMENT_FEEDBACK_REVIEWED',
      entity: 'ConsultationFeedback',
      entity_id: feedback.id,
      changes: { status, admin_note },
      status: 'success'
    }, t);

    await t.commit();

    return res.status(200).json({
      success: true,
      message: `Feedback được ${status === 'approved' ? 'phê duyệt' : 'ẩn'} thành công`,
      data: {
        feedback_id: feedback.id,
        status: feedback.status
      }
    });

  } catch (error) {
    await t.rollback();
    console.error('ERROR toggleAppointmentFeedbackStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật status feedback'
    });
  }
};

// ===== KẾT THÚC APPOINTMENT RATING HANDLERS - OPTIMIZED =====
