// server/controllers/contactController.js
const { models } = require('../config/db');
const { Op } = require('sequelize');
const emailSender = require('../utils/emailSender');

/**
 * POST /api/contact/send
 * Khách hàng gửi liên hệ (public, không cần auth).
 * Lưu ý: KHÔNG gửi email báo nhận ở đây nữa, sẽ gửi khi Staff nhấn "Nhận Ticket".
 */
exports.sendMessage = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc (tên, email, chủ đề, nội dung)'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await models.ContactMessage.count({
      where: {
        email,
        created_at: { [Op.gte]: oneHourAgo }
      }
    });

    if (recentCount >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau 1 giờ.'
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || '';

    const contactMsg = await models.ContactMessage.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : null,
      subject: subject.trim(),
      message: message.trim(),
      status: 'new',
      ip_address: ipAddress
    });

    if (models.Notification) {
      const admins = await models.User.findAll({ where: { role: 'admin', is_active: true } });
      for (const admin of admins) {
        await models.Notification.create({
          user_id: admin.id,
          type: 'system',
          title: 'Tin nhan lien he moi',
          content: `${name} (${email}) vua gui tin nhan: "${subject}"`,
          related_id: contactMsg.id,
          related_type: 'contact_message',
          link: '/quan-ly-lien-he',
          priority: 'normal',
          is_read: false
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Yeu cau cua ban da duoc gui thanh cong! Chung toi se phan hoi som nhat.',
      data: { id: contactMsg.id }
    });
  } catch (error) {
    console.error('[contactController] sendMessage ERROR:', error);
    res.status(500).json({ success: false, message: 'Loi may chu', error: error.message });
  }
};

/**
 * GET /api/contact/messages
 * Lấy danh sách tin nhắn. BẢO MẬT: Ẩn nội dung nếu Ticket không thuộc về Staff đang xem.
 */
exports.getMessages = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 30,
      status,
      search,
      startDate,
      endDate,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { subject: { [Op.like]: `%${search}%` } }
      ];
      if (!isNaN(search)) {
        whereClause[Op.or].push({ id: parseInt(search) });
      }
    }

    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.created_at[Op.lte] = end;
      }
    }

    const allowedSort = ['created_at', 'name', 'email', 'status', 'updated_at'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'created_at';

    const { count, rows } = await models.ContactMessage.findAndCountAll({
      where: whereClause,
      include: [{
        model: models.User,
        as: 'replier',
        attributes: ['id', 'full_name', 'email', 'avatar_url'],
        required: false
      }],
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Ẩn nội dung đối với Staff chưa claim ticket
    const isStaff = req.user.role === 'staff';
    const secureRows = rows.map(msg => {
      const msgObj = msg.toJSON();
      if (isStaff && msgObj.replied_by !== req.user.id) {
        msgObj.message = '[Noi dung dang duoc bao mat. Vui long nhan Ticket de xem chi tiet]';
        msgObj.admin_note = null;
      }
      return msgObj;
    });

    const stats = await models.ContactMessage.findAll({
      attributes: [
        'status',
        [models.ContactMessage.sequelize.fn('COUNT', models.ContactMessage.sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const statsMap = { new: 0, processing: 0, replied: 0, closed: 0, total: count };
    stats.forEach(s => { 
      if (statsMap[s.status] !== undefined) statsMap[s.status] = parseInt(s.count); 
    });

    res.json({
      success: true,
      data: secureRows,
      total: count,
      stats: statsMap,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    });
  } catch (error) {
    console.error('[contactController] getMessages ERROR:', error);
    res.status(500).json({ success: false, message: 'Loi may chu', error: error.message });
  }
};

/**
 * GET /api/contact/messages/:id
 * Chi tiết 1 tin nhắn. Tự động mark as read bị xóa để chuyển sang cơ chế Ticketing.
 */
exports.getMessageById = async (req, res) => {
  try {
    const msg = await models.ContactMessage.findByPk(req.params.id, {
      include: [{
        model: models.User,
        as: 'replier',
        attributes: ['id', 'full_name', 'email'],
        required: false
      }]
    });

    if (!msg) return res.status(404).json({ success: false, message: 'Khong tim thay tin nhan' });

    const msgObj = msg.toJSON();
    if (req.user.role === 'staff' && msg.replied_by !== req.user.id && msg.replied_by !== null) {
       msgObj.message = '[Noi dung dang duoc xu ly boi nhan vien khac. Ban khong co quyen xem]';
       msgObj.admin_note = null;
    }

    res.json({ success: true, data: msgObj });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Loi may chu', error: error.message });
  }
};

/**
 * POST /api/contact/messages/:id/claim
 * Nhận Ticket và gửi email báo cho Khách hàng.
 */
exports.claimTicket = async (req, res) => {
  try {
    const msg = await models.ContactMessage.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Khong tim thay ticket' });

    if (msg.replied_by && msg.replied_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Ticket nay da co nguoi nhan xu ly!' });
    }

    if (msg.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Ticket nay da duoc dong' });
    }

    await msg.update({ status: 'processing', replied_by: req.user.id });

    const staffUser = await models.User.findByPk(req.user.id);
    await emailSender.sendEmail({
      to: msg.email,
      subject: `[Ticket #${msg.id}] Chung toi da tiep nhan yeu cau cua ban`,
      template: 'contact_ticket_claimed',
      data: { 
        userName: msg.name, 
        ticketId: msg.id, 
        originalMessage: msg.message, 
        staffName: staffUser ? staffUser.full_name : 'Bo phan Ho tro' 
      }
    });

    res.json({ success: true, message: 'Da nhan Ticket thanh cong' });
  } catch (error) { 
    res.status(500).json({ success: false, message: 'Loi may chu' }); 
  }
};

/**
 * POST /api/contact/messages/:id/reply
 * Phản hồi Email qua SMTP. Nội dung gửi đúng nguyên bản từ CKEditor.
 */
exports.replyMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { reply_content_html, email_subject, email_cc, email_bcc } = req.body;

    if (!reply_content_html) {
      return res.status(400).json({ success: false, message: 'Noi dung email rong' });
    }

    const msg = await models.ContactMessage.findByPk(id);
    if (!msg) return res.status(404).json({ success: false, message: 'Khong tim thay ticket' });

    if (msg.replied_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen tra loi Ticket nay' });
    }
    if (msg.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Khong the tra loi Ticket da dong' });
    }

    const ccList = Array.isArray(email_cc) ? email_cc.join(',') : (email_cc || '');
    const bccList = Array.isArray(email_bcc) ? email_bcc.join(',') : (email_bcc || '');
    const subjectFinal = email_subject || `Re: [Ticket #${msg.id}] ${msg.subject}`;

    await emailSender.sendEmail({
      to: msg.email,
      cc: ccList,
      bcc: bccList,
      subject: subjectFinal,
      template: 'contact_admin_reply',
      data: { htmlContent: reply_content_html }
    });

    let history = [];
    if (msg.admin_note) {
      try { history = JSON.parse(msg.admin_note); } catch (e) { history = []; }
    }
    
    history.push({
      sender: 'staff',
      sender_id: req.user.id,
      timestamp: new Date().toISOString(),
      subject: subjectFinal,
      content: reply_content_html,
      cc: ccList, 
      bcc: bccList
    });

    await msg.update({
      status: 'replied',
      admin_note: JSON.stringify(history),
      replied_at: new Date()
    });

    res.json({ success: true, message: 'Da gui email phan hoi' });
  } catch (error) { 
    res.status(500).json({ success: false, message: 'Loi gui email', error: error.message }); 
  }
};

/**
 * PUT /api/contact/messages/:id/close
 * Đóng Ticket, kết thúc xử lý.
 */
exports.closeTicket = async (req, res) => {
  try {
    const msg = await models.ContactMessage.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Khong tim thay ticket' });

    if (msg.replied_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Ban khong co quyen dong Ticket nay' });
    }

    await msg.update({ status: 'closed' });

    await emailSender.sendEmail({
      to: msg.email,
      subject: `[Ticket #${msg.id}] Yeu cau ho tro da duoc dong`,
      template: 'contact_ticket_closed',
      data: { userName: msg.name, ticketId: msg.id }
    });

    res.json({ success: true, message: 'Da dong Ticket' });
  } catch (error) { 
    res.status(500).json({ success: false, message: 'Loi may chu' }); 
  }
};

/**
 * POST /api/contact/webhook/receive
 * Webhook Endpoint để nhận email reply từ Khách hàng (Cấu hình với SendGrid/Mailgun)
 */
exports.receiveWebhook = async (req, res) => {
  try {
    // 1. Nhận các tham số bảo mật từ Mailgun gửi qua body
    const { timestamp, token, signature } = req.body.signature || req.body; 
    
    // 2. Xác thực chữ ký bằng thuật toán HMAC SHA256 với Secret Key trong .env
    const encodedToken = crypto
        .createHmac('sha256', process.env.MAILGUN_WEBHOOK_SIGNING_KEY)
        .update(timestamp.concat(token))
        .digest('hex');

    // Nếu chữ ký không khớp, báo lỗi 401 Unauthorized ngay lập tức
    if (encodedToken !== signature) {
        return res.status(401).json({ message: 'Lỗi xác thực: Sai chữ ký Webhook!' });
    }

    // 3. Nếu an toàn, bắt đầu bóc tách dữ liệu email
    const subject = req.body.subject || '';
    const bodyHtml = req.body['body-html'] || '';
    const bodyPlain = req.body['body-plain'] || '';
    const senderEmail = req.body.sender || req.body.From || '';
    
    // 4. Tìm ID Ticket từ tiêu đề
    const ticketMatch = subject.match(/\[Ticket #(\d+)\]/i);
    if (!ticketMatch) {
      // Phải trả về 200 OK để Mailgun biết là đã nhận, nếu không nó sẽ thử gửi lại liên tục
      return res.status(200).json({ message: 'Không tìm thấy ID Ticket. Bỏ qua.' });
    }

    const ticketId = ticketMatch[1];
    const msg = await models.ContactMessage.findByPk(ticketId);
    
    if (!msg) return res.status(200).json({ message: 'Ticket ID không tồn tại.' });

    // 5. Cập nhật lịch sử (Admin Note)
    let history = [];
    if (msg.admin_note) {
      try { history = JSON.parse(msg.admin_note); } catch (e) { history = []; }
    }

    history.push({
      sender: 'customer',
      sender_email: senderEmail,
      timestamp: new Date().toISOString(),
      subject: subject,
      content: bodyHtml || bodyPlain || '[Chưa có nội dung]'
    });

    const statusToUpdate = msg.status === 'closed' ? 'closed' : 'replied';

    await msg.update({
      status: statusToUpdate,
      admin_note: JSON.stringify(history)
    });

    res.status(200).json({ success: true, message: 'Đã đồng bộ email thành công' });
  } catch (error) {
    console.error('[contactController] receiveWebhook ERROR:', error);
    res.status(500).json({ success: false, message: 'Lỗi xử lý Webhook' });
  }
};

/**
 * Các hàm cũ giữ nguyên theo yêu cầu
 */
exports.updateStatus = async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    const validStatuses = ['new', 'read', 'processing', 'replied', 'closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trang thai khong hop le' });
    }

    const msg = await models.ContactMessage.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Khong tim thay tin nhan' });

    const updateData = { status };
    if (admin_note !== undefined) updateData.admin_note = admin_note;
    if (status === 'replied') {
      updateData.replied_by = req.user.id;
      updateData.replied_at = new Date();
    }

    await msg.update(updateData);
    res.json({ success: true, message: 'Cap nhat thanh cong', data: msg });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Loi may chu', error: error.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const msg = await models.ContactMessage.findByPk(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Khong tim thay tin nhan' });

    await msg.destroy();
    res.json({ success: true, message: 'Da xoa tin nhan thanh cong' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Loi may chu', error: error.message });
  }
};

exports.bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sach ID khong hop le' });
    }

    const deleted = await models.ContactMessage.destroy({ where: { id: { [Op.in]: ids } } });
    res.json({ success: true, message: `Da xoa ${deleted} tin nhan` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Loi may chu', error: error.message });
  }
};