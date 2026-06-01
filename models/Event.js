const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Event = sequelize.define('Event', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, unique: true },
    
    // --- PHÂN LOẠI ---
    event_type: { 
      type: DataTypes.ENUM('event', 'promotion', 'notification', 'news'), 
      defaultValue: 'event',
      comment: 'Loại: Sự kiện, Khuyến mãi, Thông báo, Tin tức'
    },

    // --- NỘI DUNG ---
    description: { type: DataTypes.TEXT }, 
    content: { type: DataTypes.TEXT('long') },
    
    // --- MEDIA (HÌNH ẢNH) ---
    thumbnail: { type: DataTypes.STRING, comment: 'Ảnh nhỏ hiện ở danh sách/popup' }, 
    banner_url: { type: DataTypes.STRING, comment: 'Ảnh lớn ở trang chi tiết' },
    gallery: { 
  type: DataTypes.JSON, 
  defaultValue: [],
  get() {
    const rawValue = this.getDataValue('gallery');
    return rawValue ? (typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue) : [];
  },
  set(val) {
    this.setDataValue('gallery', Array.isArray(val) ? val : []);
  },
  comment: 'Mảng chứa URL ảnh album'
},
    
    // --- THỜI GIAN & TRẠNG THÁI ---
    start_date: { type: DataTypes.DATE, allowNull: false },
    end_date: { type: DataTypes.DATE, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: {
      type: DataTypes.ENUM('draft', 'pending', 'approved', 'scheduled', 'ongoing', 'ended', 'cancelled', 'postponed'),
      defaultValue: 'draft',
      comment: 'Trạng thái workflow: nháp → chờ duyệt → đã duyệt → lên lịch → đang diễn ra → kết thúc'
    },
    event_category: {
      type: DataTypes.ENUM('workshop', 'free_exam', 'blood_donation', 'livestream', 'webinar', 'vaccination', 'promotion', 'launch', 'charity', 'internal', 'minigame', 'course'),
      defaultValue: 'workshop',
      comment: 'Phân loại chi tiết loại hình sự kiện'
    },
    format: {
      type: DataTypes.ENUM('offline', 'online', 'hybrid'),
      defaultValue: 'offline'
    },
    online_config: {
      type: DataTypes.JSON,
      defaultValue: null,
      comment: 'Link Zoom/Meet, password, link livestream nếu online'
    },
    registration_limit: { type: DataTypes.INTEGER, defaultValue: null, comment: 'Giới hạn số người đăng ký, null = không giới hạn' },
    registration_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    registration_open_at: { type: DataTypes.DATE, defaultValue: null },
    registration_close_at: { type: DataTypes.DATE, defaultValue: null },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal'
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
      get() {
        const v = this.getDataValue('tags');
        if (!v) return [];
        try { 
          return typeof v === 'string' ? JSON.parse(v) : v; 
        } catch (e) { 
          return []; 
        }
      }
    },

    // --- CẤU HÌNH POPUP NÂNG CAO ---
    is_popup: { type: DataTypes.BOOLEAN, defaultValue: false },
    popup_config: {
      type: DataTypes.JSON,
      defaultValue: {
        delay: 0, // Giây
        frequency: 'once_per_day', // once_per_session, always
        display_pages: ['home'] // home, all
      }
    },

    // --- CẤU HÌNH CTA (NÚT HÀNH ĐỘNG) ---
    cta_config: {
      type: DataTypes.JSON,
      defaultValue: {
        text: 'Xem chi tiết',
        link: '', // Nếu rỗng sẽ link vào trang chi tiết sự kiện
        type: 'internal' // internal, external, booking
      }
    },

    location: { type: DataTypes.STRING },

    // --- CẤU HÌNH TỔ CHỨC OFFLINE ---
    offline_config: {
      type: DataTypes.JSON,
      defaultValue: null,
      comment: 'Lưu thông tin chi nhánh, map url, sơ đồ tầng, bãi đỗ xe'
    },

    // --- ĐĂNG KÝ & THANH TOÁN ---
    is_fee_required: { type: DataTypes.BOOLEAN, defaultValue: false },
    fee_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    is_guest_allowed: { type: DataTypes.BOOLEAN, defaultValue: false },

    // --- QUẢN LÝ QUÀ TẶNG ---
    gift_config: {
      type: DataTypes.JSON,
      defaultValue: null,
      comment: 'Cấu hình quà tặng (vd: { has_gift: true, promotion_id: 1, type: "voucher" })'
    },
    
    // --- THỐNG KÊ ---
    views: { type: DataTypes.INTEGER, defaultValue: 0 },
    clicks: { type: DataTypes.INTEGER, defaultValue: 0 },

    // --- QUẢNG CÁO TRANG CHỦ ---
    is_banner_ad: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: false,
      comment: 'Hiển thị banner quảng cáo nổi bật trên trang chủ' 
    },
    banner_ad_config: {
      type: DataTypes.JSON,
      defaultValue: { label: 'Sự kiện nổi bật', cta_text: 'Tìm hiểu ngay', badge: '' },
      comment: 'Cấu hình nhãn, nút CTA, badge badge của banner quảng cáo'
    }
  }, {
    tableName: 'events',
    underscored: true
  });

  Event.associate = (models) => {
    Event.hasMany(models.EventRegistration, { foreignKey: 'event_id', as: 'registrations' });
  };

  return Event;
};