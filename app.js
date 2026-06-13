// server/app.js - PHIÊN BẢN ĐÃ GỘP HOÀN CHỈNH
// Mô tả: Thiết lập server Express, kết nối DB, cấu hình WebSocket và cron job

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const { sequelize, initializeDatabase, seedData, models } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const WebSocket = require('ws');
const cron = require('node-cron');
const path = require('path');
const { Op, DataTypes } = require('sequelize');
const http = require('http');
const passport = require('./config/passportConfig');
const session = require('express-session');
const { auditMiddleware } = require('./middleware/auditMiddleware');

// ========== IMPORT ROUTES ==========
const userRoutes = require('./routes/userRoutes');
const specialtyRoutes = require('./routes/specialtyRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const articleRoutes = require('./routes/articleRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const medicalRecordRoutes = require('./routes/medicalRecordRoutes');
const calendarRoutes = require('./routes/calendarRoutes'); // Giữ lại từ file 2
const serviceRoutes = require('./routes/serviceRoutes');
const serviceCategoryRoutes = require('./routes/serviceCategoryRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const workShiftRoutes = require('./routes/workShiftRoutes');
const leaveRequestRoutes = require('./routes/leaveRequestRoutes');
const staffRoutes = require('./routes/staffRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const systemRoutes = require('./routes/systemRoutes');
const forumRoutes = require('./routes/forumRoutes');
const communityRoutes = require('./routes/communityRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const marketingRoutes = require('./routes/marketingRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const contactRoutes = require('./routes/contactRoutes');
const corporateBookingRoutes = require('./routes/corporateBookingRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
// ===== [BƯỚC 4] IMPORT STATISTICS ROUTES (2024-05-09) =====
const statisticRoutes = require('./routes/statisticRoutes');

// Khởi tạo ứng dụng Express
const app = express();
const server = http.createServer(app);

// ========== MIDDLEWARE ==========
// Trust proxy để lấy IP address đúng
app.set('trust proxy', true);

// ========== COMPRESSION (nén gzip/brotli - giảm băng thông ~70%) ==========
app.use(compression({
  level: 6,           // 1-9, 6 là cân bằng tốt giữa tốc độ và tỉ lệ nén
  threshold: 1024,    // Chỉ nén response > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// ========== HELMET (bảo mật HTTP headers) ==========
app.use(helmet({
  contentSecurityPolicy: false, // Tắt CSP vì React tự quản lý
  crossOriginEmbedderPolicy: false
}));

// ========== PROCESS MONITOR (giới hạn 100 process trên host) ==========
let activeRequests = 0;
const MAX_CONCURRENT = 80; // Giữ buffer 20, không dùng hết 100

app.use((req, res, next) => {
  // Bỏ qua health check và static files
  if (req.path === '/api/health' || req.path.startsWith('/uploads')) {
    return next();
  }

  if (activeRequests >= MAX_CONCURRENT) {
    console.warn(`⚠️ [PROCESS LIMIT] ${activeRequests}/${MAX_CONCURRENT} - Từ chối request: ${req.method} ${req.path}`);
    return res.status(503).json({
      success: false,
      message: 'Server đang xử lý quá nhiều yêu cầu. Vui lòng thử lại sau vài giây.',
      retryAfter: 3
    });
  }

  activeRequests++;
  console.log(`📊 [PROCESS] Active: ${activeRequests}/${MAX_CONCURRENT} | ${req.method} ${req.path}`);

  res.on('finish', () => {
    activeRequests--;
  });
  res.on('close', () => {
    activeRequests--;
  });

  next();
});

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'https://easymedify.com',
  'https://www.easymedify.com',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({
  limit: '50mb',
  extended: true,
  parameterLimit: 50000
}));

//  THÊM: Session middleware (BẮT BUỘC cho Passport OAuth)
app.use(session({
  secret: process.env.SESSION_SECRET || 'easymedify-session-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true nếu HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 giờ
  }
}));

//  THÊM: Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

//  THÊM: Audit middleware để log actions
app.use(auditMiddleware);

// Chuẩn hóa toàn bộ đường dẫn static để Frontend có thể truy cập qua http://localhost:3001/uploads/...
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Giữ lại các cấu hình phụ để đảm bảo tương thích ngược nếu bạn đã hardcode link cũ
app.use('/uploads/images', express.static(path.join(__dirname, 'uploads/images')));
app.use('/uploads/medical-files', express.static(path.join(__dirname, 'uploads/medical-files')));


// ========== MOUNT ROUTES ==========
app.use('/api/users', userRoutes);
app.use('/api/specialties', specialtyRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/service-categories', serviceCategoryRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/work-shifts', workShiftRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/calendar', calendarRoutes); // Giữ lại từ file 2
app.use('/api/staff', staffRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', systemRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/corporate', corporateBookingRoutes);
app.use('/api/permissions', permissionRoutes);
// ===== [BƯỚC 4] MOUNT STATISTICS ROUTES (2024-05-09) =====
app.use('/api/statistics', statisticRoutes);

// ========== HEALTH CHECK ENDPOINT (nâng cao) ==========
app.get('/api/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    process: {
      activeRequests,
      maxAllowed: MAX_CONCURRENT,
      memoryMB: Math.round(memUsage.rss / 1024 / 1024),
      uptimeMinutes: Math.round(process.uptime() / 60)
    }
  });
});

// ========== SERVE REACT STATIC (PRODUCTION ONLY) ==========
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public/build'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));

  app.get(/^(?!\/api|\/uploads).*$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'build', 'index.html'));
  });
}

// ========== ERROR HANDLER MIDDLEWARE ==========
app.use(errorHandler);

// ========== WEBSOCKET SERVER FOR REAL-TIME CHAT ==========
const wss = new WebSocket.Server({ server });

// Lưu trữ connections theo user_id và consultation_id
const connections = new Map(); // user_id -> WebSocket
const consultationRooms = new Map(); // consultation_id -> Set of user_ids

wss.on('connection', (ws, req) => {
  console.log(' WebSocket client đã kết nối');
  
  let userId = null;
  let currentConsultationId = null;
// --- [THÊM MỚI] ADMIN MONITORING VARIABLES ---
  let isAdminMonitor = false;
  
  // Thiết lập Heartbeat để đo Ping (Sức khỏe kết nối)
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  
  // Hàm gửi lệnh hệ thống (Admin Command) xuống Client
  const sendSystemCommand = (roomId, command, payload = {}) => {
    broadcastToConsultation(roomId, {
      type: 'system_command',
      payload: { command, ...payload }
    });
  };

  // Xử lý tin nhắn từ client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const { type, payload } = data;

      switch (type) {
        // Client đăng ký với user_id
        case 'register':
          userId = payload.user_id;
          connections.set(userId, ws);
          // Đánh dấu nếu là admin/staff để nhận broadcast sự cố
          if (payload.role === 'admin' || payload.role === 'staff') {
            adminWsUsers.add(userId);
          }
          console.log(`👤 User ${userId} đã đăng ký WebSocket`);
          ws.send(JSON.stringify({
            type: 'registered',
            payload: { user_id: userId }
          }));
          break;

        // Client tham gia phòng consultation
        case 'join_consultation':
        currentConsultationId = String(payload.consultation_id);
        if (!consultationRooms.has(currentConsultationId)) {
          consultationRooms.set(currentConsultationId, new Set());
        }

        // ✅ FIX: Lọc null ra khỏi existingUsers trước khi dùng
        const existingUsers = [...consultationRooms.get(currentConsultationId)]
          .filter(uid => uid !== null && uid !== undefined);

        // ✅ FIX: Chỉ add userId hợp lệ
        if (userId) {
          consultationRooms.get(currentConsultationId).add(userId);
        }
        console.log(`🏠 User ${userId} đã vào phòng consultation ${currentConsultationId}. Existing: ${existingUsers}`);
        
        // Thông báo cho những người đã ở trong phòng
        if (userId) {
          broadcastToConsultation(currentConsultationId, {
            type: 'user_joined',
            payload: { user_id: userId }
          }, userId);
        }
        
        // Gửi lại cho người mới join biết ai đã ở trong phòng
        if (existingUsers.length > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'room_members',
            payload: { existing_users: existingUsers }
          }));
        }
        break;

        // Gửi tin nhắn trong phòng consultation
        case 'send_message':
          broadcastToConsultation(payload.consultation_id, {
            type: 'new_message',
            payload
          }, userId);
          break;

        // Đã đọc tin nhắn
        case 'mark_read':
          broadcastToConsultation(payload.consultation_id, {
            type: 'message_read',
            payload: { user_id: userId, message_id: payload.message_id }
          }, userId);
          break;

        // Tín hiệu WebRTC (offer/answer/candidate)
        case 'webrtc_signal':
        case 'webrtc_offer':
        case 'webrtc_answer':
        case 'webrtc_ice_candidate':
          broadcastToConsultation(
            payload.consultation_id || currentConsultationId,
            { type, payload: { ...payload, from_user_id: userId } },
            userId
          );
          break;

        // Admin action lên một phòng
        case 'admin_action': {
          const { action, target_room } = payload;
          console.log(`⚠️ ADMIN ACTION: ${action} lên phòng ${target_room}`);
          if (action === 'force_reconnect') {
            sendSystemCommand(target_room, 'force_reconnect');
          } else if (action === 'restart_signaling') {
            sendSystemCommand(target_room, 'restart_signaling');
          } else if (action === 'reload_history') {
            sendSystemCommand(target_room, 'reload_history');
          }
          break;
        }

        case 'emoji_reaction':
        broadcastToConsultation(
          payload.consultation_id || currentConsultationId,
          { type: 'emoji_reaction', payload },
          userId
        );
        break;

      default:
        console.log(`⚠️ Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  // Xử lý khi client ngắt kết nối
  ws.on('close', () => {
    console.log(`🔌 WebSocket client đã ngắt kết nối (User: ${userId})`);
    
    if (userId) {
      connections.delete(userId);
      
      // Xóa khỏi phòng consultation
      if (currentConsultationId && consultationRooms.has(currentConsultationId)) {
        consultationRooms.get(currentConsultationId).delete(userId);
        
        // Thông báo cho người khác
        broadcastToConsultation(currentConsultationId, {
          type: 'user_left',
          payload: { user_id: userId }
        }, userId);
      }
    }
  });

  // Xử lý lỗi
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Hàm broadcast tin nhắn đến tất cả users trong consultation
function broadcastToConsultation(consultationId, message, excludeUserId = null) {
  // Chuẩn hóa key về string để tránh lỗi số vs string
  const roomKey = String(consultationId);
  if (!consultationRooms.has(roomKey)) {
    console.log(`⚠️ Room ${roomKey} not found. Available rooms:`, [...consultationRooms.keys()]);
    return;
  }

  const userIds = consultationRooms.get(roomKey);
  userIds.forEach(uid => {
    if (uid !== excludeUserId) {
      const ws = connections.get(uid);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  });
}

// Hàm gửi tin nhắn đến một user cụ thể
function sendToUser(userId, message) {
  const ws = connections.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Export các hàm WebSocket để sử dụng trong controllers
global.wsConnections = connections;
global.wsConsultationRooms = consultationRooms;
global.wsBroadcastToConsultation = broadcastToConsultation;
global.wsSendToUser = sendToUser;

// Broadcast tới tất cả admin/staff đang online
function broadcastToAdmins(message) {
  connections.forEach((ws, uid) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const adminRoles = ['admin', 'staff'];
      // adminUserIds được set khi register (xem bên dưới)
      if (adminWsUsers.has(uid)) {
        ws.send(JSON.stringify(message));
      }
    }
  });
}
const adminWsUsers = new Set(); // lưu user_id của admin/staff đang connect
global.wsBroadcastToAdmins = broadcastToAdmins;



// ========== CRON JOBS ==========
// [DISABLED] Status updater cron job đã tắt để không tự đổi trạng thái lịch hẹn/consultation.

// Import và khởi động Appointment Reminder Job (1 tiếng trước)
const { startAppointmentReminderJob } = require('./jobs/appointmentReminderJob');
startAppointmentReminderJob();

// Import và khởi động Payment Deadline Job (auto-cancel nếu deadline qua)
const { startPaymentDeadlineJob } = require('./jobs/paymentDeadlineJob');
startPaymentDeadlineJob();

/**
 * CRON JOB 1: Gửi thông báo nhắc lịch hẹn (8h sáng mỗi ngày)
 */
cron.schedule('0 8 * * *', async () => {
  console.log(' [CRON] Chạy job gửi thông báo nhắc lịch hẹn (8:00 AM)');

  try {
    const today = new Date().toISOString().split('T')[0];
    const appointments = await models.Appointment.findAll({
      where: {
        appointment_date: today,
        status: 'confirmed'
      },
      include: [
        {
          model: models.Patient,
          include: [{ model: models.User }]
        },
        {
          model: models.Service
        }
      ]
    });

    console.log(` Tìm thấy ${appointments.length} lịch hẹn hôm nay`);

    for (const appointment of appointments) {
      if (appointment.Patient?.User) {
        await models.Notification.create({
          user_id: appointment.Patient.User.id,
          type: 'appointment',
          title: ' Nhắc lịch hẹn hôm nay',
          message: `Bạn có lịch hẹn khám hôm nay lúc ${appointment.appointment_time} tại phòng khám. Vui lòng đến đúng giờ!`,
          related_id: appointment.id,
          related_type: 'appointment',
          link: `/lich-hen/${appointment.code}`,
          priority: 'high',
          is_read: false
        });
      }
    }

    console.log(` Đã gửi ${appointments.length} thông báo nhắc lịch hẹn`);

  } catch (error) {
    console.error('ERROR trong cron job nhắc lịch hẹn:', error);
  }
});

/**
 *  CRON JOB 2: Nhắc lịch tư vấn (30 phút trước giờ hẹn)
 */
cron.schedule('*/30 * * * *', async () => {
  console.log(' [CRON] Kiểm tra lịch tư vấn sắp diễn ra');

  try {
    const now = new Date();
    const in30Minutes = new Date(now.getTime() + 30 * 60000);
    const in35Minutes = new Date(now.getTime() + 35 * 60000);

    const upcomingConsultations = await models.Consultation.findAll({
      where: {
        status: 'confirmed',
        appointment_time: {
          [Op.between]: [in30Minutes, in35Minutes] // SỬA: Dùng Op
        }
      }
    });

    console.log(` Tìm thấy ${upcomingConsultations.length} buổi tư vấn sắp diễn ra`);

    for (const consultation of upcomingConsultations) {
      // Thông báo cho bệnh nhân
      await models.Notification.create({
        user_id: consultation.patient_id,
        type: 'consultation',
        title: ' Sắp đến giờ tư vấn',
        message: 'Buổi tư vấn của bạn sẽ bắt đầu sau 30 phút. Vui lòng chuẩn bị sẵn sàng!',
        related_id: consultation.id,
        related_type: 'consultation',
        link: `/tu-van/${consultation.id}`,
        priority: 'high',
        is_read: false
      });

      // Thông báo cho bác sĩ
      await models.Notification.create({
        user_id: consultation.doctor_id,
        type: 'consultation',
        title: ' Sắp đến giờ tư vấn',
        message: 'Bạn có buổi tư vấn sau 30 phút. Vui lòng chuẩn bị!',
        related_id: consultation.id,
        related_type: 'consultation',
        link: `/tu-van/${consultation.id}`,
        priority: 'high',
        is_read: false
      });
    }

  } catch (error) {
    console.error('ERROR trong cron job nhắc tư vấn:', error);
  }
});

/**
 * CRON JOB 3: Gửi thông báo nhắc lịch làm việc (18h chiều mỗi ngày)
 */
cron.schedule('0 18 * * *', async () => {
  console.log(' [CRON] Chạy job gửi thông báo nhắc lịch làm việc ngày mai (18:00 PM)');

  try {
    const notifications = await models.Notification.createScheduleReminders();
    console.log(` Đã gửi ${notifications.length} thông báo nhắc lịch làm việc ngày mai`);

  } catch (error) {
    console.error('ERROR trong cron job nhắc lịch làm việc:', error);
  }
});

/**
 * CRON JOB 4: Dọn dẹp thông báo cũ (2h sáng mỗi ngày)
 */
cron.schedule('0 2 * * *', async () => {
  console.log(' [CRON] Chạy job dọn dẹp thông báo cũ (02:00 AM)');

  try {
    const deleted = await models.Notification.cleanupOldNotifications(30);
    console.log(` Đã xóa ${deleted} thông báo cũ`);

  } catch (error) {
    console.error('ERROR trong cron job dọn dẹp thông báo:', error);
  }
});

/**
 * CRON JOB 5: Tự động hủy appointment quá hạn (mỗi giờ)
 */
cron.schedule('0 * * * *', async () => {
  console.log(' [CRON] Chạy job tự động hủy appointment quá hạn');

  try {
    // const { Op } = require('sequelize'); // Đã import ở đầu file
    const moment = require('moment');
    
    const cutoffDate = moment().subtract(24, 'hours').toDate();
    
    const expiredAppointments = await models.Appointment.findAll({
      where: {
        status: 'pending',
        createdAt: { [Op.lt]: cutoffDate }
      }
    });

    console.log(` Tìm thấy ${expiredAppointments.length} appointment quá hạn`);

    for (const appointment of expiredAppointments) {
      appointment.status = 'cancelled';
      appointment.metadata = {
        ...appointment.metadata,
        cancel_reason: 'Tự động hủy do quá 24h chưa xác nhận',
        cancelled_by: 'system',
        cancelled_at: new Date()
      };
      await appointment.save();

      if (appointment.patient_id) {
        const patient = await models.Patient.findByPk(appointment.patient_id, {
          include: [{ model: models.User }]
        });
        
        if (patient?.User) {
          await models.Notification.create({
          user_id: patient.User.id,
          type: 'appointment',
          title: 'Lịch hẹn đã bị hủy',
          message: `Lịch hẹn của bạn đã bị tự động hủy do quá 24h chưa được xác nhận. Vui lòng đặt lịch mới nếu vẫn muốn khám.`,
          related_id: appointment.id,
          related_type: 'appointment',
          link: `/lich-hen/${appointment.code}`,
          priority: 'normal',
          is_read: false
        });
        }
      }
    }

    console.log(` Đã hủy ${expiredAppointments.length} appointment quá hạn`);

  } catch (error) {
    console.error('ERROR trong cron job hủy appointment:', error);
  }
});

/**
 *  CRON JOB 6: Tự động hủy consultation quá hạn (mỗi 10 phút)
 */
cron.schedule('*/10 * * * *', async () => {
  console.log(' [CRON] Kiểm tra consultation quá hạn');

  try {
    const cancelledCount = await models.Consultation.autoCancel();
    if (cancelledCount > 0) {
      console.log(` Đã tự động hủy ${cancelledCount} consultation quá hạn`);
    }
  } catch (error) {
    console.error('ERROR trong cron job hủy consultation:', error);
  }
});

/**
 * CRON JOB 7: Tự động cập nhật work_status cho Doctor/Staff (1:00 AM mỗi ngày)
 */
cron.schedule('0 1 * * *', async () => {
  console.log(' [CRON] Chạy job cập nhật work_status (01:00 AM)');
  const transaction = await sequelize.transaction();
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Tìm tất cả user_id đang nghỉ phép hôm nay
    const usersOnLeave = await models.LeaveRequest.findAll({
      where: {
        status: 'approved',
        date_from: { [Op.lte]: today }, // SỬA: Dùng Op
        [Op.or]: [ // SỬA: Dùng Op
          { date_to: { [Op.gte]: today } }, // SỬA: Dùng Op
          { date_to: null, date_from: today } // Xử lý trường hợp nghỉ 1 ngày (date_to=null)
        ]
      },
      attributes: ['user_id'],
      raw: true,
      transaction
    });
    
    const userIdsOnLeave = usersOnLeave.map(leave => leave.user_id);
    console.log(` Tìm thấy ${userIdsOnLeave.length} user đang nghỉ phép hôm nay.`);

    // 2. Cập nhật 'on_leave' cho những ai có trong danh sách
    if (userIdsOnLeave.length > 0) {
      await models.Doctor.update(
        { work_status: 'on_leave' },
        { where: { user_id: { [Op.in]: userIdsOnLeave } }, transaction }
      );
      await models.Staff.update(
        { work_status: 'on_leave' },
        { where: { user_id: { [Op.in]: userIdsOnLeave } }, transaction }
      );
    }

    // 3. Cập nhật 'active' cho TẤT CẢ những người còn lại
    await models.Doctor.update(
      { work_status: 'active' },
      { where: { user_id: { [Op.notIn]: userIdsOnLeave } }, transaction }
    );
    await models.Staff.update(
      { work_status: 'active' },
      { where: { user_id: { [Op.notIn]: userIdsOnLeave } }, transaction }
    );

    await transaction.commit();
    console.log(' [CRON] SUCCESS: Đã cập nhật work_status cho Doctors và Staff.');

  } catch (error) {
    await transaction.rollback();
    console.error(' [CRON] ERROR trong cron job cập nhật work_status:', error);
  }
});

// ========== KHỞI ĐỘNG SERVER ==========
const PORT = process.env.PORT || 3001
// THÊM TỪ FILE 1: Import cron job
const { startAllCronJobs, schedulePharmacyNightlyJob, schedulePharmacyExpiryNotify } = require('./utils/cronJobs');

// --- [THÊM MỚI] INTERVAL KIỂM TRA KẾT NỐI (HEARTBEAT) ---
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate(); // Kill kết nối chết
    
    ws.isAlive = false;
    ws.ping(); // Gửi ping, client sẽ tự động trả lời pong
  });
}, 30000); // Check mỗi 30s

wss.on('close', function close() {
  clearInterval(interval);
});

async function startServer() {
  try {
    console.log('Đang khởi tạo cơ sở dữ liệu...');
    await initializeDatabase();

      const ensureArticleContentLongText = async () => {
        const queryInterface = sequelize.getQueryInterface();
        const articleSchema = await queryInterface.describeTable('articles');
        const contentColumn = articleSchema.content;
        const contentType = String(contentColumn?.type || '').toLowerCase();

        if (!contentType.includes('longtext')) {
          console.log(`Đang nâng cột articles.content từ ${contentColumn?.type || 'unknown'} lên LONGTEXT...`);
          await queryInterface.changeColumn('articles', 'content', {
            type: DataTypes.TEXT('long'),
            allowNull: false,
          });
          console.log('SUCCESS: articles.content đã được nâng lên LONGTEXT.');
        }
      };

    if (process.env.SYNC_MODE === 'force') {
      console.log('Đang đồng bộ force: Xóa và tạo lại toàn bộ bảng...');
      await sequelize.sync({ force: true, logging: console.log });
      console.log('SUCCESS: Tất cả bảng đã được xóa và tạo lại thành công.');

      console.log('Đang thêm dữ liệu mẫu...');
      await seedData();
      console.log('SUCCESS: Dữ liệu mẫu đã được thêm vào tất cả bảng.');
    } else if (process.env.SYNC_MODE === 'alter') {
      console.log('Đang đồng bộ alter: Cập nhật bảng để khớp với model...');
      await sequelize.sync({ alter: true, logging: console.log });
      console.log('SUCCESS: Cập nhật bảng thành công, dữ liệu được giữ nguyên.');
        await ensureArticleContentLongText();

      const userCount = await models.User.count();
      console.log(`Số lượng user hiện tại: ${userCount}`);

      if (userCount === 0) {
        console.log(' Database trống! Đang thêm dữ liệu mẫu...');
        await seedData();
        console.log('SUCCESS: Dữ liệu mẫu đã được thêm.');
      } else {
        console.log('ℹ️ Database đã có dữ liệu, bỏ qua seed.');
      }
    } else {
      console.log('Đang đồng bộ normal: Tạo bảng nếu chưa tồn tại...');
      await sequelize.sync({ logging: console.log });
      console.log('SUCCESS: Tất cả bảng đã được tạo hoặc đã tồn tại.');
        await ensureArticleContentLongText();

      const userCount = await models.User.count();
      console.log(`Số lượng user hiện tại: ${userCount}`);

      if (userCount === 0) {
        console.log(' Database trống! Đang thêm dữ liệu mẫu...');
        await seedData();
        console.log('SUCCESS: Dữ liệu mẫu đã được thêm.');
      } else {
        console.log('ℹ️ Database đã có dữ liệu, bỏ qua seed.');
      }
    }

    server.listen(PORT, () => {
      console.log(`SUCCESS: Server đang chạy trên cổng ${PORT}`);

      // ========== MEMORY MONITOR (log mỗi 5 phút) ==========
      setInterval(() => {
        const mem = process.memoryUsage();
        const memMB = Math.round(mem.rss / 1024 / 1024);
        const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
        console.log(`📊 [MONITOR] RAM: ${memMB}MB | Heap: ${heapMB}MB | Active requests: ${activeRequests}/${MAX_CONCURRENT}`);
        
        // Cảnh báo nếu RAM vượt 400MB (điều chỉnh theo plan host)
        if (memMB > 400) {
          console.warn(`⚠️ [MEMORY WARNING] RAM đang cao: ${memMB}MB`);
        }
      }, 5 * 60 * 1000); // 5 phút

      // THÊM TỪ FILE 1: Gọi hàm start cron jobs từ file ngoài
      startAllCronJobs();

      // Pharmacy cron jobs (truyền models vào vì dùng closure)
      schedulePharmacyNightlyJob(models);
      schedulePharmacyExpiryNotify(models);

      console.log('╔═══════════════════════════════════════════════════════╗');
      console.log('📌 THÔNG TIN ĐĂNG NHẬP:');
      console.log('   Admin: admin1@example.com / 123456');
      console.log('   Doctor: doctor1@example.com / 123456');
      console.log('   Patient: patient1@example.com / 123456');
      console.log('─────────────────────────────────────────────────────────');
      console.log('🔗 API ENDPOINTS:');
      console.log('   Users:         http://localhost:3001/api/users');
     console.log('   Schedules:     http://localhost:3001/api/schedules');
      console.log('   Calendar:     http://localhost:3001/api/calendar'); // THÊM MỚI
      console.log('   Articles:      http://localhost:3001/api/articles');
      console.log('   Services:      http://localhost:3001/api/services');
      console.log('   Appointments:  http://localhost:3001/api/appointments');
      console.log('   MedicalRecords:http://localhost:3001/api/medical-records');
      console.log('   Payments:      http://localhost:3001/api/payments');
      console.log('    Consultations: http://localhost:3001/api/consultations');
      console.log('    Chat:          http://localhost:3001/api/chat');
      console.log('─────────────────────────────────────────────────────────');
      console.log('📡 WEBSOCKET:');
      console.log(`   WebSocket Server: ws://localhost:${PORT}`);
      console.log('─────────────────────────────────────────────────────────');
      console.log(' CRON JOBS ACTIVE:');
      console.log('    (Cron jobs được quản lý trong ./utils/cronJobs.js)'); // SỬA: Thông báo
      console.log('╚═══════════════════════════════════════════════════════╝');
    });
  } catch (error) {
    console.error('ERROR: Không thể khởi động server:', error.message);
    console.error(error.stack); // SỬA: In ra stack trace đầy đủ
    process.exit(1);
  }
}

startServer();

module.exports = app;