// server/controllers/systemController.js
const { models, sequelize } = require('../config/db');

exports.getSettings = async (req, res) => {
  // Helper function để trả về default settings
function getDefaultSettings(page) {
  const defaults = {
    // --- THÊM MỚI DEFAULT CHO HOÀN TIỀN ---
    'refund_policy': {
      enable_refund: true,
      min_cancel_hours: 6, // THÊM CẤU HÌNH THỜI GIAN TỐI THIỂU CHO PHÉP HỦY LỊCH (GIỜ)
      processing_time_text: '3-5 ngày làm việc',
      // --- THÊM PHẦN NÀY ---
      system_fault: {
          doctor_cancel_refund: 100,
          tech_issue_refund: 100
      },
      // --------------------
      consultation: {
        booking_fee: 0,
        rules: [
          { hours_before: 24, refund_percent: 100 }, // Hủy trước 24h hoàn 100%
          { hours_before: 12, refund_percent: 50 },  // Hủy trước 12h hoàn 50%
          { hours_before: 0, refund_percent: 0 }     // Hủy sát giờ mất cọc
        ]
      },
      appointment: {
        booking_fee: 50000, // Phí giữ chỗ cố định
        rules: [
          { hours_before: 48, refund_percent: 100 },
          { hours_before: 24, refund_percent: 80 },
          { hours_before: 0, refund_percent: 0 }
        ]
      }
    },
    // --------------------------------------
    'header-nav-footer': {
      header: {
        phone: '1900 1234',
        email: 'contact@easymedify.vn',
        working_hours: 'T2-T7: 7:00-20:00 | CN: 8:00-17:00',
        welcome_text: 'Chào mừng bạn đến với Easy Medify'
      },
      navbar: {
        logo_text: 'Easy Medify',
        logo_image: ''
      },
      footer: {
        about: 'Hệ thống y tế hàng đầu',
        contact: {}
      }
    },
    'contact': {
      hero: {
        title: 'Liên hệ với chúng tôi',
        subtitle: 'Chúng tôi luôn sẵn sàng lắng nghe và hỗ trợ bạn 24/7',
        background_image: '',
        banner_images: [],
        banner_color: '',
        banner_interval: 4000
      },
      info_cards: [
        {
          icon: 'FaPhone',
          title: 'Điện thoại',
          details: ['Hotline: 1900 1234', 'Cấp cứu: 115'],
          color: '#10b981'
        },
        {
          icon: 'FaEnvelope',
          title: 'Email',
          details: ['contact@easymedify.vn', 'support@easymedify.vn'],
          color: '#3b82f6'
        },
        {
          icon: 'FaMapMarkerAlt',
          title: 'Địa chỉ',
          details: ['123 Nguyễn Huệ, Q.1, TP.HCM', 'Thứ 2 - Thứ 7: 7:00 - 20:00'],
          color: '#f59e0b'
        },
        {
          icon: 'FaClock',
          title: 'Giờ làm việc',
          details: ['T2-T7: 7:00 - 20:00', 'CN: 8:00 - 17:00'],
          color: '#8b5cf6'
        }
      ],
      branches: [
        {
          name: 'Cơ sở chính - Quận 1',
          address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
          phone: '(028) 3822 1234',
          hours: 'T2-T7: 7:00-20:00 | CN: 8:00-17:00',
          map_embed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.4827!2d106.7!3d10.77!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTDCsDQ2JzEyLjAiTiAxMDbCsDQyJzAwLjAiRQ!5e0!3m2!1svi!2s!4v1',
          lat: 10.7769,
          lng: 106.7009,
          is_main: true
        }
      ],
      departments: [
        { name: 'Khoa Nội', phone: '(028) 3822 1235' },
        { name: 'Khoa Ngoại', phone: '(028) 3822 1236' },
        { name: 'Khoa Nhi', phone: '(028) 3822 1237' },
        { name: 'Khoa Sản', phone: '(028) 3822 1238' }
      ],
      faqs: [
        {
          question: 'Làm thế nào để đặt lịch khám?',
          answer: 'Bạn có thể đặt lịch khám qua website, ứng dụng di động hoặc gọi hotline 1900 1234.'
        },
        {
          question: 'Phòng khám có hỗ trợ bảo hiểm y tế không?',
          answer: 'Có, chúng tôi chấp nhận tất cả các loại bảo hiểm y tế hợp lệ theo quy định của nhà nước.'
        },
        {
          question: 'Kết quả xét nghiệm có thể xem online không?',
          answer: 'Có, sau khi hoàn thành xét nghiệm, kết quả sẽ được cập nhật lên hồ sơ y tế điện tử của bạn trong vòng 2-4 giờ.'
        }
      ],
      map_embed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.4827!2d106.7!3d10.77!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1',
      directions: [
        '🚇 Gần ga metro Bến Thành (300m đi bộ)',
        '🚌 Các tuyến bus: 03, 14, 36, 93',
        '🚗 Có bãi đỗ xe miễn phí 2 giờ đầu',
        '🛺 Grab/Be đến địa chỉ: 123 Nguyễn Huệ, Q.1'
      ],
      social_links: {
        facebook: 'https://facebook.com/easymedify',
        instagram: 'https://instagram.com/easymedify',
        youtube: 'https://youtube.com/easymedify',
        zalo: ''
      },
      ratings: {
        overall: 4.8,
        total_reviews: 1250,
        breakdown: [
          { label: 'Đội ngũ y tế', score: 4.9 },
          { label: 'Cơ sở vật chất', score: 4.7 },
          { label: 'Thời gian chờ', score: 4.6 },
          { label: 'Giá cả', score: 4.8 }
        ]
      }
    },
    'services_page': {
      hospital_hero: {
        image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=2000',
        title: 'Dịch Vụ Y Tế Chuyên Sâu',
        subtitle: 'Trải nghiệm quy trình khám chữa bệnh hiện đại, tận tâm tại bệnh viện.'
      },
      consultation_hero: {
        image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=2000',
        title: 'Bác Sĩ Trực Tuyến 24/7',
        subtitle: 'Kết nối ngay với chuyên gia y tế qua Video / Chat — mọi lúc, mọi nơi.'
      },
      hero_stats: [
        { num: '500+', lbl: 'Bác sĩ' },
        { num: '200+', lbl: 'Dịch vụ' },
        { num: '50k+', lbl: 'Bệnh nhân' },
        { num: '4.9★', lbl: 'Đánh giá' }
      ],
      consultation_steps: [
        { num: '01', icon: 'FaUserPlus',     label: 'Chọn Bác sĩ',      desc: 'Tìm bác sĩ phù hợp với chuyên khoa và nhu cầu của bạn.' },
        { num: '02', icon: 'FaCalendarCheck',label: 'Đặt Lịch hẹn',     desc: 'Chọn khung giờ trống, xác nhận thông tin và thanh toán.' },
        { num: '03', icon: 'FaVideo',         label: 'Bắt đầu Tư vấn',  desc: 'Tham gia phòng tư vấn qua Video hoặc Chat đúng giờ hẹn.' }
      ],
      why_choose: [
        { icon: 'FaUserMd',    title: '500+ Bác Sĩ Giỏi',  desc: 'Đội ngũ chuyên gia đầu ngành từ các bệnh viện lớn.', color: '#0ea5a4' },
        { icon: 'FaBolt',      title: 'Kết Nối Tức Thì',    desc: 'Không xếp hàng, kết nối bác sĩ chỉ sau vài giây.',  color: '#f39c12' },
        { icon: 'FaShieldAlt', title: 'Bảo Mật Tuyệt Đối', desc: 'Hồ sơ bệnh án được mã hóa chuẩn quốc tế.',          color: '#3b82f6' },
        { icon: 'FaWallet',    title: 'Chi Phí Hợp Lý',     desc: 'Tiết kiệm chi phí đi lại và thời gian chờ đợi.',    color: '#8b5cf6' }
      ],
      hospital_cta: {
        title: 'Cần hỗ trợ chọn dịch vụ?',
        subtitle: 'Đội ngũ tư vấn của chúng tôi sẵn sàng giúp bạn 24/7.',
        phone: '1900 1234'
      },
      consultation_cta: {
        title: 'Sẵn sàng gặp bác sĩ ngay hôm nay?',
        subtitle: 'Đặt lịch chỉ mất 2 phút. Tư vấn bắt đầu trong 15 phút.'
      }
    },
    'home': {
      bannerSlides: [
        {
          title: 'Chăm Sóc Sức Khỏe Toàn Diện',
          subtitle: 'Đội ngũ bác sĩ giàu kinh nghiệm',
          description: 'Chúng tôi cam kết mang đến dịch vụ y tế chất lượng cao với đội ngũ bác sĩ chuyên nghiệp',
          image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200',
          buttonText: 'Đặt lịch ngay',
          buttonLink: '/dat-lich-hen',
          buttonColor: '#10b981',
          buttonIcon: 'FaCalendarAlt'
        }
      ],
      features: [
        {
          title: 'Đặt lịch online',
          description: 'Đặt lịch khám bệnh dễ dàng, nhanh chóng',
          icon: 'FaCalendarCheck',
          iconBgColor: '#10b981'
        },
        {
          title: 'Bác sĩ giàu kinh nghiệm',
          description: 'Đội ngũ bác sĩ chuyên môn cao',
          icon: 'FaUserMd',
          iconBgColor: '#3b82f6'
        },
        {
          title: 'Tư vấn trực tuyến',
          description: 'Tư vấn sức khỏe từ xa tiện lợi',
          icon: 'FaComments',
          iconBgColor: '#f59e0b'
        },
        {
          title: 'Theo dõi sức khỏe',
          description: 'Quản lý hồ sơ y tế cá nhân',
          icon: 'FaHeartbeat',
          iconBgColor: '#ef4444'
        }
      ],
      aboutSection: {
        title: 'Về Chúng Tôi',
        image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800',
        alt: 'Về chúng tôi',
        yearsExperience: '10+',
        highlights: [
          {
            title: 'Đội ngũ chuyên môn cao',
            description: 'Bác sĩ giàu kinh nghiệm, tận tâm',
            icon: 'FaAward'
          },
          {
            title: 'Trang thiết bị hiện đại',
            description: 'Công nghệ y tế tiên tiến nhất',
            icon: 'FaMicroscope'
          }
        ],
        buttonText: 'Tìm hiểu thêm',
        buttonLink: '/gioi-thieu'
      },
      testimonials: [
        {
          name: 'Nguyễn Văn A',
          role: 'Bệnh nhân',
          comment: 'Dịch vụ tuyệt vời, bác sĩ rất tận tâm',
          rating: 5,
          avatar: 'https://i.pravatar.cc/150?img=1',
          alt: 'Nguyễn Văn A'
        }
      ],
      bookingSection: {
        title: 'Đặt Lịch Khám Bệnh',
        description: 'Điền thông tin để đặt lịch khám',
        features: [
          {
            text: 'Xác nhận nhanh chóng',
            icon: 'FaCheckCircle'
          }
        ],
        hotline: '1900 1234',
        email: 'contact@easymedify.vn',
        address: 'Hồ Chí Minh'
      }
    }
  };

  return defaults[page] || {};
}
  const { page } = req.params;
  try {
    console.log(`[systemController] GET Settings cho page: ${page}`);
    
    if (!page) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số page' });
    }
    
    // Kiểm tra model tồn tại
    if (!models.SystemSetting) {
      console.error('[systemController] ERROR: Model SystemSetting không tồn tại!');
      return res.status(500).json({ 
        success: false, 
        message: 'Lỗi hệ thống: Model không được định nghĩa' 
      });
    }
    
    const setting = await models.SystemSetting.findOne({ 
      where: { setting_key: page } 
    });
    
    if (setting) {
      console.log(`[systemController] Tìm thấy setting cho ${page}:`, setting.value_json);
      res.json(setting.value_json || {});
    } else {
      console.log(`[systemController] Không tìm thấy setting cho ${page}, trả về default data`);
      
      // Trả về default data thay vì empty object
      const defaultData = getDefaultSettings(page);
      res.json(defaultData);
    }
  } catch (error) {
    console.error(`[systemController] Lỗi khi lấy cài đặt cho page ${page}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi máy chủ', 
      error: error.message 
    });
  }
};


exports.updateSettings = async (req, res) => {
  const { page } = req.params;
  const data = req.body;
  try {
    console.log(`[systemController] PUT Settings cho page: ${page}`);
    
    // 1. Kiểm tra dữ liệu đầu vào
    if (!page) {
      return res.status(400).json({ success: false, message: 'Thiếu tham số page' });
    }
    
    // 2. Kiểm tra User (Staff IT hoặc Admin)
    if (!req.user || !req.user.id) {
      console.error('[systemController] Không tìm thấy user ID trong request');
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ' });
    }

    // 3. Tìm cài đặt hiện tại trong DB
    let setting = await models.SystemSetting.findOne({ 
      where: { setting_key: page } 
    });

    if (setting) {
      // === TRƯỜNG HỢP 1: ĐÃ CÓ -> CẬP NHẬT ===
      console.log(`[systemController] Đang cập nhật setting: ${page}`);
      
      // ✅ LƯU GIÁ TRỊ CŨ TRƯỚC KHI CẬP NHẬT (để so sánh trong audit log)
      const oldValue = JSON.parse(JSON.stringify(setting.value_json || {}));
      
      setting.value_json = data;          // Cập nhật dữ liệu JSON
      setting.updated_by = req.user.id;   // Cập nhật người sửa
      
      // --- BẮT ĐẦU ĐOẠN SỬA ---
      try {
        await setting.save(); 
      } catch (saveError) {
        // Nếu lỗi do ràng buộc chỉ cho Admin sửa (Lỗi FK), ta sẽ lưu null thay vì crash
        if (saveError.name === 'SequelizeForeignKeyConstraintError') {
          console.warn('[systemController] ⚠️ Database chỉ cho phép Admin update. Đang lưu với updated_by = null...');
          setting.updated_by = null; // Bỏ qua việc lưu ID người sửa
          await setting.save();      // Lưu lại lần nữa
        } else {
          throw saveError; // Nếu lỗi khác thì ném ra ngoài
        }
      }
      // --- KẾT THÚC ĐOẠN SỬA ---
      
      // ✅ LƯU OLD VALUE VÀO SETTING ĐỂ SỬ DỤNG SAU
      setting._oldValue = oldValue;
    } else {
      // === TRƯỜNG HỢP 2: CHƯA CÓ -> TẠO MỚI ===
      console.log(`[systemController] Đang tạo mới setting: ${page}`);
      
      try {
        setting = await models.SystemSetting.create({
          setting_key: page,
          value_json: data,
          updated_by: req.user.id
        });
      } catch (createError) {
         if (createError.name === 'SequelizeForeignKeyConstraintError') {
            console.warn('[systemController] ⚠️ Retry create với updated_by = null');
            setting = await models.SystemSetting.create({
              setting_key: page,
              value_json: data,
              updated_by: null
            });
         } else {
            throw createError;
         }
      }
    }
    
    console.log(`[systemController] ✅ Lưu thành công setting cho ${page}`);
    
    // ========== TẠO AUDIT LOG ==========
    try {
      // Lấy giá trị cũ để so sánh (nếu là update)
      const oldValue = setting._oldValue || {};
      const newValue = data;
      
      // Tìm các trường thực sự thay đổi
      const changedFields = [];
      
      // Helper function: So sánh 2 giá trị
      const hasChanged = (oldVal, newVal) => {
        return JSON.stringify(oldVal) !== JSON.stringify(newVal);
      };
      
      // Phân tích theo từng page để tạo mô tả cụ thể
      if (page === 'header-nav-footer') {
        if (hasChanged(oldValue.header, newValue.header)) {
          changedFields.push('Header (điện thoại, email, giờ làm việc)');
        }
        if (hasChanged(oldValue.navbar, newValue.navbar)) {
          changedFields.push('Navbar (logo, menu)');
        }
        if (hasChanged(oldValue.footer, newValue.footer)) {
          changedFields.push('Footer (về chúng tôi, liên hệ, mạng xã hội)');
        }
      } else if (page === 'home') {
        if (hasChanged(oldValue.bannerSlides, newValue.bannerSlides)) {
          changedFields.push(`Banner (${newValue.bannerSlides?.length || 0} slides)`);
        }
        if (hasChanged(oldValue.features, newValue.features)) {
          changedFields.push(`Tính năng nổi bật (${newValue.features?.length || 0} items)`);
        }
        if (hasChanged(oldValue.aboutSection, newValue.aboutSection)) {
          changedFields.push('Giới thiệu ngắn');
        }
        if (hasChanged(oldValue.specialties, newValue.specialties)) {
          changedFields.push('Chuyên khoa');
        }
        if (hasChanged(oldValue.testimonials, newValue.testimonials)) {
          changedFields.push(`Đánh giá (${newValue.testimonials?.length || 0} items)`);
        }
        if (hasChanged(oldValue.stats, newValue.stats)) {
          changedFields.push('Thống kê');
        }
        if (hasChanged(oldValue.bookingSection, newValue.bookingSection)) {
          changedFields.push('Phần đặt lịch');
        }
      } else if (page === 'about') {
        if (hasChanged(oldValue.banner, newValue.banner)) {
          changedFields.push('Banner');
        }
        if (hasChanged(oldValue.mission, newValue.mission)) {
          changedFields.push('Sứ mệnh');
        }
        if (hasChanged(oldValue.vision, newValue.vision)) {
          changedFields.push('Tầm nhìn');
        }
        if (hasChanged(oldValue.milestones, newValue.milestones)) {
          changedFields.push(`Mốc thời gian (${newValue.milestones?.length || 0} items)`);
        }
        if (hasChanged(oldValue.values, newValue.values)) {
          changedFields.push(`Giá trị cốt lõi (${newValue.values?.length || 0} items)`);
        }
        if (hasChanged(oldValue.leadership, newValue.leadership)) {
          changedFields.push(`Ban lãnh đạo (${newValue.leadership?.length || 0} items)`);
        }
        if (hasChanged(oldValue.facilities, newValue.facilities)) {
          changedFields.push(`Cơ sở vật chất (${newValue.facilities?.length || 0} items)`);
        }
      } else if (page === 'facilities') {
        if (hasChanged(oldValue.banner, newValue.banner)) {
          changedFields.push('Banner');
        }
        if (hasChanged(oldValue.facilities, newValue.facilities)) {
          changedFields.push(`Danh sách cơ sở (${newValue.facilities?.length || 0} items)`);
        }
        if (hasChanged(oldValue.gallery, newValue.gallery)) {
          changedFields.push('Thư viện hình ảnh');
        }
      } else if (page === 'equipment') {
        if (hasChanged(oldValue.banner, newValue.banner)) {
          changedFields.push('Banner');
        }
        if (hasChanged(oldValue.equipment, newValue.equipment)) {
          changedFields.push(`Danh sách thiết bị (${newValue.equipment?.length || 0} items)`);
        }
        if (hasChanged(oldValue.quality, newValue.quality)) {
          changedFields.push(`Cam kết chất lượng (${newValue.quality?.length || 0} items)`);
        }
     } else if (page === 'contact') {
        if (hasChanged(oldValue.hero, newValue.hero)) {
          changedFields.push('Hero / Banner');
        }
        if (hasChanged(oldValue.info_cards, newValue.info_cards)) {
          changedFields.push(`Thẻ thông tin (${newValue.info_cards?.length || 0} items)`);
        }
        if (hasChanged(oldValue.faqs, newValue.faqs)) {
          changedFields.push(`FAQs (${newValue.faqs?.length || 0} items)`);
        }
        if (hasChanged(oldValue.map_embed, newValue.map_embed)) {
          changedFields.push('Bản đồ');
        }
        if (hasChanged(oldValue.directions, newValue.directions)) {
          changedFields.push('Hướng dẫn đi lại');
        }
        if (hasChanged(oldValue.branches, newValue.branches)) {
          changedFields.push(`Chi nhánh (${newValue.branches?.length || 0} items)`);
        }
        if (hasChanged(oldValue.social_links, newValue.social_links)) {
          changedFields.push('Mạng xã hội');
        }
      } else if (page === 'privacy') {
        if (hasChanged(oldValue.hero, newValue.hero)) {
          changedFields.push('Hero');
        }
        if (hasChanged(oldValue.sections, newValue.sections)) {
          changedFields.push(`Các phần nội dung (${newValue.sections?.length || 0} items)`);
        }
      } else if (page === 'terms') {
        if (hasChanged(oldValue.hero, newValue.hero)) {
          changedFields.push('Hero');
        }
        if (hasChanged(oldValue.intro, newValue.intro)) {
          changedFields.push('Giới thiệu');
        }
        if (hasChanged(oldValue.sections, newValue.sections)) {
          changedFields.push(`Các phần điều khoản (${newValue.sections?.length || 0} items)`);
        }
      } else {
        // Fallback: So sánh tất cả top-level keys
        Object.keys(newValue).forEach(key => {
          if (hasChanged(oldValue[key], newValue[key])) {
            changedFields.push(key);
          }
        });
      }
      
      // Nếu không có trường nào thay đổi, ghi "Không có thay đổi"
      const detailedFields = changedFields.length > 0 
        ? changedFields 
        : ['Không có thay đổi'];
      
      await models.AuditLog.create({
        user_id: req.user.id,
        action_type: 'settings_change',
        target_type: 'SystemSetting',
        target_id: setting.id,
        target_name: page,
        details: {
          page: page,
          action: setting.isNewRecord ? 'Tạo mới' : 'Cập nhật',
          updated_fields: detailedFields.join(', '),
          field_count: detailedFields.length,
          timestamp: new Date().toISOString()
        },
        ip_address: req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.headers['x-real-ip'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress || 
                   req.ip ||
                   'Unknown',
        user_agent: req.get('user-agent')
      });
      console.log(`[systemController] ✅ Đã tạo audit log cho ${page}`);
    } catch (auditError) {
      console.error('[systemController] ⚠️ Không thể tạo audit log:', auditError.message);
      // Không throw error để không ảnh hưởng đến việc lưu settings
    }
    // ====================================
    
    res.json({ 
      success: true, 
      message: 'Lưu cài đặt thành công',
      data: setting.value_json
    });

  } catch (error) {
    console.error(`[systemController] ❌ Lỗi NGHIÊM TRỌNG khi lưu ${page}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi máy chủ khi lưu cài đặt: ' + error.message, 
      error: error.message 
    });
  }
};
// Test endpoint để kiểm tra DB connection
exports.testDB = async (req, res) => {
  try {
    console.log('[systemController] Testing DB connection...');
    
    // Kiểm tra model
    if (!models.SystemSetting) {
      throw new Error('Model SystemSetting không tồn tại');
    }
    
    // Thử query
    const count = await models.SystemSetting.count();
    console.log(`[systemController] Tổng số settings trong DB: ${count}`);
    
    // Lấy tất cả settings
    const allSettings = await models.SystemSetting.findAll();
    console.log(`[systemController] Các settings hiện có:`, 
      allSettings.map(s => s.setting_key));
    
    res.json({
      success: true,
      message: 'Database kết nối thành công',
      totalSettings: count,
      settingKeys: allSettings.map(s => s.setting_key)
    });
  } catch (error) {
    console.error('[systemController] Lỗi test DB:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi kết nối database',
      error: error.message
    });
  }
};

// ==================== AUDIT LOGS ====================

/**
 * GET /api/system/audit-logs
 * Lấy danh sách audit logs với filter và pagination
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      action_type,
      page_type, // ✅ THÊM MỚI: filter theo loại trang (home, about, facilities, etc.)
      user_id,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      limit = 50, 
      offset = 0 
    } = req.query;

    const whereClause = {};
    
    // ✅ QUAN TRỌNG: Chỉ lấy logs của SystemSetting (loại bỏ logs phân quyền, v.v.)
    whereClause.target_type = 'SystemSetting';
    
    // Filter theo ngày
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at[sequelize.Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.created_at[sequelize.Op.lte] = end;
      }
    }

    // Filter theo action type
    if (action_type) {
      whereClause.action_type = action_type;
    }

    // ✅ THÊM MỚI: Filter theo loại trang
    if (page_type) {
      whereClause.target_name = page_type;
    }

    // Filter theo user
    if (user_id) {
      whereClause.user_id = user_id;
    }

    // Validate sortBy field
    const allowedSortFields = ['created_at', 'action_type', 'user_id'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows } = await models.AuditLog.findAndCountAll({
      where: whereClause,
      include: [{
        model: models.User,
        as: 'user',
        attributes: ['id', 'username', 'full_name', 'email', 'avatar_url']
      }],
      order: [[sortField, sortDirection]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: rows,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[systemController] Lỗi lấy audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách lịch sử',
      error: error.message
    });
  }
};

/**
 * GET /api/system/audit-logs/stats
 * Thống kê audit logs theo action type
 */
exports.getAuditStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const whereClause = {};
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[sequelize.Op.gte] = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.created_at[sequelize.Op.lte] = end;
      }
    }

    const stats = await models.AuditLog.findAll({
      where: whereClause,
      attributes: [
        'action_type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['action_type'],
      raw: true
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[systemController] Lỗi thống kê audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi thống kê lịch sử',
      error: error.message
    });
  }
};