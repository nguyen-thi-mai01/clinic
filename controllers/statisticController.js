// ===== [BƯỚC 4] DOCTOR REVIEWS & UNIFIED STATISTICS (2024-05-09) =====
// server/controllers/statisticController.js
//
// Purpose: Public endpoints for displaying doctor reviews and statistics
// Combines consultation_feedback + appointment feedback into unified view
//
// Key Functions:
// 1. getDoctorReviews () - GET /api/statistics/doctor/:id/reviews
// 2. getDoctorUnifiedStats() - GET /api/statistics/doctor/:id/unified

const { Op } = require('sequelize');
let models, sequelize;

try {
  const db = require('../config/db');
  models = db.models;
  sequelize = db.sequelize;
} catch (error) {
  console.log('Warning: Database not configured');
  models = null;
  sequelize = null;
}

// ===== [BƯỚC 4.1] GET DOCTOR REVIEWS ENDPOINT =====
/**
 * Route: GET /api/statistics/doctor/:id/reviews
 * Auth: public (no authentication required)
 * Query:
 * - service_type: 'all'|'consultation'|'appointment' (filter by type)
 * - sort: 'newest'|'highest'|'lowest' (sort order)
 * - page: integer (default 1)
 * - limit: integer (default 10)
 * - status: 'approved' (only show approved reviews)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     reviews: [
 *       {
 *         id, rating, review, created_at,
 *         service_type ('consultation'|'appointment'),
 *         patient: { full_name, avatar_url },
 *         appointment/consultation?: { code, date }
 *       }
 *     ],
 *     pagination: { total, totalPages, page, limit }
 *   }
 * }
 */
exports.getDoctorReviews = async (req, res) => {
  try {
    const { id } = req.params; // doctor_id
    const {
      service_type = 'doctor',
      sort = 'newest',
      page = 1,
      limit = 10,
      status = 'approved'
    } = req.query;

    // Validate doctor exists
    const doctor = await models.User.findByPk(id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Bác sĩ không được tìm thấy'
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {
      doctor_id: id,
      status: status || 'approved'
    };

    // Filter by service type
    if (service_type !== 'all') {
      whereClause.service_type = service_type;
    }

    // Determine sort order
    let orderBy = [['created_at', 'DESC']]; // default: newest
    if (sort === 'highest') {
      orderBy = [['rating', 'DESC'], ['created_at', 'DESC']];
    } else if (sort === 'lowest') {
      orderBy = [['rating', 'ASC'], ['created_at', 'DESC']];
    }

    // ===== [BƯỚC 4] QUERY UNIFIED FEEDBACKS =====
    const { count, rows: feedbacks } = await models.Rating.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: 'patient',
          attributes: ['id', 'full_name', 'avatar_url']
        },
        {
          model: models.Appointment,
          as: 'appointment',
          attributes: ['id', 'code', 'appointment_date'],
          required: false
        },
        {
          model: models.Consultation,
          as: 'consultation',
          attributes: ['id', 'code', 'start_datetime'],
          required: false
        }
      ],
      order: orderBy,
      limit: parseInt(limit),
      offset: offset,
      raw: false
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    return res.status(200).json({
      success: true,
      data: {
        reviews: feedbacks,
        pagination: {
          total: count,
          totalPages: totalPages,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('ERROR getDoctorReviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách đánh giá'
    });
  }
};

// ===== [BƯỚC 4.2] GET DOCTOR UNIFIED STATISTICS ENDPOINT =====
/**
 * Route: GET /api/statistics/doctor/:id/unified
 * Auth: public (no authentication required)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     avg_rating: 4.5,
 *     total_reviews: 120,
 *     breakdown: { 1: 5, 2: 3, 3: 10, 4: 35, 5: 67 },
 *     by_type: { consultation: 70, appointment: 50 },
 *     rating_by_type: {
 *       consultation: { avg: 4.6, total: 70 },
 *       appointment: { avg: 4.4, total: 50 }
 *     }
 *   }
 * }
 */
exports.getDoctorUnifiedStats = async (req, res) => {
  try {
    const { id } = req.params; // doctor_id
    const { service_type = 'doctor' } = req.query;

    // Validate doctor exists
    const doctor = await models.User.findByPk(id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Bác sĩ không được tìm thấy'
      });
    }

    // ===== [BƯỚC 4] QUERY UNIFIED STATS FROM CONSULTATION_FEEDBACK =====
    // Step 1: Get all approved feedback (both consultation + appointment)
    const whereClause = { doctor_id: id, status: 'approved' };
    if (service_type !== 'all') {
      whereClause.service_type = service_type;
    }

    const allFeedbacks = await models.Rating.findAll({
      where: whereClause,
      attributes: ['rating', 'service_type'],
      raw: true
    });

    // Step 2: Calculate aggregate statistics
    if (allFeedbacks.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          avg_rating: 0,
          total_reviews: 0,
          breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          by_type: { consultation: 0, appointment: 0 },
          rating_by_type: {
            consultation: { avg: 0, total: 0 },
            appointment: { avg: 0, total: 0 }
          }
        }
      });
    }

    // Calculate average rating
    const totalRating = allFeedbacks.reduce((sum, fb) => sum + fb.rating, 0);
    const avgRating = (totalRating / allFeedbacks.length).toFixed(1);

    // Calculate rating breakdown
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allFeedbacks.forEach(fb => {
      breakdown[fb.rating]++;
    });

    // Count by service type
    const consultationFeedbacks = allFeedbacks.filter(fb => fb.service_type === 'consultation');
    const appointmentFeedbacks = allFeedbacks.filter(fb => fb.service_type === 'appointment');

    const consultationAvg = consultationFeedbacks.length > 0
      ? (consultationFeedbacks.reduce((sum, fb) => sum + fb.rating, 0) / consultationFeedbacks.length).toFixed(1)
      : 0;

    const appointmentAvg = appointmentFeedbacks.length > 0
      ? (appointmentFeedbacks.reduce((sum, fb) => sum + fb.rating, 0) / appointmentFeedbacks.length).toFixed(1)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        avg_rating: parseFloat(avgRating),
        total_reviews: allFeedbacks.length,
        breakdown: breakdown,
        by_type: {
          consultation: consultationFeedbacks.length,
          appointment: appointmentFeedbacks.length
        },
        rating_by_type: {
          consultation: {
            avg: parseFloat(consultationAvg),
            total: consultationFeedbacks.length
          },
          appointment: {
            avg: parseFloat(appointmentAvg),
            total: appointmentFeedbacks.length
          }
        }
      }
    });

  } catch (error) {
    console.error('ERROR getDoctorUnifiedStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tính toán thống kê'
    });
  }
};

// ===== [DOCTOR RATING CRUD] =====

const hasCompletedDoctorInteraction = async (patientId, doctorId) => {
  const completedAppointment = await models.Appointment.findOne({
    where: {
      patient_id: patientId,
      doctor_id: doctorId,
      status: 'completed'
    },
    attributes: ['id']
  });

  if (completedAppointment) return true;

  const completedConsultation = await models.Consultation.findOne({
    where: {
      patient_id: patientId,
      doctor_id: doctorId,
      status: 'completed'
    },
    attributes: ['id']
  });

  return Boolean(completedConsultation);
};

exports.getMyDoctorReview = async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.user?.id;

    if (!patientId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    }

    const review = await models.Rating.findOne({
      where: {
        doctor_id: id,
        patient_id: patientId,
        service_type: 'doctor'
      },
      include: [
        { model: models.User, as: 'doctor', attributes: ['id', 'full_name', 'avatar_url'] },
        { model: models.User, as: 'patient', attributes: ['id', 'full_name', 'avatar_url'] }
      ]
    });

    return res.status(200).json({ success: true, data: { review } });
  } catch (error) {
    console.error('ERROR getMyDoctorReview:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi tải đánh giá của bạn' });
  }
};

exports.submitDoctorReview = async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.user?.id;
    const { rating, review } = req.body;

    if (!patientId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Số sao phải từ 1 đến 5' });
    }

    const doctor = await models.User.findByPk(id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Bác sĩ không tồn tại' });
    }

    const canReview = await hasCompletedDoctorInteraction(patientId, id);
    if (!canReview) {
      return res.status(403).json({ success: false, message: 'Chỉ bệnh nhân đã hoàn thành lịch hẹn/tư vấn mới được đánh giá bác sĩ này' });
    }

    const existingReview = await models.Rating.findOne({
      where: { doctor_id: id, patient_id: patientId, service_type: 'doctor' }
    });

    const payload = {
      doctor_id: id,
      patient_id: patientId,
      rating: parseInt(rating, 10),
      review: review || null,
      service_type: 'doctor',
      status: 'approved',
      reviewed_at: new Date(),
      reviewed_by: patientId,
      consultation_id: null,
      appointment_id: null
    };

    const savedReview = existingReview
      ? await existingReview.update(payload)
      : await models.Rating.create(payload);

    return res.status(existingReview ? 200 : 201).json({
      success: true,
      message: existingReview ? 'Cập nhật đánh giá bác sĩ thành công' : 'Gửi đánh giá bác sĩ thành công',
      data: { review: savedReview }
    });
  } catch (error) {
    console.error('ERROR submitDoctorReview:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi gửi đánh giá bác sĩ' });
  }
};

exports.updateDoctorReview = async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.user?.id;
    const { rating, review } = req.body;

    if (!patientId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    }

    const doctorReview = await models.Rating.findOne({
      where: { doctor_id: id, patient_id: patientId, service_type: 'doctor' }
    });

    if (!doctorReview) {
      return res.status(404).json({ success: false, message: 'Bạn chưa đánh giá bác sĩ này' });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ success: false, message: 'Số sao phải từ 1 đến 5' });
    }

    await doctorReview.update({
      rating: rating ? parseInt(rating, 10) : doctorReview.rating,
      review: review !== undefined ? review : doctorReview.review,
      reviewed_at: new Date(),
      reviewed_by: patientId,
      status: 'approved'
    });

    return res.status(200).json({ success: true, message: 'Cập nhật đánh giá bác sĩ thành công', data: { review: doctorReview } });
  } catch (error) {
    console.error('ERROR updateDoctorReview:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật đánh giá bác sĩ' });
  }
};

exports.deleteDoctorReview = async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.user?.id;

    if (!patientId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    }

    const doctorReview = await models.Rating.findOne({
      where: { doctor_id: id, patient_id: patientId, service_type: 'doctor' }
    });

    if (!doctorReview) {
      return res.status(404).json({ success: false, message: 'Bạn chưa đánh giá bác sĩ này' });
    }

    await doctorReview.destroy();

    return res.status(200).json({ success: true, message: 'Xóa đánh giá bác sĩ thành công' });
  } catch (error) {
    console.error('ERROR deleteDoctorReview:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xóa đánh giá bác sĩ' });
  }
};

exports.adminListDoctorReviews = async (req, res) => {
  try {
    const { doctor_id, rating, status = 'approved', page = 1, limit = 10 } = req.query;
    const where = { service_type: 'doctor' };
    if (doctor_id) where.doctor_id = doctor_id;
    if (rating) where.rating = parseInt(rating, 10);
    if (status && status !== 'all') where.status = status;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await models.Rating.findAndCountAll({
      where,
      include: [
        { model: models.User, as: 'patient', attributes: ['id', 'full_name', 'avatar_url', 'email', 'phone'] },
        { model: models.User, as: 'doctor', attributes: ['id', 'full_name', 'avatar_url'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset
    });

    return res.status(200).json({
      success: true,
      data: {
        reviews: rows,
        pagination: {
          total: count,
          totalPages: Math.ceil(count / parseInt(limit, 10)),
          page: parseInt(page, 10),
          limit: parseInt(limit, 10)
        }
      }
    });
  } catch (error) {
    console.error('ERROR adminListDoctorReviews:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi tải danh sách đánh giá bác sĩ' });
  }
};

exports.adminUpdateDoctorReviewStatus = async (req, res) => {
  try {
    const { review_id } = req.params;
    const { status, admin_note } = req.body;

    if (!['approved', 'hidden'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    const review = await models.Rating.findByPk(review_id);
    if (!review || review.service_type !== 'doctor') {
      return res.status(404).json({ success: false, message: 'Đánh giá không tồn tại' });
    }

    await review.update({
      status,
      admin_note: admin_note || null,
      reviewed_by: req.user?.id || null,
      reviewed_at: new Date()
    });

    return res.status(200).json({ success: true, message: 'Cập nhật trạng thái đánh giá bác sĩ thành công', data: { review } });
  } catch (error) {
    console.error('ERROR adminUpdateDoctorReviewStatus:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái' });
  }
};
