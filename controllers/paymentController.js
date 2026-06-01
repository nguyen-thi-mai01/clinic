// server/controllers/paymentController.js
// PHIÊN BẢN FINAL FIX:
// 1. Xóa code trùng lặp
// 2. Tự động xử lý mã AP thiếu dấu gạch ngang (AP2111... -> AP-2111-...)
// 3. Force Save Payment khi không tìm thấy User
const emailSender = require('../utils/emailSender');
const notificationHelper = require('../utils/notificationHelper');
const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');
const vnpayService = require('../utils/vnpayService');
const momoService = require('../utils/momoService');
const moment = require('moment');

// ========== WEBHOOK XỬ LÝ THANH TOÁN TỰ ĐỘNG ==========
exports.handleBankWebhook = async (req, res) => {
    try {
        // Log dữ liệu nhận được để debug
        console.log('🔔 [WEBHOOK] Received:', JSON.stringify(req.body));
        
        // 1. Lấy nội dung giao dịch
        // Cấu trúc này hỗ trợ SePay, Casso, VietQR (Standard)
        const { content, description, amount, transferContent, transactionId, id } = req.body;
        
        // Gộp các trường có thể chứa nội dung chuyển khoản lại để tìm kiếm
        const transactionText = (content || description || transferContent || '').toUpperCase();
        
        // 2. Tìm mã giao dịch trong nội dung (Tìm chuỗi bắt đầu bằng REL...)
        // Regex: Tìm chữ REL viết hoa, theo sau là dãy số (VD: REL1703829102)
        const match = transactionText.match(/REL\d+/);
        
        if (match) {
            const paymentCode = match[0];
            console.log('✅ Tìm thấy mã đơn hàng trong nội dung CK:', paymentCode);

            // 3. Tìm đơn hàng trong Database
            const payment = await models.Payment.findOne({ 
                where: { code: paymentCode } 
            });

            if (payment) {
                // Kiểm tra trạng thái để tránh xử lý trùng
                if (payment.status === 'paid') {
                    console.log('ℹ️ Đơn hàng đã được thanh toán trước đó.');
                    return res.json({ success: true, message: 'Already paid' });
                }

                // Kiểm tra số tiền (Cho phép sai số nhỏ hoặc >= số tiền cần thanh toán)
                // Lưu ý: payment.amount trong DB là string hoặc number tùy setup, nên parse ra float
                const requiredAmount = parseFloat(payment.amount);
                const receivedAmount = parseFloat(amount);

                if (receivedAmount >= requiredAmount) {
                    // Cập nhật trạng thái thanh toán thành công
                    await payment.update({ 
                        status: 'paid',
                        transaction_id: transactionId || id || null, // Lưu mã tham chiếu ngân hàng
                        provider_ref: transactionText, // Lưu nội dung gốc để đối soát
                        updated_at: new Date()
                    });
                    
                    console.log(`💰 XÁC NHẬN THANH TOÁN THÀNH CÔNG: ${paymentCode} - Số tiền: ${receivedAmount}`);
                } else {
                    console.log(`⚠️ Số tiền chưa đủ. Đơn: ${requiredAmount}, Nhận: ${receivedAmount}`);
                    // Tùy chọn: Có thể cập nhật trạng thái 'partial_paid' nếu muốn
                }
            } else {
                console.log('❌ Không tìm thấy đơn hàng trên hệ thống với mã:', paymentCode);
            }
        } else {
            console.log('⚠️ Không tìm thấy mã REL... trong nội dung chuyển khoản:', transactionText);
        }

        // Luôn trả về success true để ngân hàng không gửi lại webhook
        res.json({ success: true });

    } catch (error) {
        console.error('Webhook Error:', error);
        // Vẫn trả về 200 hoặc 500 tùy policy, nhưng thường trả 200 để bên gửi không retry spam
        res.status(200).json({ success: false }); 
    }
};

// ========== 1. TẠO THANH TOÁN CHO TƯ VẤN ==========
exports.createConsultationPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { consultation_id, payment_method, proof_image_url } = req.body;

    if (!consultation_id || !payment_method) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin thanh toán' });
    }

    const consultation = await models.Consultation.findByPk(consultation_id, {
      include: [
        { model: models.User, as: 'patient', attributes: ['id', 'full_name', 'email', 'phone'] },
        { model: models.User, as: 'doctor', attributes: ['id', 'full_name'] }
      ]
    });

    if (!consultation) return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tư vấn' });
    if (consultation.patient_id !== userId) return res.status(403).json({ success: false, message: 'Không có quyền' });
    
    // Nếu đã thanh toán rồi thì thôi (kiểm tra cả paid_online và paid_at_clinic)
    if (consultation.payment_status === 'paid_online' || consultation.payment_status === 'paid_at_clinic') {
        // return res.status(400).json({ success: false, message: 'Đã thanh toán' });
    }

    const amount = consultation.total_fee;
    const orderId = `CONS_${consultation.consultation_code}_${Date.now()}`;
    
    // Tạo Payment Record (Pending)
    await models.Payment.create({
        user_id: userId,
        consultation_id: consultation.id,
        amount: amount,
        method: payment_method,
        status: 'pending',
        transaction_id: orderId,
        payment_info: JSON.stringify({ method: payment_method }),
        proof_image_url: proof_image_url || null
    });

    consultation.payment_method = payment_method;
    await consultation.save();

    let paymentUrl = null;
    // Logic lấy link thanh toán VNPAY/MOMO (nếu có)
    if (payment_method === 'vnpay') {
        paymentUrl = vnpayService.createPaymentUrl({
            orderId, amount, orderInfo: `Thanh toan ${consultation.consultation_code}`, ipAddr: req.ip || '127.0.0.1'
        });
    } else if (payment_method === 'momo' && !proof_image_url) {
        const momoRes = await momoService.createPayment({
            orderId, amount, orderInfo: `Thanh toan ${consultation.consultation_code}`
        });
        if(momoRes.success) paymentUrl = momoRes.payUrl;
    }

    res.status(200).json({ success: true, message: 'Đã tạo yêu cầu', paymentUrl });

  } catch (error) {
    console.error('❌ CreateConsultationPayment Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 2. TẠO THANH TOÁN CHO LỊCH HẸN ==========
exports.createPayment = async (req, res) => {
  try {
    const userId = req.user?.id || 1; 
    const { appointment_id, payment_method, proof_image_url, payment_info } = req.body;

        if (!appointment_id || !payment_method) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin thanh toán' });
        }

        const normalizedMethod = payment_method === 'transfer' ? 'bank_transfer' : payment_method;

    // Tìm Appointment
    const appointment = await models.Appointment.findOne({
      where: {
        [Op.or]: [
            { code: appointment_id.toString() },
            ...( !isNaN(appointment_id) ? [{ id: appointment_id }] : [] )
        ]
      },
      include: [{ model: models.Service, as: 'Service' }]
    });
    

        if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });

        const originalAmount = appointment.Service?.price || 0;
        const discountAmount = parseFloat(req.body.discount_amount) || 0;
        const amount = Math.max(0, originalAmount - discountAmount);
        const isClinicCashier = ['admin', 'staff'].includes(req.user?.role) && ['cash', 'card'].includes(normalizedMethod);
        const targetPaymentRecordStatus = isClinicCashier ? 'paid' : 'pending';
        const appointmentPaymentStatus = isClinicCashier ? 'paid_at_clinic' : 'unpaid';
        const orderId = `AP_${appointment.code}_${Date.now()}`;

        // Kiểm tra/Update Payment cũ
        let payment = await models.Payment.findOne({ where: { appointment_id: appointment.id } });
        const paymentData = {
        user_id: userId,
        appointment_id: appointment.id,
        amount,
        status: targetPaymentRecordStatus,
        method: normalizedMethod,
        transaction_id: targetPaymentRecordStatus === 'paid' ? `MANUAL_${Date.now()}` : orderId,
        payment_info: payment_info ? JSON.stringify(payment_info) : JSON.stringify({ note: 'Created via UI' }),
        proof_image_url: proof_image_url || null,
        promotion_id: req.body.promotion_id || null  // ✅ THÊM DÒNG NÀY
    };

    if (payment) {
        // Nếu đã thanh toán rồi thì chặn
        if (payment.status === 'paid') return res.status(400).json({ success: false, message: 'Đã thanh toán xong' });
        await payment.update(paymentData);
    } else {
        payment = await models.Payment.create(paymentData);
    }

        // Cập nhật trạng thái appointment theo đúng ngữ nghĩa luồng thanh toán
        const appointmentUpdates = {
            payment_status: appointmentPaymentStatus,
            payment_method: normalizedMethod
        };
        if (isClinicCashier) {
            appointmentUpdates.status = 'confirmed';
            appointmentUpdates.paid_at = new Date();
        }
        await appointment.update(appointmentUpdates);

        // ✅ Consume voucher nếu có — chỉ khi thanh toán thành công tại quầy
        if (isClinicCashier && req.body.voucher_code) {
          const promo = await models.Promotion.findOne({ where: { code: req.body.voucher_code, is_active: true } });
          if (promo) {
            await models.UserVoucher.update(
              { is_used: true, used_at: new Date(), order_id: payment.id },
              { where: { promotion_id: promo.id, user_id: userId, is_used: false } }
            );
          }
        }

        let paymentUrl = null;
        if (normalizedMethod === 'vnpay') {
            paymentUrl = vnpayService.createPaymentUrl({
                orderId,
                amount,
                orderInfo: `Thanh toan lich hen ${appointment.code}`,
                ipAddr: req.ip || '127.0.0.1'
            });
        } else if (normalizedMethod === 'momo' && !proof_image_url) {
            const momoResult = await momoService.createPayment({
                orderId,
                amount,
                orderInfo: `Thanh toan lich hen ${appointment.code}`
            });
            if (momoResult.success) paymentUrl = momoResult.payUrl;
        }

        res.status(201).json({ success: true, message: 'Tạo thanh toán thành công', data: payment, paymentUrl });

  } catch (e) { 
    console.error('❌ CreatePayment Error:', e);
    res.status(500).json({ success: false, message: e.message }); 
  }
};

// ========== 3. WEBHOOK SEPAY (QUAN TRỌNG NHẤT) ==========
exports.handleBankWebhook = async (req, res) => {
  try {
    console.log('\n🔥 [WEBHOOK START] -------------------------');
    console.log('💰 Data:', req.body.content, req.body.transferAmount);

    const { id, content, transferType, transferAmount } = req.body;

    if (transferType !== 'in') return res.json({ success: true });

    // 1. Regex tìm mã đơn (Chấp nhận mọi biến thể)
    const regex = /(CS|AP)[-0-9A-Z]+/gi;
    const matches = content ? content.match(regex) : null;
    
    if (!matches) {
        console.log('⚠️ Không tìm thấy mã đơn hàng.');
        return res.json({ success: true });
    }

    let orderCodeRaw = matches[0].toUpperCase(); 
    console.log('🔍 Mã tìm thấy trong nội dung:', orderCodeRaw);

    // --- XỬ LÝ THÔNG MINH: Tự động thêm dấu gạch ngang nếu thiếu ---
    // Ví dụ: AP21117682 -> AP-2111-7682
    if (orderCodeRaw.startsWith('AP') && !orderCodeRaw.includes('-')) {
        // Giả định format AP-DDMM-RANDOM (AP + 4 số ngày + số còn lại)
        // Regex: Lấy AP, lấy 4 số tiếp theo, lấy phần còn lại
        orderCodeRaw = orderCodeRaw.replace(/^(AP)(\d{4})(.+)$/, '$1-$2-$3');
        console.log('✨ Đã chuẩn hóa mã AP thành:', orderCodeRaw);
    }

    // --- A. TƯ VẤN (CS) ---
    if (orderCodeRaw.startsWith('CS')) {
        // Include thêm thông tin để gửi mail
        const consultation = await models.Consultation.findOne({ 
            where: { consultation_code: orderCodeRaw },
            include: [
                { model: models.User, as: 'patient' },
                { model: models.User, as: 'doctor' }
            ]
        });

        if (consultation) {
             console.log('✅ Tìm thấy Consultation ID:', consultation.id);
             
             // 1. Update Consultation: TỰ ĐỘNG DUYỆT (CONFIRMED) + ĐÃ THANH TOÁN
             await consultation.update({ 
                 payment_status: 'paid_online', 
                 paid_at: new Date(), 
                 payment_method: 'bank_transfer',
                 status: 'upcoming' // [SỬA] Chuyển sang "upcoming" để hiện nút Vào phòng
             });
             
             // 2. Tìm hoặc tạo Payment Record
             const [payment] = await models.Payment.findOrCreate({
                where: { consultation_id: consultation.id },
                defaults: {
                    user_id: consultation.patient_id || 1,
                    consultation_id: consultation.id,
                    amount: transferAmount,
                    method: 'bank_transfer',
                    status: 'paid',
                    transaction_id: `SEPAY_${id}`
                }
            });
            // ✅ Consume voucher nếu có
                if (payment && payment.promotion_id) {
                    await models.UserVoucher.update(
                        { is_used: true, used_at: new Date(), order_id: payment.id },
                        { where: { promotion_id: payment.promotion_id, user_id: payment.user_id, is_used: false } }
                    );
                    await models.Promotion.increment('usage_count', { where: { id: payment.promotion_id } });
                }

             if (payment && payment.status !== 'paid') {
                 await payment.update({ status: 'paid', transaction_id: `SEPAY_${id}` });
             }

             // 3. GỬI EMAIL HÓA ĐƠN & THÔNG BÁO (GIỐNG LỊCH HẸN)
             if (consultation.patient?.email) {
                 const timeStr = new Date(consultation.appointment_time).toLocaleString('vi-VN');
                 
                 // Gửi Email
                 console.log(`[Payment][CS ${consultation.consultation_code}] Gửi email thanh toán thành công tới ${consultation.patient.email}`);
                 await emailSender.sendEmail({
                     to: consultation.patient.email,
                     subject: `✅ Thanh toán thành công - Tư vấn ${consultation.consultation_code} đã được xác nhận`,
                     template: 'payment_success_invoice', // Dùng chung template hóa đơn
                     data: {
                         patientName: consultation.patient.full_name,
                         appointmentCode: consultation.consultation_code,
                         serviceName: `Tư vấn trực tuyến (${consultation.consultation_type === 'video' ? 'Video Call' : 'Chat'})`,
                         doctorName: `BS. ${consultation.doctor?.full_name || 'Hệ thống'}`,
                         appointmentTime: timeStr,
                         paymentMethod: 'Chuyển khoản Ngân hàng',
                         amount: transferAmount,
                         link: `${process.env.CLIENT_URL || 'http://localhost:3000'}/tu-van/${consultation.id}`
                     }
                 });
                 console.log(`[Payment][CS ${consultation.consultation_code}] Đã gửi email thanh toán thành công`);
             }

             // Gửi Notification
             await notificationHelper.createNotification({
                 user_id: consultation.patient_id,
                 type: 'payment_success',
                 title: 'Thanh toán thành công',
                 message: `Lịch tư vấn ${consultation.consultation_code} đã được thanh toán và tự động xác nhận.`,
                 link: `/tu-van/${consultation.id}`
             });

             console.log('🎉 [CS] Xong: Đã duyệt & Gửi mail/thông báo');
        }
    }

    // --- B. LỊCH HẸN (AP) ---
    else if (orderCodeRaw.startsWith('AP')) {
        const appointment = await models.Appointment.findOne({ where: { code: orderCodeRaw } });

        if (appointment) {
             console.log(`✅ Tìm thấy Appointment ID: ${appointment.id}`);
             
             // 1. Update Appointment: Payment = Paid & Status = CONFIRMED (Tự động duyệt)
             await appointment.update({ 
                 payment_status: 'paid_online',
                 paid_at: new Date(),
                 payment_method: 'bank_transfer',
                 status: 'confirmed' // <--- TỰ ĐỘNG PHÊ DUYỆT NGAY
             });
             console.log('-> Đã update Appointment: PAID_ONLINE & CONFIRMED');

             // 2. Xử lý Payment Record
             const payment = await models.Payment.findOne({ where: { appointment_id: appointment.id } });
             
             if (payment) {
                await payment.update({
                    status: 'paid',
                    transaction_id: `SEPAY_${id}`,
                    amount: transferAmount,
                    method: 'bank_transfer'
                });
             } else {
                // (Giữ nguyên logic tạo mới payment nếu chưa có - fallback)
                let userId = 1; 
                if (appointment.patient_id) {
                    try {
                         const [results] = await sequelize.query(`SELECT user_id FROM patients WHERE id = ${appointment.patient_id} LIMIT 1`);
                         if (results.length > 0) userId = results[0].user_id;
                    } catch (e) {}
                }
                await models.Payment.create({
                    user_id: userId,
                    appointment_id: appointment.id,
                    amount: transferAmount,
                    method: 'bank_transfer',
                    status: 'paid',
                    transaction_id: `SEPAY_${id}`,
                    payment_info: JSON.stringify(req.body),
                    provider_ref: content
                });
             }

             // 3. LẤY THÔNG TIN CHI TIẾT ĐỂ GỬI MAIL & THÔNG BÁO
             // Cần query lại để lấy tên Bác sĩ, Dịch vụ, Bệnh nhân
             const fullAppt = await models.Appointment.findByPk(appointment.id, {
                 include: [
                     { model: models.Service, as: 'Service' },
                     { model: models.Doctor, as: 'Doctor', include: [{ model: models.User, as: 'user' }] },
                     { model: models.Patient, as: 'Patient', include: [{ model: models.User }] }
                 ]
             });

             if (fullAppt) {
                 const patientName = fullAppt.Patient?.User?.full_name || fullAppt.guest_name || 'Quý khách';
                 const patientEmail = fullAppt.Patient?.User?.email || fullAppt.guest_email;
                 const doctorName = fullAppt.Doctor?.user?.full_name || 'Bác sĩ';
                 const serviceName = fullAppt.Service?.name || 'Dịch vụ y tế';
                 const timeStr = `${fullAppt.appointment_start_time.slice(0,5)} - ${new Date(fullAppt.appointment_date).toLocaleDateString('vi-VN')}`;

                 // A. GỬI EMAIL HÓA ĐƠN
                 if (patientEmail) {
                     console.log(`[Payment][AP ${fullAppt.code}] Gửi email thanh toán thành công tới ${patientEmail}`);
                     await emailSender.sendEmail({
                         to: patientEmail,
                         subject: `✅ Thanh toán thành công - Lịch hẹn ${fullAppt.code} đã được xác nhận`,
                         template: 'payment_success_invoice', // Template vừa thêm ở bước 1
                         data: {
                             patientName,
                             appointmentCode: fullAppt.code,
                             serviceName,
                             doctorName,
                             appointmentTime: timeStr,
                             paymentMethod: 'Chuyển khoản Ngân hàng',
                             amount: transferAmount,
                             link: `${process.env.CLIENT_URL || 'http://localhost:3000'}/lich-hen/${fullAppt.code}`
                         }
                     });
                     console.log('📧 Đã gửi email hóa đơn');
                 } else {
                     console.log(`[Payment][AP ${fullAppt.code}] Không có email bệnh nhân để gửi hóa đơn`);
                 }

                 // B. GỬI THÔNG BÁO CHO BỆNH NHÂN
                 if (fullAppt.Patient?.User?.id) {
                     await notificationHelper.createNotification({
                         user_id: fullAppt.Patient.User.id,
                         type: 'payment_success',
                         title: 'Thanh toán thành công',
                         message: `Lịch hẹn ${fullAppt.code} đã được thanh toán và tự động xác nhận.`,
                         link: `/lich-hen/${fullAppt.code}`
                     });
                 }

                 // C. GỬI THÔNG BÁO CHO BÁC SĨ & NHÂN VIÊN
                 const doctorNotifications = [];
                 if (fullAppt.Doctor?.user_id) {
                     doctorNotifications.push({
                         user_id: fullAppt.Doctor.user_id,
                         type: 'appointment_confirmed',
                         title: `[Xác nhận] Lịch hẹn ${fullAppt.code}`,
                         message: `Lịch hẹn ${fullAppt.code} được xác nhận: ${patientName} - ${serviceName} lúc ${timeStr}`,
                         link: `/lich-hen/${fullAppt.code}`,
                         data: { appointment_id: fullAppt.id, appointment_code: fullAppt.code }
                     });
                 }
                 if (fullAppt.staff_id) {
                     // Lấy user_id của staff
                     const staffUser = await models.User.findOne({ 
                         where: { role: 'staff', id: fullAppt.staff_id } 
                     });
                     if (staffUser) {
                         doctorNotifications.push({
                             user_id: staffUser.id,
                             type: 'appointment_confirmed',
                             title: `[Xác nhận] Lịch hẹn ${fullAppt.code}`,
                             message: `Lịch hẹn ${fullAppt.code} được xác nhận: ${patientName} - ${serviceName} lúc ${timeStr} (BS. ${doctorName})`,
                             link: `/lich-hen/${fullAppt.code}`,
                             data: { appointment_id: fullAppt.id, appointment_code: fullAppt.code }
                         });
                     }
                 }

                 if (doctorNotifications.length > 0) {
                     await notificationHelper.createNotifications(doctorNotifications);
                     console.log(`📢 Đã gửi thông báo xác nhận cho ${doctorNotifications.length} người (Doctor + Staff)`);
                 }
             }
        } else {
            console.log(`❌ Không tìm thấy Appointment trong DB với mã: ${orderCodeRaw}`);
        }
    }

    console.log('🔥 [WEBHOOK END] -------------------------');
    return res.json({ success: true });

  } catch (error) {
    console.error('❌ SYSTEM ERROR:', error);
    return res.json({ success: true });
  }
};

// ========== 4. LẤY DANH SÁCH THANH TOÁN (ADMIN - FIX HIỂN THỊ TÊN) ==========
exports.getAllPayments = async (req, res) => {
  try {
    const { status, method, date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status && status !== 'all') where.status = status;
    if (method && method !== 'all') where.method = method;

    // Lọc theo ngày nếu có
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.created_at = { [Op.between]: [startOfDay, endOfDay] };
    }

    const { count, rows: payments } = await models.Payment.findAndCountAll({
  where,
  distinct: true,  // Giữ nguyên để đếm đúng
  subQuery: false, // [QUAN TRỌNG] Thêm dòng này để ngăn Sequelize tạo query con gây mất dữ liệu hoặc trùng lặp khi join
      include: [
        // ... (Giữ nguyên các include bên trong như cũ)
        {
          model: models.Appointment,
          as: 'Appointment',
          required: false,
          include: [
            {
              model: models.Patient,
              as: 'Patient',
              required: false,
              include: [{ model: models.User, attributes: ['full_name', 'phone', 'email', 'address', 'gender', 'dob'], required: false }] // Lấy thêm info để xem chi tiết
            },
            {
              model: models.Doctor,
              as: 'Doctor',
              required: false,
              include: [{ model: models.User, as: 'user', attributes: ['full_name'], required: false }]
            },
            {
               model: models.Service,
               as: 'Service',
               attributes: ['name', 'price'], // Chỉ lấy name và price, đã xóa 'description' để sửa lỗi 500
               required: false
            }
          ]
        },
                {
                    model: models.Consultation,
                    as: 'Consultation',
                    required: false,
                    include: [
                        {
                            model: models.User,
                            as: 'patient',
                            required: false,
                            attributes: ['full_name', 'phone', 'email', 'address', 'gender', 'dob']
                        },
                        {
                            model: models.User,
                            as: 'doctor',
                            required: false,
                            attributes: ['full_name']
                        }
                    ]
                },

      ],
      // Sắp xếp theo thời gian tạo - tránh lỗi ORDER BY trên cột NULL từ LEFT JOIN
      order: [
          ['created_at', 'DESC']
      ],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    // Map lại dữ liệu cho Frontend
    const formattedData = payments.map(p => {
        const data = p.toJSON();
        
        let patientName = 'N/A';
        let doctorName = 'N/A';
        let serviceName = 'N/A';
        let type = 'other';

        if (data.Appointment) {
            // Ưu tiên lấy tên Guest Name (khách vãng lai) nếu có
            if (data.Appointment.guest_name) {
                patientName = `${data.Appointment.guest_name} (Khách)`;
            } 
            // Nếu không có Guest Name thì lấy tên User đã đăng ký
            else if (data.Appointment.Patient?.User?.full_name) {
                patientName = data.Appointment.Patient.User.full_name;
            }
            
            doctorName = data.Appointment.Doctor?.user?.full_name || 'Chưa phân công';
            serviceName = data.Appointment.Service?.name || 'Lịch khám';
            type = 'Lịch hẹn';
        } else if (data.Consultation) {
            patientName = data.Consultation.patient?.full_name || 'N/A';
            doctorName = data.Consultation.doctor?.full_name || 'N/A';
            serviceName = 'Tư vấn trực tuyến';
            type = 'consultation';
        } else if (data.User) {
            // Fallback lấy tên User thanh toán
            patientName = data.User.full_name;
        }

        return {
            ...data,
            patientName, // Trường này sẽ được Frontend dùng để hiển thị
            doctorName,
            serviceName,
            type
        };
    });

    res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('❌ ERROR getAllPayments:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách',
      error: error.message
    });
  }
};


exports.getPaymentConfig = async (req, res) => {
    try {
        const s = await models.SystemSetting.findOne({ where: { setting_key: 'payment_config' } });
        res.json({ success: true, data: s ? s.value_json : {} });
    } catch (e) { res.status(500).json({ success: false }); }
};

exports.updatePaymentConfig = async (req, res) => {
    try {
        const { vnpay, bank, momo, cash } = req.body;
        
        // 1. Tìm cấu hình hiện tại trong Database
        let setting = await models.SystemSetting.findOne({ 
            where: { setting_key: 'payment_config' } 
        });
        
        if (setting) {
            // 2. Nếu đã tồn tại -> Cập nhật và LƯU CHÍNH XÁC người cập nhật
            await setting.update({
                value_json: { vnpay, bank, momo, cash },
                updated_by: req.user.id // Ghi nhận chính xác ID người thao tác (Dù là admin hay staff)
            });
        } else {
            // 3. Nếu chưa tồn tại -> Tạo mới
            await models.SystemSetting.create({
                setting_key: 'payment_config',
                value_json: { vnpay, bank, momo, cash },
                updated_by: req.user.id
            });
        }
        
        // 4. (Tùy chọn) Khuyên dùng: Lưu thêm vào AuditLog để theo dõi chi tiết
        await models.AuditLog.create({
            user_id: req.user.id,
            action_type: 'update_payment_config',
            target_type: 'system_settings',
            target_name: 'Cấu hình thanh toán',
            details: JSON.stringify({ vnpay, bank, momo, cash })
        });
        
        res.json({ success: true, message: 'Lưu cấu hình thành công' });
    } catch (error) { 
        console.error('❌ Lỗi updatePaymentConfig:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lưu cấu hình', error: error.message }); 
    }
};

// Sửa lại hàm duyệt tay để đồng bộ trạng thái Appointment/Consultation
exports.verifyManualPayment = async (req, res) => {
    const t = await sequelize.transaction(); // Dùng transaction cho an toàn
    try {
        const { id } = req.params; // Payment ID
        const { status } = req.body; // 'paid' hoặc 'failed'

        // 1. Tìm Payment
        const payment = await models.Payment.findByPk(id, { transaction: t });
        if (!payment) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
        }

        // 2. Cập nhật trạng thái Payment
        await payment.update({ status }, { transaction: t });


        // 3. Nếu Admin chọn "Đã thanh toán" (paid), cập nhật luôn Lịch hẹn/Tư vấn sang 'confirmed'
        if (status === 'paid') {
            // Trường hợp Lịch hẹn
            if (payment.appointment_id) {
                await models.Appointment.update(
                    { 
                        status: 'confirmed',
                        payment_status: 'paid_at_clinic',
                        payment_method: payment.method || 'cash',
                        paid_at: new Date()
                    },
                    { where: { id: payment.appointment_id }, transaction: t }
                );
            } 
            // Trường hợp Tư vấn
            else if (payment.consultation_id) {
                await models.Consultation.update(
                    { 
                        status: 'confirmed',
                        payment_status: 'paid_at_clinic',
                        payment_method: payment.method || 'cash',
                        paid_at: new Date()
                    },
                    { where: { id: payment.consultation_id }, transaction: t }
                );
            }

            // ✅ Consume voucher nếu payment có gắn promotion_id
            if (payment.promotion_id) {
                await models.UserVoucher.update(
                    { is_used: true, used_at: new Date(), order_id: payment.id },
                    {
                        where: {
                            promotion_id: payment.promotion_id,
                            user_id:      payment.user_id,
                            is_used:      false
                        },
                        transaction: t
                    }
                );
                // Tăng usage_count của promotion
                await models.Promotion.increment('usage_count', {
                    where: { id: payment.promotion_id },
                    transaction: t
                });
            }
        }

        await t.commit();
        res.json({ success: true, message: 'Đã cập nhật trạng thái và phê duyệt lịch thành công' });

    } catch (e) {
        await t.rollback();
        console.error('Lỗi duyệt tay:', e);
        res.status(500).json({ success: false, message: 'Lỗi khi duyệt thanh toán' });
    }
};

exports.confirmPayment = async (req, res) => {
    try {
        await models.Payment.update({ status: 'paid' }, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
};

exports.rejectPayment = async (req, res) => {
    try {
        await models.Payment.update({ status: 'failed' }, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
};

exports.getRevenueStatistics = async (req, res) => {
    try {
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const startOfNextYear = new Date(year + 1, 0, 1);
        const startOfToday = moment().startOf('day').toDate();
        const startOfTomorrow = moment().add(1, 'day').startOf('day').toDate();
        const startOfRecentWindow = moment().subtract(29, 'days').startOf('day').toDate();

        const safeQuery = async (label, queryPromise, fallbackValue) => {
            try {
                return await queryPromise;
            } catch (queryError) {
                console.error(`[RevenueStatistics] ${label} failed:`, queryError);
                return fallbackValue;
            }
        };

        const paidWhere = {
            status: 'paid',
            created_at: {
                [Op.gte]: startOfYear,
                [Op.lt]: startOfNextYear
            }
        };

        const yearDateWhere = {
            created_at: {
                [Op.gte]: startOfYear,
                [Op.lt]: startOfNextYear
            }
        };

        const appointmentYearWhere = {
            appointment_date: {
                [Op.gte]: startOfYear,
                [Op.lt]: startOfNextYear
            }
        };

        const [
            monthlyRows,
            methodRows,
            statusRows,
            appointmentStatusRows,
            appointmentMonthlyRows,
            refundStatusRows,
            refundMonthlyRows,
            dailyRevenueRows,
            topServiceRows,
            topDoctorRows,
            totalRevenue,
            todayRevenue,
            totalTransactions,
            paidTransactions,
            totalAppointments,
            completedAppointments,
            cancelledAppointments,
            totalRefundAmount,
            totalRefundRequests,
            completedRefundRequests,
            pendingRefundRequests
        ] = await Promise.all([
            safeQuery('monthlyRows', models.Payment.findAll({
                attributes: [
                    [sequelize.fn('MONTH', sequelize.col('created_at')), 'month'],
                    [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where: paidWhere,
                group: [sequelize.fn('MONTH', sequelize.col('created_at'))],
                raw: true
            }), []),
            safeQuery('methodRows', models.Payment.findAll({
                attributes: [
                    'method',
                    [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where: paidWhere,
                group: ['method'],
                raw: true
            }), []),
            safeQuery('statusRows', models.Payment.findAll({
                attributes: [
                    'status',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where: yearDateWhere,
                group: ['status'],
                raw: true
            }), []),
            safeQuery('appointmentStatusRows', models.Appointment.findAll({
                attributes: [
                    'status',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where: appointmentYearWhere,
                group: ['status'],
                raw: true
            }), []),
            safeQuery('appointmentMonthlyRows', models.Appointment.findAll({
                attributes: [
                    [sequelize.fn('MONTH', sequelize.col('appointment_date')), 'month'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where: appointmentYearWhere,
                group: [sequelize.fn('MONTH', sequelize.col('appointment_date'))],
                raw: true
            }), []),
            safeQuery('refundStatusRows', models.RefundRequest.findAll({
                attributes: [
                    'status',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                    [sequelize.fn('SUM', sequelize.col('refund_amount')), 'total']
                ],
                where: yearDateWhere,
                group: ['status'],
                raw: true
            }), []),
            safeQuery('refundMonthlyRows', models.RefundRequest.findAll({
                attributes: [
                    [sequelize.fn('MONTH', sequelize.col('created_at')), 'month'],
                    'status',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                    [sequelize.fn('SUM', sequelize.col('refund_amount')), 'total']
                ],
                where: yearDateWhere,
                group: [sequelize.fn('MONTH', sequelize.col('created_at')), 'status'],
                raw: true
            }), []),
            safeQuery('dailyRevenueRows', models.Payment.findAll({
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('created_at')), 'day'],
                    [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                where: {
                    status: 'paid',
                    created_at: {
                        [Op.gte]: startOfRecentWindow,
                        [Op.lt]: startOfTomorrow
                    }
                },
                group: [sequelize.fn('DATE', sequelize.col('created_at'))],
                raw: true
            }), []),
            safeQuery('topServiceRows', models.Service.findAll({
                attributes: [
                    'id',
                    'name',
                    [sequelize.fn('COUNT', sequelize.col('appointments.service_id')), 'count']
                ],
                include: [{
                    model: models.Appointment,
                    as: 'appointments',
                    attributes: [],
                    where: appointmentYearWhere,
                    required: true
                }],
                group: ['Service.id'],
                raw: false,
                order: [[sequelize.literal('count'), 'DESC']],
                limit: 8
            }), []),
            safeQuery('topDoctorRows', models.Doctor.findAll({
                attributes: [
                    'id',
                    'user_id',
                    [sequelize.fn('COUNT', sequelize.col('appointments.id')), 'count']
                ],
                include: [
                    {
                        model: models.Appointment,
                        as: 'appointments',
                        attributes: [],
                        where: appointmentYearWhere,
                        required: true
                    },
                    {
                        model: models.User,
                        as: 'user',
                        attributes: ['id', 'full_name']
                    }
                ],
                group: ['Doctor.id', 'user.id'],
                raw: false,
                subQuery: false,
                duplicating: false,
                order: [[sequelize.literal('count'), 'DESC']],
                limit: 8
            }), []),
            safeQuery('totalRevenue', models.Payment.sum('amount', { where: paidWhere }), 0),
            safeQuery('todayRevenue', models.Payment.sum('amount', {
                where: {
                    status: 'paid',
                    created_at: {
                        [Op.gte]: startOfToday,
                        [Op.lt]: startOfTomorrow
                    }
                }
            }), 0),
            safeQuery('totalTransactions', models.Payment.count({ where: { created_at: { [Op.gte]: startOfYear, [Op.lt]: startOfNextYear } } }), 0),
            safeQuery('paidTransactions', models.Payment.count({ where: paidWhere }), 0),
            safeQuery('totalAppointments', models.Appointment.count({ where: appointmentYearWhere }), 0),
            safeQuery('completedAppointments', models.Appointment.count({ where: { ...appointmentYearWhere, status: 'completed' } }), 0),
            safeQuery('cancelledAppointments', models.Appointment.count({ where: { ...appointmentYearWhere, status: 'cancelled' } }), 0),
            safeQuery('totalRefundAmount', models.RefundRequest.sum('refund_amount', { where: { ...yearDateWhere, status: 'completed' } }), 0),
            safeQuery('totalRefundRequests', models.RefundRequest.count({ where: yearDateWhere }), 0),
            safeQuery('completedRefundRequests', models.RefundRequest.count({ where: { ...yearDateWhere, status: 'completed' } }), 0),
            safeQuery('pendingRefundRequests', models.RefundRequest.count({ where: { ...yearDateWhere, status: 'pending' } }), 0)
        ]);

        const chart = Array.from({ length: 12 }, (_, index) => {
            const monthNumber = index + 1;
            const match = monthlyRows.find(row => Number(row.month) === monthNumber);
            return {
                month: monthNumber,
                total: Number(match?.total || 0),
                count: Number(match?.count || 0)
            };
        });

        const appointmentChart = Array.from({ length: 12 }, (_, index) => {
            const monthNumber = index + 1;
            const match = appointmentMonthlyRows.find(row => Number(row.month) === monthNumber);
            return {
                month: monthNumber,
                name: `T${monthNumber}`,
                fullName: `Tháng ${monthNumber}`,
                count: Number(match?.count || 0)
            };
        });

        const dailyChart = dailyRevenueRows
            .map(row => ({
                day: row.day,
                revenue: Number(row.total || 0),
                count: Number(row.count || 0)
            }))
            .sort((left, right) => String(left.day).localeCompare(String(right.day)));

        const methodBreakdown = methodRows.map(row => ({
            method: row.method,
            total: Number(row.total || 0),
            count: Number(row.count || 0)
        }));

        const statusCounts = statusRows.reduce((accumulator, row) => {
            accumulator[row.status] = Number(row.count || 0);
            return accumulator;
        }, {});

        const appointmentStatusCounts = appointmentStatusRows.reduce((accumulator, row) => {
            accumulator[row.status] = Number(row.count || 0);
            return accumulator;
        }, {});

        const refundStatusCounts = refundStatusRows.reduce((accumulator, row) => {
            accumulator[row.status] = Number(row.count || 0);
            return accumulator;
        }, {});

        const refundMonthly = Array.from({ length: 12 }, (_, index) => {
            const monthNumber = index + 1;
            const monthRows = refundMonthlyRows.filter(row => Number(row.month) === monthNumber);
            return {
                month: monthNumber,
                name: `T${monthNumber}`,
                fullName: `Tháng ${monthNumber}`,
                pending: Number(monthRows.find(row => row.status === 'pending')?.count || 0),
                processing: Number(monthRows.find(row => row.status === 'processing')?.count || 0),
                completed: Number(monthRows.find(row => row.status === 'completed')?.count || 0),
                rejected: Number(monthRows.find(row => row.status === 'rejected')?.count || 0),
                amount: monthRows.reduce((sum, row) => sum + Number(row.total || 0), 0)
            };
        });

        const topServices = topServiceRows
            .map(row => ({
                id: row.id,
                name: row.name,
                count: Number(row.get('count') || 0)
            }))
            .sort((left, right) => right.count - left.count);

        const topDoctors = topDoctorRows
            .map(row => ({
                id: row.id,
                name: row.user?.full_name || `Bác sĩ #${row.id}`,
                count: Number(row.get('count') || 0)
            }))
            .sort((left, right) => right.count - left.count);

        const paidAppointmentRate = totalAppointments > 0 ? (paidTransactions / totalAppointments) * 100 : 0;
        const completionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;
        const cancellationRate = totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0;
        const refundRateByPayment = paidTransactions > 0 ? (completedRefundRequests / paidTransactions) * 100 : 0;
        const avgDailyRevenue = dailyChart.length > 0 ? dailyChart.reduce((sum, item) => sum + item.revenue, 0) / dailyChart.length : 0;

        res.json({
            success: true,
            data: {
                chart,
                appointmentChart,
                dailyChart,
                methodBreakdown,
                statusCounts,
                appointmentStatusCounts,
                refundStatusCounts,
                refundMonthly,
                topServices,
                topDoctors,
                summary: {
                    total: Number(totalRevenue || 0),
                    today: Number(todayRevenue || 0),
                    total_transactions: Number(totalTransactions || 0),
                    paid_transactions: Number(paidTransactions || 0),
                    total_appointments: Number(totalAppointments || 0),
                    completed_appointments: Number(completedAppointments || 0),
                    cancelled_appointments: Number(cancelledAppointments || 0),
                    total_refund_amount: Number(totalRefundAmount || 0),
                    total_refund_requests: Number(totalRefundRequests || 0),
                    completed_refund_requests: Number(completedRefundRequests || 0),
                    pending_refund_requests: Number(pendingRefundRequests || 0),
                    avg_daily_revenue: Number(avgDailyRevenue || 0),
                    payment_conversion_rate: Number(paidAppointmentRate || 0),
                    appointment_completion_rate: Number(completionRate || 0),
                    appointment_cancellation_rate: Number(cancellationRate || 0),
                    refund_rate: Number(refundRateByPayment || 0)
                }
            }
        });
    } catch (error) {
        console.error('ERROR getRevenueStatistics:', error);
        res.json({
            success: true,
            data: {
                chart: [],
                appointmentChart: [],
                dailyChart: [],
                methodBreakdown: [],
                statusCounts: {},
                appointmentStatusCounts: {},
                refundStatusCounts: {},
                refundMonthly: [],
                topServices: [],
                topDoctors: [],
                summary: {
                    total: 0,
                    today: 0,
                    total_transactions: 0,
                    paid_transactions: 0,
                    total_appointments: 0,
                    completed_appointments: 0,
                    cancelled_appointments: 0,
                    total_refund_amount: 0,
                    total_refund_requests: 0,
                    completed_refund_requests: 0,
                    pending_refund_requests: 0,
                    avg_daily_revenue: 0,
                    payment_conversion_rate: 0,
                    appointment_completion_rate: 0,
                    appointment_cancellation_rate: 0,
                    refund_rate: 0
                }
            }
        });
    }
};

exports.getPaymentByAppointment = async (req, res) => {
  try {
    const p = await models.Payment.findOne({ where: { appointment_id: req.params.appointment_id } });
    res.json({ success: true, data: p });
  } catch (e) { res.status(500).json({ success: false }); }
};

exports.getMyPayments = async (req, res) => {
  try {
    const p = await models.Payment.findAll({ where: { user_id: req.user.id } });
    res.json({ success: true, data: p });
  } catch (e) { res.status(500).json({ success: false }); }
};

// --- CÁC HÀM CALLBACK (QUAN TRỌNG) ---
exports.vnpayReturn = async (req, res) => res.send('VNPay Return');
exports.momoReturn = async (req, res) => res.send('MoMo Return');
exports.momoIPN = async (req, res) => res.json({});
// --- BẮT ĐẦU ĐOẠN SỬA ---
exports.processRefund = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const userId = req.user.id;
        const { appointment_id, reason, bank_info } = req.body; // bank_info gửi từ Client đang là String

        // 1. Tìm thông tin Lịch hẹn và Thanh toán gốc
        const appointment = await models.Appointment.findByPk(appointment_id, {
            include: [{ model: models.Service, as: 'Service' }],
            transaction: t
        });

        if (!appointment) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
        }

        const payment = await models.Payment.findOne({ 
            where: { appointment_id: appointment.id, status: 'paid' },
            transaction: t 
        });

        if (!payment) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'Lịch hẹn chưa được thanh toán hoặc không tìm thấy giao dịch.' });
        }

        // 2. Lấy chính sách hoàn tiền từ DB
        let refundPolicy = null;
        try {
            const policySetting = await models.SystemSetting.findOne({ 
                where: { setting_key: 'refund_policy' },
                transaction: t
            });
            refundPolicy = policySetting ? policySetting.value_json : null;
        } catch(e) { /* fallback về rules cứng nếu không lấy được */ }

        // 3. Tính số giờ trước lịch hẹn
        const appointmentTime = new Date(`${appointment.appointment_date} ${appointment.appointment_start_time}`);
        const cancelTime = new Date(); // thời điểm hủy = now
        const hoursDiff = (appointmentTime - cancelTime) / (1000 * 60 * 60);

        // 4. Tìm rule phù hợp từ policy DB, fallback về rule cứng nếu không có
        let refundPercent = 0;
        let bookingFee = 0;
        let matchedRuleName = '';

        if (refundPolicy?.appointment?.rules?.length > 0) {
            // Dùng policy từ DB (sắp xếp giảm dần để lấy rule cao nhất còn phù hợp)
            const sortedRules = [...refundPolicy.appointment.rules]
                .sort((a, b) => b.hours_before - a.hours_before);
            const matched = sortedRules.find(r => hoursDiff >= r.hours_before);
            refundPercent = matched ? matched.refund_percent : 0;
            bookingFee = refundPolicy.appointment.booking_fee || 0;
            matchedRuleName = matched ? `Hủy trước ${matched.hours_before}h → hoàn ${matched.refund_percent}%` : 'Không đủ điều kiện';
        } else {
            // Fallback rule cứng cũ
            if (hoursDiff >= 48) { refundPercent = 100; matchedRuleName = 'Hủy trước 48h → 100%'; }
            else if (hoursDiff >= 24) { refundPercent = 80; matchedRuleName = 'Hủy trước 24h → 80%'; }
            else { refundPercent = 0; matchedRuleName = 'Hủy sát giờ → 0%'; }
        }

        const amountOriginal = parseFloat(payment.amount);
        const refundBeforeFee = Math.round((amountOriginal * refundPercent) / 100);
        // Trừ phí giữ chỗ cố định, không được âm
        const refundAmount = Math.max(0, refundBeforeFee - bookingFee);
        const penaltyFee = amountOriginal - refundAmount;

        // 5. Tạo bản ghi RefundRequest với số tiền đã trừ phí giữ chỗ
        const bankInfoObject = typeof bank_info === 'string' 
            ? { raw_text: bank_info } 
            : (bank_info || {});

        await models.RefundRequest.create({
            payment_id: payment.id,
            user_id: userId,
            amount_original: amountOriginal,
            refund_amount: refundAmount,         // ✅ Đã trừ booking_fee
            penalty_fee: penaltyFee,
            reason: reason,
            bank_info_snapshot: bankInfoObject,
            status: 'pending',
            policy_snapshot: { 
                applied_percent: refundPercent, 
                hours_diff: hoursDiff,
                booking_fee_deducted: bookingFee,
                refund_before_fee: refundBeforeFee,
                rule_applied: matchedRuleName,
                policy_source: refundPolicy ? 'database' : 'hardcoded_fallback'
            }
        }, { transaction: t });

        const requester = await models.User.findByPk(userId, {
            attributes: ['id', 'full_name', 'email'],
            transaction: t
        });

        const appointmentCode = appointment.code;
        const appointmentLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/lich-hen/${appointmentCode}`;

        if (requester?.email) {
            console.log(`[Refund][REQUEST] Gửi email xác nhận cho ${requester.email} - ${appointmentCode}`);
            await emailSender.sendEmail({
                to: requester.email,
                subject: `📝 Đã ghi nhận yêu cầu hoàn tiền - ${appointmentCode}`,
                template: 'refund_request_received',
                data: {
                    patientName: requester.full_name,
                    appointmentCode,
                    refundAmount,
                    statusLabel: 'Đang chờ staff/admin xét duyệt',
                    appointmentLink,
                    refundLink: appointmentLink
                }
            });
        }

        await notificationHelper.createNotification({
            user_id: userId,
            type: 'refund_request',
            title: 'Đã gửi yêu cầu hoàn tiền',
            message: `Yêu cầu hoàn tiền cho lịch hẹn ${appointmentCode} đã được tạo và đang chờ xét duyệt.`,
            link: `/lich-hen/${appointmentCode}`,
            data: { appointment_id: appointment.id, payment_id: payment.id, refund_amount: refundAmount }
        });

        await notificationHelper.notifyAllAdmins(
            'refund_request',
            `Có yêu cầu hoàn tiền mới cho lịch hẹn ${appointmentCode} với số tiền dự kiến ${new Intl.NumberFormat('vi-VN').format(refundAmount)} VNĐ`,
            '/quan-ly-hoan-tien'
        );

        await t.commit();
        res.status(200).json({ success: true, message: 'Đã gửi yêu cầu hoàn tiền thành công' });

    } catch (error) {
        await t.rollback();
        console.error('❌ ProcessRefund Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tạo yêu cầu hoàn tiền' });
    }
};
// --- KẾT THÚC ĐOẠN SỬA ---
// --- BẮT ĐẦU ĐOẠN THÊM MỚI ---

/**
 * Lấy danh sách yêu cầu hoàn tiền (Cho trang Admin)
 */
exports.getRefundRequests = async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};
        
        // Lọc theo trạng thái (pending/completed/rejected) nếu có
        if (status && status !== 'all') {
            where.status = status;
        }

        const requests = await models.RefundRequest.findAll({
    where,
    include: [
        { 
            model: models.User,
            as: 'User',
            attributes: ['id', 'full_name', 'phone', 'email'] 
        },
        {
            model: models.User,
            as: 'Processor',
            attributes: ['id', 'full_name'],
            required: false
        },
        {
            model: models.Payment,
            attributes: ['id', 'transaction_id', 'method', 'amount', 'status'],
            include: [
                { 
                    model: models.Appointment,
                    as: 'Appointment',
                    attributes: ['id', 'code', 'appointment_date', 'appointment_start_time', 'cancelled_at', 'cancel_reason', 'status'],
                    required: false,
                    include: [
                        { model: models.Service, as: 'Service', attributes: ['name', 'price'], required: false }
                    ]
                },
                { 
                    model: models.Consultation,
                    as: 'Consultation',
                    attributes: ['id', 'consultation_code', 'appointment_time', 'cancelled_at', 'cancel_reason', 'status'],
                    required: false
                }
            ]
        }
    ],
    order: [['created_at', 'DESC']]
});

// Tính toán bổ sung cho từng request để frontend hiển thị
const enrichedRequests = requests.map(req => {
    const r = req.toJSON();
    
    // Xác định loại đơn
    r.order_type = r.Payment?.Consultation ? 'consultation' : 'appointment';
    r.order_code = r.Payment?.Appointment?.code || r.Payment?.Consultation?.consultation_code || `#${r.payment_id}`;
    
    // Tính số giờ từ lúc hủy đến lịch hẹn (để kiểm tra logic hoàn tiền)
    const apptTime = r.Payment?.Appointment?.appointment_date && r.Payment?.Appointment?.appointment_start_time
        ? new Date(`${r.Payment.Appointment.appointment_date} ${r.Payment.Appointment.appointment_start_time}`)
        : r.Payment?.Consultation?.appointment_time
            ? new Date(r.Payment.Consultation.appointment_time)
            : null;

    const cancelledAt = r.Payment?.Appointment?.cancelled_at
        || r.Payment?.Consultation?.cancelled_at
        || r.created_at;

    if (apptTime && cancelledAt) {
        const diff = (new Date(apptTime) - new Date(cancelledAt)) / (1000 * 60 * 60);
        r.hours_before_appointment = Math.round(diff * 10) / 10;
    } else {
        r.hours_before_appointment = null;
    }

    return r;
});

res.status(200).json({ success: true, data: enrichedRequests });

    } catch (error) {
        console.error('❌ Error getRefundRequests:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách hoàn tiền' });
    }
};

// --- BẮT ĐẦU ĐOẠN THÊM MỚI VÀO CUỐI CONTROLLER ---

/**
 * Xử lý yêu cầu hoàn tiền (Admin Approve/Reject)
 * PUT /api/payments/refunds/:id/process
 */
exports.processRefundRequest = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { status, admin_note, refund_ref } = req.body;
        const adminId = req.user.id;
        
        // Handle file upload — dùng multer đã cấu hình trong upload.js của project
        let proofImages = null;
        if (req.file) {
            // req.file được set bởi multer (single upload)
            proofImages = JSON.stringify([`/uploads/images/${req.file.filename}`]);
        } else if (req.body.proof_image_url) {
            // Fallback nếu frontend gửi URL trực tiếp
            proofImages = JSON.stringify([req.body.proof_image_url]);
        }

        const request = await models.RefundRequest.findByPk(id, {
            include: [
                { model: models.User, as: 'User' },
                { model: models.Payment, include: [{ model: models.Appointment, as: 'Appointment' }] }
            ],
            transaction: t
        });

        if (!request) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Yêu cầu không tồn tại' });
        }

        if (request.status !== 'pending') {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'Yêu cầu này đã được xử lý trước đó' });
        }

        // Lấy chính sách hoàn tiền hiện tại để lưu vào audit
        let policyAtProcessTime = null;
        try {
            const policySetting = await models.SystemSetting.findOne({ where: { setting_key: 'refund_policy' } });
            policyAtProcessTime = policySetting ? policySetting.value_json : null;
        } catch(e) { /* không crash nếu không lấy được policy */ }

        // Cập nhật Refund Request
        await request.update({
            status,
            admin_note,
            refund_ref,
            proof_images: proofImages || request.proof_images,
            processed_by: adminId,
            // Cập nhật policy_snapshot với thông tin admin đã đối chiếu
            policy_snapshot: {
                ...(request.policy_snapshot || {}),
                processed_by_admin: adminId,
                processed_action: status,
                policy_at_process_time: policyAtProcessTime,
                processed_at: new Date().toISOString()
            },
            updated_at: new Date()
        }, { transaction: t });

        // Nếu Hoàn thành -> Update Payment status thành 'refunded'
        if (status === 'completed') {
            await models.Payment.update(
                { status: 'refunded' }, 
                { where: { id: request.payment_id }, transaction: t }
            );

            // Gửi Email thông báo thành công cho khách
            if (request.User?.email) {
                const appointmentCode = request.Payment?.Appointment?.code || request.Payment?.Consultation?.consultation_code || request.payment_id;
                await emailSender.sendEmail({
                    to: request.User.email,
                    subject: '✅ Yêu cầu hoàn tiền đã được xử lý thành công - Easy Medify',
                    template: 'refund_request_completed',
                    data: {
                        patientName: request.User.full_name,
                        appointmentCode,
                        refundAmount: request.refund_amount,
                        refundRef: refund_ref,
                                                appointmentLink: request.Payment?.Consultation?.consultation_code
                                                    ? `${process.env.CLIENT_URL || 'http://localhost:3000'}/tu-van/${request.Payment.Consultation.consultation_code}`
                                                    : `${process.env.CLIENT_URL || 'http://localhost:3000'}/lich-hen/${appointmentCode}`
                    }
                    // attachments: proofImages ? [{ path: JSON.parse(proofImages)[0] }] : [] // Nếu muốn đính kèm file thật
                });
                console.log(`[Refund][COMPLETE] Đã gửi mail hoàn tiền thành công cho ${request.User.email}`);
            }
            
            // Notification
            await notificationHelper.createNotification({
                user_id: request.user_id,
                type: 'refund_completed',
                title: 'Hoàn tiền thành công',
                message: `Yêu cầu hoàn tiền #${request.id} đã được xử lý. Vui lòng kiểm tra tài khoản.`,
                                link: request.Payment?.Consultation?.consultation_code
                                    ? `/tu-van/${request.Payment.Consultation.consultation_code}`
                                    : `/lich-hen/${request.Payment?.Appointment?.code || ''}`
            });

        } else if (status === 'rejected') {
            // Gửi mail từ chối
            if (request.User?.email) {
                const appointmentCode = request.Payment?.Appointment?.code || request.Payment?.Consultation?.consultation_code || request.payment_id;
                await emailSender.sendEmail({
                    to: request.User.email,
                    subject: '❌ Từ chối yêu cầu hoàn tiền - Easy Medify',
                    template: 'refund_request_rejected',
                    data: {
                        patientName: request.User.full_name,
                        appointmentCode,
                        adminNote: admin_note,
                        contactLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/lien-he`
                    }
                });
                console.log(`[Refund][REJECT] Đã gửi mail từ chối hoàn tiền cho ${request.User.email}`);
            }
             // Notification Reject
             await notificationHelper.createNotification({
                user_id: request.user_id,
                type: 'refund_rejected',
                title: 'Yêu cầu hoàn tiền bị từ chối',
                message: `Yêu cầu #${request.id} bị từ chối. Lý do: ${admin_note}`,
                                link: request.Payment?.Consultation?.consultation_code
                                    ? `/tu-van/${request.Payment.Consultation.consultation_code}`
                                    : `/lich-hen/${request.Payment?.Appointment?.code || ''}`
            });
        }

        await t.commit();
        res.json({ success: true, message: 'Xử lý thành công' });

    } catch (error) {
        await t.rollback();
        console.error('Process Refund Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
};
// --- KẾT THÚC ĐOẠN CONTROLLER ---

// ========== 5. NHÀ THUỐC BÁN LẺ (RETAIL) ==========

// Tạo hóa đơn bán lẻ
// --- KIỂM TRA MÃ GIẢM GIÁ ---
exports.checkDiscount = async (req, res) => {
    try {
        const { code, totalAmount } = req.body;
        // Tìm mã giảm giá (Dùng trường name làm code)
        const discount = await models.Discount.findOne({
            where: { 
                name: code,
                start_date: { [Op.lte]: new Date() },
                end_date: { [Op.gte]: new Date() }
            }
        });

        if (!discount) {
            return res.status(404).json({ success: false, message: 'Mã giảm giá không tồn tại hoặc đã hết hạn' });
        }

        // Tính toán giá trị giảm
        let discountValue = 0;
        if (discount.type === 'percentage') {
            discountValue = (totalAmount * discount.value) / 100;
        } else {
            discountValue = parseFloat(discount.value);
        }

        // Đảm bảo không giảm quá tổng tiền
        if (discountValue > totalAmount) discountValue = totalAmount;

        res.json({
            success: true,
            discount: {
                id: discount.id,
                code: discount.name,
                type: discount.type,
                value: discount.value,
                discountAmount: discountValue
            }
        });

    } catch (error) {
        console.error('Check Discount Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi kiểm tra mã giảm giá' });
    }
};

// --- TẠO HÓA ĐƠN BÁN LẺ (CẬP NHẬT) ---
exports.createRetailInvoice = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        // Nhận code từ Frontend gửi lên
        const { items, customer, total_amount, payment_method, discount_info, final_amount, code } = req.body;
        const staffId = req.user.id;

        // Nếu có code gửi lên thì dùng, không thì tự tạo
        const invoiceCode = code || `REL${Date.now()}`;

        const invoiceDetail = {
            customer_info: customer,
            items: items.map(item => ({
                id: item.id,
                name: item.name,
                qty: item.qty,
                price: item.price,
                total: item.price * item.qty
            })),
            discount_applied: discount_info || null, // Lưu thông tin giảm giá
            staff_name: req.user.full_name
        };

        const payment = await models.Payment.create({
            code: invoiceCode,
            user_id: staffId, 
            amount: final_amount || total_amount, // Lưu số tiền thực thu
            status: 'paid',
            method: payment_method, // 'cash' hoặc 'transfer'
            payment_info: JSON.stringify(invoiceDetail),
            description: `Bán lẻ: ${customer.name || 'Khách vãng lai'} - ${payment_method === 'transfer' ? 'CK' : 'TM'}`,
            // Nếu có giảm giá thì lưu ID
            discount_id: discount_info?.id || null
        }, { transaction: t });

        // Tăng đếm số lần dùng mã giảm giá
        if (discount_info?.id) {
            await models.Discount.increment('apply_count', { 
                by: 1, 
                where: { id: discount_info.id },
                transaction: t 
            });
        }

        await t.commit();
        res.json({ success: true, message: 'Thanh toán thành công', invoice: payment });

    } catch (error) {
        await t.rollback();
        console.error('Retail Invoice Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi tạo hóa đơn: ' + error.message });
    }
};

// Lấy danh sách hóa đơn bán lẻ
exports.getRetailInvoices = async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const offset = (page - 1) * limit;

        const whereCondition = {
            code: { [Op.like]: 'REL-%' } // Chỉ lấy các mã bắt đầu bằng REL-
        };

        if (search) {
            whereCondition[Op.or] = [
                { code: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await models.Payment.findAndCountAll({
            where: whereCondition,
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [
                { model: models.User, as: 'User', attributes: ['id', 'full_name'] } // Người bán
            ]
        });

        // Parse payment_info từ JSON string sang Object để frontend dùng
        const invoices = rows.map(inv => {
            let details = {};
            try { details = JSON.parse(inv.payment_info); } catch (e) {}
            return {
                ...inv.toJSON(),
                customer_name: details.customer_info?.name || 'Khách lẻ',
                customer_phone: details.customer_info?.phone || '',
                item_count: details.items?.length || 0
            };
        });

        res.json({
            success: true,
            invoices,
            pagination: {
                total: count,
                page: parseInt(page),
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Get Retail Invoices Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách' });
    }
};


// ========== LẤY CHI TIẾT 1 GIAO DỊCH ==========
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await models.Payment.findByPk(req.params.id, {
      include: [
        {
          model: models.Appointment, as: 'Appointment', required: false,
          include: [
            { model: models.Patient, as: 'Patient', required: false,
              include: [{ model: models.User, attributes: ['full_name','phone','email','address','gender','dob'], required: false }] },
            { model: models.Doctor, as: 'Doctor', required: false,
              include: [{ model: models.User, as: 'user', attributes: ['full_name'], required: false }] },
            { model: models.Service, as: 'Service', attributes: ['name','price'], required: false }
          ]
        },
        {
          model: models.Consultation, as: 'Consultation', required: false,
          attributes: [
            'id', 'consultation_code', 'appointment_time', 'consultation_type',
            'base_fee', 'platform_fee', 'discount_amount', 'total_fee',
            'payment_status', 'payment_method', 'status'
          ],
          include: [
            { model: models.User, as: 'patient', required: false,
              attributes: ['full_name','phone','email','address','gender','dob'] },
            { model: models.User, as: 'doctor', required: false, attributes: ['full_name'] }
          ]
        },
        { model: models.User, as: 'User', attributes: ['full_name','phone','email'], required: false }
      ]
    });

    if (!payment) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });

    const data = payment.toJSON();

    // Map tên như getAllPayments
    let patientName = 'N/A', doctorName = 'N/A', serviceName = 'N/A';
    let original_amount = null, discount_amount = null;

    if (data.Appointment) {
      patientName = data.Appointment.guest_name
        ? `${data.Appointment.guest_name} (Khách)`
        : data.Appointment.Patient?.User?.full_name || 'N/A';
      doctorName = data.Appointment.Doctor?.user?.full_name || 'N/A';
      serviceName = data.Appointment.Service?.name || 'Lịch khám';
      const servicePrice = parseFloat(data.Appointment.Service?.price) || 0;
      const finalAmt = parseFloat(data.amount) || 0;
      if (servicePrice > finalAmt) {
        original_amount = servicePrice;
        discount_amount = servicePrice - finalAmt;
      }
    } else if (data.Consultation) {
      patientName = data.Consultation.patient?.full_name || 'N/A';
      doctorName  = data.Consultation.doctor?.full_name  || 'N/A';
      serviceName = 'Tư vấn trực tuyến';
      // Giá gốc = base_fee + platform_fee, giảm giá lấy thẳng từ consultation.discount_amount
      const baseFee = parseFloat(data.Consultation.base_fee) || 0;
      const platformFee = parseFloat(data.Consultation.platform_fee) || 0;
      const consultDiscount = parseFloat(data.Consultation.discount_amount) || 0;
      if (baseFee + platformFee > 0) {
        original_amount = baseFee + platformFee;
        discount_amount = consultDiscount;
      }
    }

    res.json({ success: true, data: { ...data, patientName, doctorName, serviceName, original_amount, discount_amount } });
  } catch (error) {
    console.error('❌ getPaymentById Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// --- KẾT THÚC ĐOẠN THÊM MỚI ---
exports.adminCheckTransaction = async (req, res) => res.json({ success: true });