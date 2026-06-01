// server/controllers/serviceController.js
const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');

const { Service, ServiceCategory, Specialty, Doctor, User, Appointment } = models;

/**
 * @route   GET /api/services/admin/all
 * @desc    Lấy tất cả dịch vụ cho admin (với pagination, filter, search)
 * @access  Private (Admin)
 */
exports.getServicesForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category_id,
      status,
      sort = 'name',
      order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { short_description: { [Op.like]: `%${search}%` } }
      ];
    }
    if (category_id) {
      whereClause.category_id = category_id;
    }
    if (status) {
      whereClause.status = status;
    }

    const { count, rows: services } = await Service.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: ServiceCategory,
          as: 'category',
          attributes: ['id', 'name', 'slug']
        },
        {
          model: Specialty,
          as: 'specialty',
          attributes: ['id', 'name']
        }
      ],
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: offset,
      distinct: true
    });

    const serviceIds = services.map(service => service.id);
    let appointmentStatsMap = {};

    if (serviceIds.length > 0) {
      const appointmentStats = await Appointment.findAll({
        attributes: [
          'service_id',
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          service_id: { [Op.in]: serviceIds },
          appointment_type: 'offline'
        },
        group: ['service_id', 'status'],
        raw: true
      });

      appointmentStatsMap = appointmentStats.reduce((acc, row) => {
        const serviceId = Number(row.service_id);
        const status = row.status;
        const rowCount = Number(row.count || 0);

        if (!acc[serviceId]) {
          acc[serviceId] = { active: 0, completed: 0 };
        }

        if (status === 'completed') {
          acc[serviceId].completed += rowCount;
        } else if (status !== 'cancelled') {
          acc[serviceId].active += rowCount;
        }

        return acc;
      }, {});
    }

    // ✅ MỚI: Populate doctors từ doctor_codes cho từng service
    const servicesWithDoctors = await Promise.all(
      services.map(async (service) => {
        const serviceData = service.toJSON();
        const stats = appointmentStatsMap[serviceData.id] || { active: 0, completed: 0 };
        let doctors = [];
        if (serviceData.doctor_codes && Array.isArray(serviceData.doctor_codes) && serviceData.doctor_codes.length > 0) {
          doctors = await Doctor.findAll({
            where: {
              code: { [Op.in]: serviceData.doctor_codes },
              work_status: 'active'
            },
            include: [
              { model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'phone'] },
              { model: Specialty, as: 'specialty', attributes: ['id', 'name'] }
            ],
            order: [['user_id', 'ASC']]
          });
        }
        serviceData.doctors = doctors;
        serviceData.active_appointments = stats.active;
        serviceData.completed_appointments = stats.completed;
        return serviceData;
      })
    );

    res.json({
      success: true,
      data: servicesWithDoctors,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error in getServicesForAdmin:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách dịch vụ cho admin',
      error: error.message
    });
  }
};

/* ==================== TẠO DỊCH VỤ ==================== */
exports.createService = async (req, res) => {
  try {
    const {
      category_id,
      specialty_id,
      name,
      price,
      duration,
      short_description,
      detailed_content,
      image_url,
      user_ids,           // <-- NHẬN MỚI
      allow_doctor_choice,
      status
    } = req.body;

    // === VALIDATE BẮT BUỘC ===
    if (!category_id || !name || !price || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: category_id, name, price, duration'
      });
    }

    // === VALIDATE & MAP user_ids → doctor_codes ===
    let doctorCodes = null;
    if (user_ids !== undefined && user_ids !== null) {
      if (!Array.isArray(user_ids)) {
        return res.status(400).json({
          success: false,
          message: 'user_ids phải là một mảng hoặc null'
        });
      }

      if (user_ids.length > 0) {
        const doctors = await Doctor.findAll({
          where: { user_id: { [Op.in]: user_ids } },
          attributes: ['code']
        });
        if (doctors.length !== user_ids.length) {
          return res.status(400).json({
            success: false,
            message: 'Một số user_id không tồn tại hoặc không phải bác sĩ'
          });
        }
        doctorCodes = doctors.map(d => d.code);
      }
    }

    // === TẠO DỊCH VỤ ===
    const service = await Service.create({
      category_id,
      specialty_id: specialty_id || null,
      name,
      price,
      duration,
      short_description: short_description || null,
      detailed_content: detailed_content || null,
      image_url: image_url || null,
      doctor_codes: doctorCodes, // <-- LƯU VÀO CỘT JSON
      allow_doctor_choice: allow_doctor_choice !== undefined ? allow_doctor_choice : true,
      status: status || 'active'
    });

    const createdService = await Service.findByPk(service.id, {
      include: [
        { model: ServiceCategory, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: Specialty, as: 'specialty', attributes: ['id', 'name'] }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Tạo dịch vụ thành công',
      data: createdService
    });

  } catch (error) {
    console.error('Error in createService:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo dịch vụ',
      error: error.message
    });
  }
};

/* ==================== CẬP NHẬT DỊCH VỤ ==================== */
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      specialty_id,
      name,
      price,
      duration,
      short_description,
      detailed_content,
      image_url,
      user_ids,           // <-- NHẬN MỚI
      allow_doctor_choice,
      status
    } = req.body;

    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dịch vụ'
      });
    }

    // === VALIDATE & MAP user_ids → doctor_codes ===
    let doctorCodes = service.doctor_codes;
    if (user_ids !== undefined) {
      if (user_ids !== null && !Array.isArray(user_ids)) {
        return res.status(400).json({
          success: false,
          message: 'user_ids phải là một mảng hoặc null'
        });
      }

      if (user_ids && user_ids.length > 0) {
        const doctors = await Doctor.findAll({
          where: { user_id: { [Op.in]: user_ids } },
          attributes: ['code']
        });
        if (doctors.length !== user_ids.length) {
          return res.status(400).json({
            success: false,
            message: 'Một số user_id không tồn tại hoặc không phải bác sĩ'
          });
        }
        doctorCodes = doctors.map(d => d.code);
      } else {
        doctorCodes = null;
      }
    }

    // === CẬP NHẬT ===
    await service.update({
      category_id: category_id !== undefined ? category_id : service.category_id,
      specialty_id: specialty_id !== undefined ? (specialty_id || null) : service.specialty_id,
      name: name !== undefined ? name : service.name,
      price: price !== undefined ? price : service.price,
      duration: duration !== undefined ? duration : service.duration,
      short_description: short_description !== undefined ? short_description : service.short_description,
      detailed_content: detailed_content !== undefined ? detailed_content : service.detailed_content,
      image_url: image_url !== undefined ? image_url : service.image_url,
      doctor_codes: doctorCodes,
      allow_doctor_choice: allow_doctor_choice !== undefined ? allow_doctor_choice : service.allow_doctor_choice,
      status: status !== undefined ? status : service.status
    });

    const updatedService = await Service.findByPk(id, {
      include: [
        { model: ServiceCategory, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: Specialty, as: 'specialty', attributes: ['id', 'name'] }
      ]
    });

    res.json({
      success: true,
      message: 'Cập nhật dịch vụ thành công',
      data: updatedService
    });

  } catch (error) {
    console.error('Error in updateService:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật dịch vụ',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/services/:id
 * @desc    Lấy chi tiết một dịch vụ công khai (bao gồm danh sách bác sĩ)
 * @access  Public
 */
exports.getServiceByIdPublic = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findOne({
      where: {
        id: id,
        status: 'active'
      },
      include: [
        {
          model: ServiceCategory,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'description']
        },
        {
          model: Specialty,
          as: 'specialty',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dịch vụ'
      });
    }

    // Lấy danh sách bác sĩ từ doctor_codes
    let doctors = [];
    if (service.doctor_codes && Array.isArray(service.doctor_codes) && service.doctor_codes.length > 0) {
      doctors = await Doctor.findAll({
        where: {
          code: {
            [Op.in]: service.doctor_codes
          },
          work_status: 'active'
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'email', 'phone']
          },
          {
            model: Specialty,
            as: 'specialty',
            attributes: ['id', 'name']
          }
        ],
        order: [['user_id', 'ASC']]
      });
    }

    // Convert service to plain object và thêm doctors
    const serviceData = service.toJSON();
    serviceData.doctors = doctors || [];

    res.json({
      success: true,
      data: serviceData
    });

  } catch (error) {
    console.error('Error in getServiceByIdPublic:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin dịch vụ',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/services/:id/doctors
 * @desc    Lấy danh sách bác sĩ được chỉ định cho dịch vụ (dùng cho booking page)
 * @access  Public
 */
exports.getServiceDoctors = async (req, res) => {
  try {
    const { id } = req.params;

    // Kiểm tra dịch vụ tồn tại
    const service = await Service.findOne({
      where: { id, status: 'active' },
      attributes: ['doctor_codes', 'allow_doctor_choice']
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dịch vụ'
      });
    }

    if (!service.allow_doctor_choice) {
      return res.json({
        success: true,
        allow_choice: false,
        doctors: []
      });
    }

    let doctors = [];
    if (service.doctor_codes && Array.isArray(service.doctor_codes) && service.doctor_codes.length > 0) {
      doctors = await Doctor.findAll({
        where: {
          code: { [Op.in]: service.doctor_codes },
          work_status: 'active'
        },
        include: [
          { model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'phone'] },
          { model: Specialty, as: 'specialty', attributes: ['id', 'name'] }
        ],
        order: [['user_id', 'ASC']]
      });
    }

    res.json({
      success: true,
      allow_choice: true,
      doctors
    });

  } catch (error) {
    console.error('Error in getServiceDoctors:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách bác sĩ của dịch vụ',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/services
 * @desc    Lấy danh sách dịch vụ công khai (có filter, search, paginate)
 * @access  Public
 */
exports.getPublicServices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category_id,
      specialty_id,
      search,
      sort = 'name',
      order = 'ASC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = { status: 'active' };
    if (category_id) whereClause.category_id = category_id;
    if (specialty_id) whereClause.specialty_id = specialty_id;
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { short_description: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: services } = await Service.findAndCountAll({
      where: whereClause,
      include: [
        { model: ServiceCategory, as: 'category', attributes: ['id', 'name', 'slug'] },
        { model: Specialty, as: 'specialty', attributes: ['id', 'name'] }
      ],
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: offset,
      distinct: true
    });

    res.json({
      success: true,
      data: services,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error in getPublicServices:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách dịch vụ',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/services/:id
 * @desc    Xóa dịch vụ
 * @access  Private (Admin)
 */
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ' });
    }

    const Appointment = models.Appointment;
    const appointmentCount = await Appointment.count({
      where: { service_id: id, status: { [Op.in]: ['pending', 'confirmed'] } }
    });

    if (appointmentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa vì có ${appointmentCount} lịch hẹn đang sử dụng. Đặt trạng thái 'inactive' thay vì xóa.`
      });
    }

    await service.destroy();

    res.json({ success: true, message: 'Xóa dịch vụ thành công' });

  } catch (error) {
    console.error('Error in deleteService:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa dịch vụ',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/services/:id/pause-stats
 * @desc    Lấy thống kê số lượng lịch hẹn, ngày xa nhất để chuẩn bị tạm dừng dịch vụ
 * @access  Private (Admin/Staff)
 */
exports.getServicePauseStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { Appointment, Doctor, User, Service } = models;
    
    // Các trạng thái lịch hẹn được tính là "Đang chạy"
    const activeStatuses = ['pending', 'confirmed', 'upcoming', 'waiting_pay', 'waiting_exam'];
    
    // 1. Đếm số lịch hẹn đang active
    const activeAppointments = await Appointment.count({
      where: { 
        service_id: id,
        status: { [Op.in]: activeStatuses }
      }
    });

    // 2. Tìm ngày xa nhất
    const furthestAppt = await Appointment.findOne({
      where: {
        service_id: id,
        status: { [Op.in]: activeStatuses }
      },
      order: [['appointment_date', 'DESC']]
    });
    
    let furthestDate = 'Không có lịch hẹn nào';
    if (furthestAppt && furthestAppt.appointment_date) {
       const d = new Date(furthestAppt.appointment_date);
       furthestDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    // 3. Tên bác sĩ phụ trách
    const service = await Service.findByPk(id);
    let doctorName = 'Chưa phân công';
    if (service && service.doctor_codes && service.doctor_codes.length > 0) {
       const docs = await Doctor.findAll({
         where: { code: { [Op.in]: service.doctor_codes } },
         include: [{ model: User, as: 'user', attributes: ['full_name'] }]
       });
       if (docs.length === 1) {
          doctorName = `BS. ${docs[0].user?.full_name}`;
       } else if (docs.length > 1) {
          doctorName = `${docs.length} Bác sĩ được phân công`;
       }
    }

    res.json({
      success: true,
      data: {
        activeAppointments,
        furthestDate,
        doctorName
      }
    });

  } catch (error) {
    console.error('Error in getServicePauseStats:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy thống kê tạm dừng', error: error.message });
  }
};

/**
 * @route   POST /api/services/:id/pause
 * @desc    Tạm dừng dịch vụ (Soft pause hoặc Hard pause)
 * @access  Private (Admin/Staff)
 */
exports.pauseService = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'soft' hoặc 'hard'
    const { Appointment, Service, Patient, User, Doctor, Notification } = models;

    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ' });
    }

    // Luôn khóa dịch vụ (chuyển sang inactive) để không ai đặt thêm được nữa
    await service.update({ status: 'inactive' });

    if (action === 'hard') {
      const activeStatuses = ['pending', 'confirmed', 'upcoming', 'waiting_pay', 'waiting_exam'];
      const cancelReason = 'Hệ thống bệnh viện tạm dừng cung cấp dịch vụ này';

      // 1. LẤY DANH SÁCH CÁC LỊCH HẸN SẼ BỊ HỦY (Để lấy thông tin Bệnh nhân & Bác sĩ)
      const affectedAppointments = await Appointment.findAll({
        where: { 
          service_id: id,
          status: { [Op.in]: activeStatuses }
        },
        include: [
          { model: Patient, as: 'Patient' }, // Lấy Patient để biết user_id của bệnh nhân
          { model: Doctor, as: 'Doctor' }    // Lấy Doctor để báo cho bác sĩ
        ]
      });

      // 2. CẬP NHẬT TRẠNG THÁI HỦY HÀNG LOẠT VÀO DATABASE
      await Appointment.update(
        { 
          status: 'cancelled', 
          cancel_reason: cancelReason,
          cancelled_by: 'system',
          cancelled_at: new Date()
        },
        { 
          where: { 
            service_id: id,
            status: { [Op.in]: activeStatuses }
          } 
        }
      );

      // 3. GỬI THÔNG BÁO CHO TỪNG BỆNH NHÂN VÀ BÁC SĨ
      // Lưu ý: Nếu hệ thống bạn có gửi Email, bạn có thể gọi thêm sendEmail() vào vòng lặp này
      if (Notification && affectedAppointments.length > 0) {
        const notificationsToCreate = [];

        for (const appt of affectedAppointments) {
          // Chuẩn bị thông báo cho Bệnh nhân
          if (appt.Patient && appt.Patient.user_id) {
            notificationsToCreate.push({
              user_id: appt.Patient.user_id,
              type: 'appointment_cancelled',
              message: `Lịch hẹn dịch vụ "${service.name}" của bạn vào ngày ${appt.appointment_date} đã bị hủy. Lý do: ${cancelReason}. Vui lòng liên hệ CSKH để được hỗ trợ.`,
              link: `/appointments/${appt.id}`,
              is_read: false,
              created_at: new Date(),
              updated_at: new Date()
            });
          }

          // Chuẩn bị thông báo cho Bác sĩ (để bác sĩ biết khỏi đợi)
          if (appt.Doctor && appt.Doctor.user_id) {
            notificationsToCreate.push({
              user_id: appt.Doctor.user_id,
              type: 'appointment_cancelled',
              message: `Lịch khám dịch vụ "${service.name}" với bệnh nhân mã ${appt.patient_id} vào ngày ${appt.appointment_date} đã bị hệ thống hủy do tạm dừng dịch vụ.`,
              link: `/doctor/appointments/${appt.id}`,
              is_read: false,
              created_at: new Date(),
              updated_at: new Date()
            });
          }
        }

        // Tạo thông báo hàng loạt (Tối ưu hiệu năng thay vì tạo từng cái)
        if (notificationsToCreate.length > 0) {
          await Notification.bulkCreate(notificationsToCreate);
        }
      }
    }

    res.json({
      success: true,
      message: action === 'hard' 
        ? 'Đã tạm dừng dịch vụ, hủy tất cả lịch hẹn và gửi thông báo.' 
        : 'Đã tạm dừng dịch vụ, các lịch hẹn cũ vẫn diễn ra bình thường.'
    });

  } catch (error) {
    console.error('Error in pauseService:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tạm dừng dịch vụ', error: error.message });
  }
};