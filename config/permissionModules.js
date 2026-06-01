/**
 * server/config/permissionModules.js
 * ========================================
 * Định nghĩa tất cả MODULES và PERMISSIONS CHI TIẾT trong hệ thống
 * 
 * Mỗi module có:
 * - name: Tên module hiển thị
 * - icon: Biểu tượng (dành cho frontend)
 * - description: Mô tả module
 * - permissions: Danh sách actions chi tiết
 *   - key: Mã permission (dùng khi lưu db)
 *   - label: Tên hiển thị
 *   - description: Mô tả chi tiết
 *   - allowedRanks: ['staff', 'manager'] - Rank nào được phép
 * 
 * Logic:
 * - Sidebar chỉ hiển thị MENU nếu user có ≥1 permission trong module
 * - Sidebar chỉ hiển thị SUB-MENU nếu user có permission tương ứng
 * - UI chỉ hiển thị action button (Thêm, Sửa, Xóa...) nếu user có permission
 */

const PERMISSION_MODULES = {
  // ========================================
  // LỊCH LÀMMV VIÊN & LỊCH NGHỈ
  // ========================================
  work_shift: {
    name: 'Lịch làm việc',
    icon: 'FaCalendarAlt',
    description: 'Quản lý lịch công tác, lịch nghỉ phép, tăng ca',
    permissions: [
      { 
        key: 'view_personal', 
        label: 'Xem lịch of tôi', 
        description: 'Xem lịch làm việc cá nhân',
        allowedRanks: ['staff', 'manager', 'doctor']
      },
      { 
        key: 'view_doctors', 
        label: 'Xem lịch bác sĩ', 
        description: 'Xem lịch làm việc của bác sĩ quản lý',
        allowedRanks: ['staff', 'manager']
      },
      { 
        key: 'register_shift', 
        label: 'Đăng ký ca làm', 
        description: 'Đăng ký ca làm việc',
        allowedRanks: ['staff', 'manager', 'doctor']
      },
      { 
        key: 'register_leave', 
        label: 'Đăng ký nghỉ phép', 
        description: 'Tạo đơn xin nghỉ phép',
        allowedRanks: ['staff', 'manager', 'doctor']
      },
      { 
        key: 'register_overtime', 
        label: 'Đăng ký tăng ca', 
        description: 'Tạo đơn xin tăng ca',
        allowedRanks: ['staff', 'manager', 'doctor']
      },
      { 
        key: 'approve_shift', 
        label: 'Phê duyệt ca làm', 
        description: 'Phê duyệt ca làm việc',
        allowedRanks: ['manager']
      },
      { 
        key: 'approve_leave', 
        label: 'Phê duyệt nghỉ phép', 
        description: 'Phê duyệt đơn nghỉ',
        allowedRanks: ['manager']
      },
      { 
        key: 'approve_overtime', 
        label: 'Phê duyệt tăng ca', 
        description: 'Phê duyệt đơn tăng ca',
        allowedRanks: ['manager']
      },
      { 
        key: 'manage_schedule', 
        label: 'Quản lý lịch khác', 
        description: 'Quản lý lịch của nhân viên/bác sĩ khác',
        allowedRanks: ['manager']
      }
    ]
  },

  // ========================================
  // LỊCH HẸN
  // ========================================
  appointments: {
    name: 'Lịch hẹn',
    icon: 'FaClipboardList',
    description: 'Quản lý lịch hẹn khám (tạo/sửa/hủy, phân công bác sĩ)',
    permissions: [
      { 
        key: 'view', 
        label: 'Xem danh sách', 
        description: 'Xem danh sách lịch hẹn',
        allowedRanks: ['staff', 'manager', 'doctor']
      },
      { 
        key: 'create', 
        label: 'Tạo mới', 
        description: 'Tạo lịch hẹn cho bệnh nhân',
        allowedRanks: ['staff', 'manager', 'doctor']
      },
      { 
        key: 'edit', 
        label: 'Sửa', 
        description: 'Chỉnh sửa lịch hẹn',
        allowedRanks: ['staff', 'manager', 'doctor']
      },
      { 
        key: 'cancel', 
        label: 'Hủy lịch', 
        description: 'Hủy lịch hẹn',
        allowedRanks: ['staff', 'manager']
      },
      { 
        key: 'reject', 
        label: 'Từ chối', 
        description: 'Từ chối lịch hẹn',
        allowedRanks: ['staff', 'manager', 'doctor']
      },
      { 
        key: 'approve', 
        label: 'Xác nhận', 
        description: 'Xác nhận lịch hẹn',
        allowedRanks: ['staff', 'manager', 'doctor']
      },
      { 
        key: 'verify_payment', 
        label: 'Xác nhận thanh toán', 
        description: 'Xác nhận thanh toán tại quầy',
        allowedRanks: ['staff']
      },
      { 
        key: 'update_status', 
        label: 'Cập nhật trạng thái', 
        description: 'Đổi trạng thái lịch hẹn',
        allowedRanks: ['staff', 'doctor']
      },
      { 
        key: 'resend_code', 
        label: 'Gửi lại mã', 
        description: 'Gửi lại mã tra cứu',
        allowedRanks: ['staff', 'manager']
      },
      { 
        key: 'view_reviews', 
        label: 'Xem đánh giá', 
        description: 'Xem feedback từ bệnh nhân',
        allowedRanks: ['staff', 'manager', 'doctor']
      },
      { 
        key: 'assign_doctor', 
        label: 'Phân công bác sĩ', 
        description: 'Chỉ định bác sĩ khám',
        allowedRanks: ['manager']
      }
    ]
  },

  // ========================================
  // ✅ MỚI: LỄ TÂN / TIẾP ĐÓN
  // ========================================
  reception: {
    name: 'Lễ tân / Tiếp đón',
    icon: 'FaHeadset',
    description: 'Quản lý tiếp đón bệnh nhân, check-in, quầy tiếp tân',
    permissions: [
      { 
        key: 'view_all_appointments', 
        label: 'Xem lịch hẹn tất cả bác sĩ', 
        description: 'Xem danh sách lịch hẹn của tất cả bác sĩ',
        allowedRanks: ['staff']
      },
      { 
        key: 'view_all_schedules', 
        label: 'Xem lịch làm việc tất cả bác sĩ', 
        description: 'Xem lịch làm việc của tất cả bác sĩ',
        allowedRanks: ['staff']
      },
      { 
        key: 'checkin', 
        label: 'Check-in bệnh nhân', 
        description: 'Xác nhận bệnh nhân đến khám tại quầy tiếp đón',
        allowedRanks: ['staff']
      },
      { 
        key: 'issue_number', 
        label: 'Cấp số khám', 
        description: 'Cấp số thứ tự khám bệnh cho bệnh nhân',
        allowedRanks: ['staff']
      },
      { 
        key: 'create_appointment', 
        label: 'Tạo lịch hẹn', 
        description: 'Tạo lịch hẹn hỗ trợ bệnh nhân tại quầy',
        allowedRanks: ['staff']
      },
      { 
        key: 'manage', 
        label: 'Quản lý tiếp đón', 
        description: 'Quản lý các hoạt động tiếp đón bệnh nhân',
        allowedRanks: ['manager']
      }
    ]
  },

  // ========================================
  // QUẢN LÝ BÁC SĨ
  // ========================================
  doctors: {
    name: 'Quản lý bác sĩ',
    icon: 'FaUserMd',
    description: 'Quản lý thông tin, lịch làm, chuyên khoa bác sĩ',
    permissions: [
      { key: 'view', label: 'Xem', description: 'Xem danh sách bác sĩ', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'edit', label: 'Sửa', description: 'Chỉnh sửa thông tin bác sĩ', allowedRanks: ['manager'] },
      { key: 'manage_schedule', label: 'Quản lý lịch', description: 'Quản lý lịch làm việc bác sĩ', allowedRanks: ['manager'] },
      { key: 'assign', label: 'Phân công', description: 'Phân công bác sĩ cho ca khám', allowedRanks: ['manager'] }
    ]
  },

  // ========================================
  // QUẢN LÝ BỆNH NHÂN
  // ========================================
  patients: {
    name: 'Quản lý bệnh nhân',
    icon: 'FaBed',
    description: 'Quản lý hồ sơ, thông tin bệnh nhân',
    permissions: [
      { key: 'view', label: 'Xem', description: 'Xem thông tin bệnh nhân', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'edit', label: 'Sửa', description: 'Chỉnh sửa hồ sơ bệnh nhân', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'delete', label: 'Xóa', description: 'Xóa hồ sơ bệnh nhân', allowedRanks: ['manager'] }
    ]
  },

  // ========================================
  // HỒ SƠ BỆNH ÁN
  // ========================================
  medical_records: {
    name: 'Hồ sơ bệnh án',
    icon: 'FaFileAlt',
    description: 'Quản lý bệnh án, kết quả khám, theo dõi y tế',
    permissions: [
      { key: 'view', label: 'Xem hồ sơ', description: 'Xem hồ sơ bệnh án', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'create', label: 'Tạo mới', description: 'Tạo hồ sơ bệnh án ban đầu', allowedRanks: ['staff', 'doctor'] },
      { key: 'edit', label: 'Sửa nội dung', description: 'Chỉnh sửa bệnh án', allowedRanks: ['staff', 'doctor'] },
      { key: 'edit_vitals', label: 'Sửa chỉ số sinh tồn', description: 'Cập nhật HA, nhịp tim, SpO2...', allowedRanks: ['staff', 'doctor'] },
      { key: 'delete', label: 'Xóa', description: 'Xóa bệnh án', allowedRanks: ['manager'] }
    ]
  },

  // ========================================
  // BÀI VIẾT & NỘI DUNG
  // ========================================
  articles: {
    name: 'Quản lý bài viết',
    icon: 'FaNewspaper',
    description: 'Quản lý bài viết y tế, hướng dẫn, kiến thức',
    permissions: [
      { key: 'view', label: 'Xem danh sách', description: 'Xem danh sách bài viết', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'create', label: 'Tạo mới', description: 'Tạo bài viết', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'edit', label: 'Sửa', description: 'Chỉnh sửa bài viết', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'duplicate', label: 'Sao chép', description: 'Sao chép bài viết xem sẵn', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'delete', label: 'Xóa', description: 'Xóa bài viết', allowedRanks: ['manager'] },
      { key: 'publish', label: 'Xuất bản', description: 'Công khai bài viết', allowedRanks: ['manager'] },
      { key: 'approve', label: 'Phê duyệt', description: 'Phê duyệt bài viết', allowedRanks: ['manager'] },
      { key: 'reject', label: 'Từ chối', description: 'Từ chối bài viết', allowedRanks: ['manager'] },
      { key: 'hide', label: 'Ẩn', description: 'Ẩn bài viết khỏi công khai', allowedRanks: ['manager'] },
      { key: 'restore', label: 'Khôi phục', description: 'Khôi phục bài viết bị ẩn', allowedRanks: ['manager'] }
    ]
  },

  // ========================================
  // THÔNG TIN THUỐC
  // ========================================
  medicines: {
    name: 'Thông tin thuốc',
    icon: 'FaWarehouse',
    description: 'Quản lý cơ sở dữ liệu thuốc, thông tin dược phẩm',
    permissions: [
      { key: 'view', label: 'Xem danh sách', description: 'Xem danh sách thuốc', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'create', label: 'Tạo mới', description: 'Thêm thuốc mới', allowedRanks: ['manager'] },
      { key: 'edit', label: 'Sửa', description: 'Chỉnh sửa thông tin thuốc', allowedRanks: ['manager'] },
      { key: 'delete', label: 'Xóa', description: 'Xóa thuốc khỏi cơ sở dữ liệu', allowedRanks: ['manager'] },
      { key: 'hide', label: 'Ẩn', description: 'Ẩn thuốc khỏi UI công khai (soft hide)', allowedRanks: ['manager'] },
      { key: 'restore', label: 'Khôi phục', description: 'Khôi phục thuốc đã bị ẩn', allowedRanks: ['manager'] },
      { key: 'propose_update', label: 'Đề xuất cập nhật', description: 'Đề xuất thay đổi thông tin thuốc', allowedRanks: ['staff', 'doctor'] }
    ]
  },

  pharmacy: {
    name: 'Kho thuốc',
    icon: 'FaPills',
    description: 'Quản lý tồn kho, nhập kho, bán lẻ, bán theo đơn và nhà cung cấp',
    permissions: [
      { key: 'view', label: 'Xem tồn kho', description: 'Xem danh sách thuốc trong kho', allowedRanks: ['staff', 'manager'] },
      { key: 'import', label: 'Nhập kho', description: 'Nhập thuốc theo lô và hạn dùng', allowedRanks: ['staff', 'manager'] },
      { key: 'export_retail', label: 'Bán lẻ', description: 'Bán thuốc cho khách lẻ tại quầy', allowedRanks: ['staff', 'manager'] },
      { key: 'export_prescription', label: 'Bán theo đơn', description: 'Xuất thuốc theo đơn thuốc đã lưu', allowedRanks: ['staff', 'manager'] },
      { key: 'view_batches', label: 'Xem lô thuốc', description: 'Xem chi tiết lô, hạn dùng, tồn còn lại', allowedRanks: ['staff', 'manager'] },
      { key: 'view_transactions', label: 'Xem lịch sử giao dịch', description: 'Xem nhập xuất kho theo thời gian', allowedRanks: ['staff', 'manager'] },
      { key: 'manage_suppliers', label: 'Quản lý nhà cung cấp', description: 'Thêm/sửa/xóa nhà cung cấp thuốc', allowedRanks: ['manager'] },
      { key: 'view_alerts', label: 'Xem cảnh báo tồn kho', description: 'Xem cảnh báo hết hàng, tồn thấp, sắp hết hạn', allowedRanks: ['staff', 'manager'] },
      { key: 'adjust_stock', label: 'Điều chỉnh tồn kho', description: 'Điều chỉnh chênh lệch tồn kho sau kiểm kê', allowedRanks: ['manager'] }
    ]
  },

  // ========================================
  // THÔNG TIN BỆNH LÝ
  // ========================================
  diseases: {
    name: 'Thông tin bệnh lý',
    icon: 'FaStethoscope',
    description: 'Quản lý danh mục bệnh lý, chẩn đoán',
    permissions: [
      { key: 'view', label: 'Xem danh sách', description: 'Xem danh sách bệnh lý', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'create', label: 'Tạo mới', description: 'Thêm bệnh lý mới', allowedRanks: ['manager'] },
      { key: 'edit', label: 'Sửa', description: 'Chỉnh sửa thông tin bệnh lý', allowedRanks: ['manager'] },
      { key: 'delete', label: 'Xóa', description: 'Xóa bệnh lý', allowedRanks: ['manager'] },
      { key: 'hide', label: 'Ẩn', description: 'Ẩn bệnh lý khỏi UI công khai (soft hide)', allowedRanks: ['manager'] },
      { key: 'restore', label: 'Khôi phục', description: 'Khôi phục bệnh lý đã bị ẩn', allowedRanks: ['manager'] },
      { key: 'propose_update', label: 'Đề xuất cập nhật', description: 'Đề xuất thay đổi', allowedRanks: ['staff', 'doctor'] }
    ]
  },

  // ========================================
  // TƯ VẤN & VIDEO CALL
  // ========================================
  consultations: {
    name: 'Tư vấn trực tuyến',
    icon: 'FaRegComments',
    description: 'Quản lý phiên tư vấn, gói dịch vụ tư vấn',
    permissions: [
      { key: 'view', label: 'Xem danh sách', description: 'Xem danh sách tư vấn', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'create', label: 'Tạo mới', description: 'Tạo phiên tư vấn', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'edit', label: 'Sửa', description: 'Chỉnh sửa thông tin tư vấn', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'approve', label: 'Xác nhận', description: 'Xác nhận phiên tư vấn', allowedRanks: ['manager', 'doctor'] },
      { key: 'reject', label: 'Từ chối', description: 'Từ chối phiên tư vấn', allowedRanks: ['manager', 'doctor'] },
      { key: 'close', label: 'Đóng phiên', description: 'Kết thúc phiên tư vấn', allowedRanks: ['doctor'] }
    ]
  },

  consultation_pricing: {
    name: 'Gói dịch vụ tư vấn',
    icon: 'FaMoneyBillWave',
    description: 'Quản lý gói tư vấn, bảng giá tư vấn',
    permissions: [
      { key: 'view', label: 'Xem danh sách', description: 'Xem gói tư vấn', allowedRanks: ['staff', 'manager'] },
      { key: 'create', label: 'Tạo gói', description: 'Tạo gói tư vấn mới', allowedRanks: ['manager'] },
      { key: 'edit', label: 'Sửa', description: 'Chỉnh sửa gói tư vấn', allowedRanks: ['manager'] },
      { key: 'delete', label: 'Xóa', description: 'Xóa gói tư vấn', allowedRanks: ['manager'] },
      { key: 'set_price', label: 'Đặt giá', description: 'Cập nhật giá tư vấn', allowedRanks: ['manager'] },
      { key: 'hide', label: 'Ẩn gói', description: 'Ẩn gói khỏi khách hàng', allowedRanks: ['manager'] }
    ]
  },

  consultation_realtime: {
    name: 'Tư vấn realtime',
    icon: 'FaComments',
    description: 'Quản lý phiên tư vấn theo thời gian thực',
    permissions: [
      { key: 'monitor', label: 'Giám sát', description: 'Giám sát phiên tư vấn đang hoạt động', allowedRanks: ['staff', 'manager'] },
      { key: 'resolve_errors', label: 'Xử lý lỗi', description: 'Xử lý sự cố kỹ thuật', allowedRanks: ['manager'] }
    ]
  },

  video_call: {
    name: 'Video call tư vấn',
    icon: 'FaVideo',
    description: 'Quản lý cuộc gọi video, kết nối tư vấn',
    permissions: [
      { key: 'monitor', label: 'Giám sát', description: 'Giám sát cuộc gọi video', allowedRanks: ['staff', 'manager'] },
      { key: 'resolve_errors', label: 'Xử lý lỗi', description: 'Xử lý sự cố kết nối', allowedRanks: ['manager'] }
    ]
  },

  // ========================================
  // DIỄN ĐÀN & CỘNG ĐỒNG
  // ========================================
  forum: {
    name: 'Diễn đàn & Q&A',
    icon: 'FaCommentDots',
    description: 'Quản lý chuyên mục, câu hỏi, bình luận trên diễn đàn',
    permissions: [
      { key: 'view_topics', label: 'Xem chuyên mục', description: 'Xem danh sách chuyên mục', allowedRanks: ['staff', 'manager'] },
      { key: 'create_topic', label: 'Tạo chuyên mục', description: 'Tạo chuyên mục mới', allowedRanks: ['manager'] },
      { key: 'edit_topic', label: 'Sửa chuyên mục', description: 'Chỉnh sửa chuyên mục', allowedRanks: ['manager'] },
      { key: 'delete_topic', label: 'Xóa chuyên mục', description: 'Xóa chuyên mục', allowedRanks: ['manager'] },
      { key: 'hide_topic', label: 'Ẩn chuyên mục', description: 'Ẩn chuyên mục khỏi công khai', allowedRanks: ['manager'] },
      { key: 'view_questions', label: 'Xem câu hỏi', description: 'Xem danh sách câu hỏi', allowedRanks: ['staff', 'manager'] },
      { key: 'create_question', label: 'Tạo câu hỏi', description: 'Tạo câu hỏi mới', allowedRanks: ['staff', 'manager'] },
      { key: 'comment_question', label: 'Bình luận', description: 'Trả lời hoặc bình luận câu hỏi', allowedRanks: ['staff', 'manager'] },
      { key: 'save_question', label: 'Lưu câu hỏi', description: 'Lưu câu hỏi để xử lý sau', allowedRanks: ['staff', 'manager'] },
      { key: 'interact_question', label: 'Tương tác', description: 'Tương tác với câu hỏi', allowedRanks: ['staff', 'manager'] },
      { key: 'report_question', label: 'Báo cáo', description: 'Báo cáo câu hỏi vi phạm', allowedRanks: ['staff', 'manager'] },
      { key: 'search_question', label: 'Tìm kiếm', description: 'Tìm kiếm câu hỏi', allowedRanks: ['staff', 'manager'] },
      { key: 'approve_question', label: 'Phê duyệt câu hỏi', description: 'Phê duyệt câu hỏi từ cộng đồng', allowedRanks: ['manager'] },
      { key: 'hide_question', label: 'Ẩn câu hỏi', description: 'Ẩn câu hỏi khỏi công khai', allowedRanks: ['manager'] },
      { key: 'delete_question', label: 'Xóa câu hỏi', description: 'Xóa câu hỏi vi phạm', allowedRanks: ['manager'] },
      { key: 'moderate_questions', label: 'Kiểm duyệt', description: 'Kiểm duyệt bình luận, nội dung', allowedRanks: ['manager'] }
    ]
  },

  // Reports management for forum (view and handle reports)
  // These actions back the /forum/reports endpoints and report handling UI
  forum_reports: {
    name: 'Báo cáo diễn đàn',
    icon: 'FaFlag',
    description: 'Xem và xử lý báo cáo vi phạm trên diễn đàn',
    permissions: [
      { key: 'view_reports', label: 'Xem báo cáo', description: 'Xem danh sách báo cáo từ người dùng', allowedRanks: ['staff', 'manager'] },
      { key: 'handle_reports', label: 'Xử lý báo cáo', description: 'Xử lý/hủy/ẩn/xóa báo cáo', allowedRanks: ['manager'] },
      { key: 'assign_moderators', label: 'Giao điều phối viên', description: 'Phân công moderator cho topic', allowedRanks: ['manager'] },
      { key: 'toggle_topic', label: 'Bật/tắt chuyên mục', description: 'Bật/tắt hiển thị chuyên mục', allowedRanks: ['manager'] }
    ]
  },

  community: {
    name: 'Nhóm cộng đồng',
    icon: 'FaUsers',
    description: 'Quản lý các nhóm cộng đồng, thành viên nhóm',
    permissions: [
      { key: 'view', label: 'Xem danh sách', description: 'Xem danh sách nhóm cộng đồng', allowedRanks: ['staff', 'manager'] },
      { key: 'create', label: 'Tạo nhóm', description: 'Tạo nhóm cộng đồng mới', allowedRanks: ['manager'] },
      { key: 'edit', label: 'Sửa', description: 'Chỉnh sửa thông tin nhóm', allowedRanks: ['manager'] },
      { key: 'manage_members', label: 'Quản lý thành viên', description: 'Thêm/xóa thành viên nhóm', allowedRanks: ['manager'] },
      { key: 'moderate_posts', label: 'Kiểm duyệt bài viết', description: 'Phê duyệt bài viết trong nhóm', allowedRanks: ['manager'] }
    ]
  },

  // ========================================
  // THANH TOÁN & TÀI CHÍNH
  // ========================================
  payments: {
    name: 'Quản lý thanh toán',
    icon: 'FaMoneyBillWave',
    description: 'Quản lý giao dịch, đối soát, hoàn tiền, POS',
    permissions: [
      { key: 'view', label: 'Xem danh sách', description: 'Xem danh sách giao dịch', allowedRanks: ['staff', 'manager'] },
      { key: 'pos', label: 'Quầy Tiếp Đón (POS)', description: 'Sử dụng quầy thanh toán', allowedRanks: ['staff'] },
      { key: 'verify', label: 'Xác nhận', description: 'Xác nhận giao dịch', allowedRanks: ['staff', 'manager'] },
      { key: 'approve', label: 'Phê duyệt', description: 'Phê duyệt giao dịch', allowedRanks: ['manager'] },
      { key: 'refund', label: 'Hoàn tiền', description: 'Xử lý hoàn tiền', allowedRanks: ['manager'] },
      { key: 'config_refund', label: 'Cấu hình hoàn tiền', description: 'Cấu hình quy trình hoàn tiền', allowedRanks: ['manager'] },
      { key: 'export', label: 'Xuất báo cáo', description: 'Xuất báo cáo thanh toán', allowedRanks: ['manager'] }
    ]
  },

  refund_requests: {
    name: 'Danh sách hoàn tiền',
    icon: 'FaMoneyCheckAlt',
    description: 'Quản lý các yêu cầu hoàn tiền từ bệnh nhân',
    permissions: [
      { key: 'view', label: 'Xem danh sách', description: 'Xem danh sách yêu cầu hoàn tiền', allowedRanks: ['staff', 'manager'] },
      { key: 'approve', label: 'Phê duyệt', description: 'Phê duyệt hoàn tiền', allowedRanks: ['manager'] },
      { key: 'reject', label: 'Từ chối', description: 'Từ chối yêu cầu hoàn tiền', allowedRanks: ['manager'] }
    ]
  },

  statistics: {
    name: 'Thống kê & Báo cáo',
    icon: 'FaChartBar',
    description: 'Xem thống kê, doanh thu, báo cáo kinh doanh',
    permissions: [
      { key: 'view', label: 'Xem báo cáo', description: 'Xem thống kê chung', allowedRanks: ['staff', 'manager'] },
      { key: 'revenue', label: 'Thống kê doanh thu', description: 'Xem báo cáo doanh thu', allowedRanks: ['manager'] },
      { key: 'export', label: 'Xuất dữ liệu', description: 'Xuất báo cáo ra file', allowedRanks: ['manager'] }
    ]
  },

  // ========================================
  // DỊCH VỤ Y TẾ
  // ========================================
  services: {
    name: 'Dịch vụ y tế',
    icon: 'FaBriefcaseMedical',
    description: 'Quản lý dịch vụ, gói dịch vụ khám chữa bệnh',
    permissions: [
      { key: 'view', label: 'Xem danh sách', description: 'Xem danh sách dịch vụ', allowedRanks: ['staff', 'manager', 'doctor'] },
      { key: 'create', label: 'Tạo mới', description: 'Thêm dịch vụ', allowedRanks: ['manager'] },
      { key: 'edit', label: 'Sửa', description: 'Chỉnh sửa dịch vụ', allowedRanks: ['manager'] },
      { key: 'delete', label: 'Xóa', description: 'Xóa dịch vụ', allowedRanks: ['manager'] },
      { key: 'set_price', label: 'Đặt giá', description: 'Cập nhật giá dịch vụ', allowedRanks: ['manager'] }
    ]
  },

  service_categories: {
    name: 'Danh mục dịch vụ',
    icon: 'FaThList',
    description: 'Quản lý danh mục loại dịch vụ',
    permissions: [
      { key: 'view', label: 'Xem danh sách', description: 'Xem danh sách danh mục', allowedRanks: ['staff', 'manager'] },
      { key: 'create', label: 'Tạo mới', description: 'Tạo danh mục mới', allowedRanks: ['manager'] },
      { key: 'edit', label: 'Sửa', description: 'Chỉnh sửa danh mục', allowedRanks: ['manager'] },
      { key: 'delete', label: 'Xóa', description: 'Xóa danh mục', allowedRanks: ['manager'] }
    ]
  },

  // ========================================
  // SỰ KIỆN & KHUYẾN MÃI
  // ========================================
  events_vouchers: {
    name: 'Sự kiện & Khuyến mãi',
    icon: 'FaBullhorn',
    description: 'Quản lý sự kiện, voucher, mã giảm giá, vòng quay',
    permissions: [
      { key: 'view_events', label: 'Xem sự kiện', description: 'Xem danh sách sự kiện', allowedRanks: ['staff', 'manager'] },
      { key: 'create_event', label: 'Tạo sự kiện', description: 'Tạo sự kiện mới', allowedRanks: ['manager'] },
      { key: 'edit_event', label: 'Sửa sự kiện', description: 'Chỉnh sửa sự kiện', allowedRanks: ['manager'] },
      { key: 'delete_event', label: 'Xóa sự kiện', description: 'Xóa sự kiện', allowedRanks: ['manager'] },
      { key: 'view_vouchers', label: 'Xem voucher', description: 'Xem danh sách voucher', allowedRanks: ['staff', 'manager'] },
      { key: 'create_voucher', label: 'Tạo voucher', description: 'Tạo mã giảm giá', allowedRanks: ['manager'] },
      { key: 'edit_voucher', label: 'Sửa voucher', description: 'Chỉnh sửa voucher', allowedRanks: ['manager'] },
      { key: 'delete_voucher', label: 'Xóa voucher', description: 'Xóa voucher', allowedRanks: ['manager'] },
      { key: 'create_game', label: 'Tạo vòng quay', description: 'Tạo game vòng quay may mắn', allowedRanks: ['manager'] },
      { key: 'config_rewards', label: 'Cấu hình phần thưởng', description: 'Cấu hình hệ thống phần thưởng', allowedRanks: ['manager'] }
    ]
  },

  // ========================================
  // LIÊN HỆ & HỖ TRỢ
  // ========================================
  contact: {
    name: 'Quản lý liên hệ',
    icon: 'FaEnvelope',
    description: 'Quản lý thông tin liên hệ, tin nhắn từ khách hàng',
    permissions: [
      { key: 'view', label: 'Xem tin nhắn', description: 'Xem danh sách tin nhắn liên hệ', allowedRanks: ['staff', 'manager'] },
      { key: 'reply', label: 'Trả lời', description: 'Trả lời tin nhắn từ khách', allowedRanks: ['staff', 'manager'] },
      { key: 'mark_read', label: 'Đánh dấu đã đọc', description: 'Đánh dấu tin nhắn', allowedRanks: ['staff', 'manager'] },
      { key: 'delete', label: 'Xóa', description: 'Xóa tin nhắn', allowedRanks: ['manager'] }
    ]
  },

  // ========================================
  // QUẢN LÝ HỆ THỐNG & CẤU HÌNH
  // ========================================
  system_settings: {
    name: 'Cấu hình hệ thống',
    icon: 'FaCogs',
    description: 'Quản lý cấu hình website, email, thanh toán, gì đó',
    permissions: [
      { key: 'view', label: 'Xem cấu hình', description: 'Xem cấu hình hệ thống', allowedRanks: ['staff', 'manager'] },
      { key: 'view_audit_logs', label: 'Xem audit logs', description: 'Xem lịch sử thay đổi hệ thống', allowedRanks: ['staff', 'manager'] },
      { key: 'edit_home', label: 'Sửa trang chủ', description: 'Chỉnh sửa nội dung trang chủ', allowedRanks: ['manager'] },
      { key: 'edit_about', label: 'Sửa About', description: 'Chỉnh sửa trang giới thiệu', allowedRanks: ['manager'] },
      { key: 'edit_facilities', label: 'Sửa cơ sở vật chất', description: 'Chỉnh sửa thông tin cơ sở', allowedRanks: ['manager'] },
      { key: 'edit_equipment', label: 'Sửa trang bị', description: 'Chỉnh sửa danh sách thiết bị', allowedRanks: ['manager'] },
      { key: 'edit_header_footer', label: 'Sửa Header/Footer', description: 'Chỉnh sửa header và footer', allowedRanks: ['manager'] },
      { key: 'edit_contact', label: 'Sửa thông tin liên hệ', description: 'Chỉnh sửa địa chỉ, điện thoại...', allowedRanks: ['manager'] },
      { key: 'edit_privacy', label: 'Sửa Privacy Policy', description: 'Chỉnh sửa chính sách bảo mật', allowedRanks: ['manager'] },
      { key: 'edit_terms', label: 'Sửa Terms & Conditions', description: 'Chỉnh sửa điều khoản sử dụng', allowedRanks: ['manager'] },
      { key: 'edit_email', label: 'Cấu hình Email', description: 'Cấu hình SMTP, email mẫu', allowedRanks: ['manager'] },
      { key: 'edit_payment', label: 'Cấu hình Thanh toán', description: 'Cấu hình gateway, API payment', allowedRanks: ['manager'] }
    ]
  },

  staff_management: {
    name: 'Quản lý nhân viên',
    icon: 'FaUserTie',
    description: 'Quản lý nhân viên, phân quyền, phòng ban',
    permissions: [
      { key: 'view', label: 'Xem danh sách', description: 'Xem danh sách nhân viên', allowedRanks: ['staff', 'manager'] },
      { key: 'create', label: 'Tạo nhân viên', description: 'Tạo tài khoản nhân viên mới', allowedRanks: ['manager'] },
      { key: 'edit', label: 'Sửa thông tin', description: 'Chỉnh sửa thông tin nhân viên', allowedRanks: ['manager'] },
      { key: 'delete', label: 'Xóa', description: 'Xóa nhân viên', allowedRanks: ['manager'] },
      { key: 'assign_department', label: 'Phân phòng ban', description: 'Phân công nhân viên vào phòng ban', allowedRanks: ['manager'] },
      { key: 'assign_permissions', label: 'Phân quyền', description: 'Cấp quyền cho nhân viên', allowedRanks: ['manager'] },
      { key: 'view_history', label: 'Xem lịch sử', description: 'Xem lịch sử thay đổi phân quyền', allowedRanks: ['manager'] }
    ]
  }
};

module.exports = PERMISSION_MODULES;
