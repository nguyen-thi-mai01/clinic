// server/config/defaultSystemSettings.js
// File chứa dữ liệu mặc định cho SystemSettings
// Import từ db.js: const { getDefaultSystemSettings } = require('./config/db');

const getDefaultSystemSettings = () => {
  return [
    // ======================= 1. HOME =======================
    {
      setting_key: 'home',
      value_json: {
        // Banner Slides (3-5 slides)
        bannerSlides: [
          {
            image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200',
            alt: 'Banner chăm sóc sức khỏe',
            title: 'Chăm Sóc Sức Khỏe Toàn Diện',
            subtitle: 'Đội ngũ bác sĩ giàu kinh nghiệm, tận tâm',
            description: 'Chúng tôi cam kết mang đến dịch vụ y tế chất lượng cao với công nghệ hiện đại',
            button_text: 'Đặt lịch ngay',
            button_link: '/dat-lich-kham',
            button_color: '#4CAF50'
          },
          {
            image: 'https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=1200',
            alt: 'Trang thiết bị hiện đại',
            title: 'Trang Thiết Bị Hiện Đại',
            subtitle: 'Công nghệ y tế tiên tiến nhất',
            description: 'Ứng dụng các thiết bị y tế 4.0 trong chẩn đoán và điều trị',
            button_text: 'Tìm hiểu thêm',
            button_link: '/thiet-bi',
            button_color: '#2196F3'
          },
          {
            image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200',
            alt: 'Tư vấn trực tuyến',
            title: 'Tư Vấn Sức Khỏe Trực Tuyến',
            subtitle: 'Bác sĩ luôn sẵn sàng 24/7',
            description: 'Nhận tư vấn sức khỏe từ xa, tiện lợi và nhanh chóng',
            button_text: 'Tư vấn ngay',
            button_link: '/tu-van-truc-tuyen',
            button_color: '#FF9800'
          },
          {
            image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=1200',
            alt: 'Gói khám sức khỏe',
            title: 'Gói Khám Sức Khỏe Ưu Đãi',
            subtitle: 'Nhiều gói khám hấp dẫn',
            description: 'Các gói khám sức khỏe tổng quát với mức giá ưu đãi đặc biệt',
            button_text: 'Xem gói khám',
            button_link: '/goi-kham',
            button_color: '#E91E63'
          }
        ],
        
        // Features (4-6 features)
        features: [
          {
            icon: 'FaCalendarCheck',
            icon_bg_color: '#4CAF50',
            title: 'Đặt lịch online',
            description: 'Đặt lịch khám bệnh dễ dàng, nhanh chóng chỉ với vài thao tác'
          },
          {
            icon: 'FaUserMd',
            icon_bg_color: '#2196F3',
            title: 'Bác sĩ giàu kinh nghiệm',
            description: 'Đội ngũ bác sĩ chuyên môn cao, được đào tạo bài bản'
          },
          {
            icon: 'FaStethoscope',
            icon_bg_color: '#FF9800',
            title: 'Khám chuyên khoa',
            description: 'Đầy đủ các chuyên khoa với trang thiết bị hiện đại'
          },
          {
            icon: 'FaHeartbeat',
            icon_bg_color: '#E91E63',
            title: 'Theo dõi sức khỏe',
            description: 'Hệ thống quản lý hồ sơ bệnh án điện tử an toàn'
          },
          {
            icon: 'FaComments',
            icon_bg_color: '#9C27B0',
            title: 'Tư vấn trực tuyến',
            description: 'Tư vấn sức khỏe từ xa qua video call tiện lợi'
          },
          {
            icon: 'FaAmbulance',
            icon_bg_color: '#F44336',
            title: 'Cấp cứu 24/7',
            description: 'Đội ngũ cấp cứu sẵn sàng phục vụ suốt 24/7'
          }
        ],
        
        // About Section
        aboutSection: {
          image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800',
          alt: 'Về chúng tôi',
          title: 'Về Easy Medify',
          yearsExperience: '10+',
          highlights: [
            {
              icon: 'FaAward',
              title: 'Đội ngũ chuyên môn cao',
              description: 'Hơn 100 bác sĩ giàu kinh nghiệm, tận tâm với bệnh nhân'
            },
            {
              icon: 'FaMicroscope',
              title: 'Trang thiết bị hiện đại',
              description: 'Công nghệ y tế tiên tiến nhất từ các nước phát triển'
            },
            {
              icon: 'FaCertificate',
              title: 'Chứng nhận quốc tế',
              description: 'Đạt chứng nhận JCI về chất lượng dịch vụ y tế'
            },
            {
              icon: 'FaShieldAlt',
              title: 'An toàn tuyệt đối',
              description: 'Quy trình khám chữa bệnh đảm bảo an toàn cao nhất'
            }
          ],
          buttonText: 'Tìm hiểu thêm',
          buttonLink: '/gioi-thieu'
        },
        
        // Testimonials (4-6 testimonials)
        testimonials: [
          {
            avatar: 'https://i.pravatar.cc/150?img=1',
            alt: 'Nguyễn Văn An',
            name: 'Nguyễn Văn An',
            role: 'Bệnh nhân',
            rating: 5,
            comment: 'Dịch vụ rất tốt, bác sĩ tận tâm và chu đáo. Tôi rất hài lòng với chất lượng khám chữa bệnh tại đây.'
          },
          {
            avatar: 'https://i.pravatar.cc/150?img=5',
            alt: 'Trần Thị Bình',
            name: 'Trần Thị Bình',
            role: 'Bệnh nhân',
            rating: 5,
            comment: 'Quy trình khám nhanh gọn, không phải chờ đợi lâu. Bác sĩ tư vấn rất kỹ càng và dễ hiểu.'
          },
          {
            avatar: 'https://i.pravatar.cc/150?img=12',
            alt: 'Lê Minh Châu',
            name: 'Lê Minh Châu',
            role: 'Bệnh nhân',
            rating: 5,
            comment: 'Trang thiết bị hiện đại, phòng khám sạch sẽ. Đặt lịch online rất tiện lợi.'
          },
          {
            avatar: 'https://i.pravatar.cc/150?img=15',
            alt: 'Phạm Quốc Dũng',
            name: 'Phạm Quốc Dũng',
            role: 'Bệnh nhân',
            rating: 5,
            comment: 'Bác sĩ chuyên khoa tim mạch rất giỏi, giải thích dễ hiểu. Cảm ơn đội ngũ y tá nhiệt tình.'
          },
          {
            avatar: 'https://i.pravatar.cc/150?img=20',
            alt: 'Hoàng Thị Em',
            name: 'Hoàng Thị Em',
            role: 'Bệnh nhân',
            rating: 4,
            comment: 'Dịch vụ tư vấn online rất tốt. Tiết kiệm được thời gian đi lại mà vẫn được tư vấn kỹ càng.'
          }
        ],
        
        // Booking Section
        bookingSection: {
          title: 'Đặt lịch khám bệnh',
          description: 'Điền thông tin bên dưới để đặt lịch khám. Chúng tôi sẽ liên hệ xác nhận trong thời gian sớm nhất.',
          features: [
            { icon: 'FaCheckCircle', text: 'Xác nhận nhanh chóng trong 30 phút' },
            { icon: 'FaBell', text: 'Nhắc lịch hẹn qua SMS và Email' },
            { icon: 'FaSync', text: 'Đổi lịch linh hoạt miễn phí' },
            { icon: 'FaPhoneVolume', text: 'Hỗ trợ tư vấn 24/7' }
          ],
          hotline: '1900 1234',
          email: 'contact@easymedify.vn',
          address: '123 Đường Nguyễn Văn Linh, Quận 7, TP.HCM'
        }
      }
    },

    // ======================= 2. ABOUT =======================
    {
      setting_key: 'about',
      value_json: {
        banner: {
          image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200',
          alt: 'Về chúng tôi',
          title: 'Về Easy Medify',
          subtitle: 'Hệ thống y tế hàng đầu Việt Nam',
          description: 'Chúng tôi cam kết mang đến dịch vụ chăm sóc sức khỏe chất lượng cao với đội ngũ y bác sĩ giàu kinh nghiệm'
        },
        mission: {
          image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600',
          alt: 'Sứ mệnh',
          icon: 'FaBullseye',
          title: 'Sứ Mệnh Của Chúng Tôi',
          description: 'Mang đến dịch vụ y tế chất lượng cao, an toàn và nhân văn cho cộng đồng. Chúng tôi không ngừng cải tiến và phát triển để trở thành người bạn đồng hành tin cậy trong việc chăm sóc sức khỏe của mọi gia đình Việt Nam.'
        },
        vision: {
          image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600',
          alt: 'Tầm nhìn',
          icon: 'FaEye',
          title: 'Tầm Nhìn',
          description: 'Trở thành hệ thống y tế hàng đầu khu vực Đông Nam Á với công nghệ hiện đại, dịch vụ xuất sắc và đội ngũ y bác sĩ chuyên nghiệp. Chúng tôi hướng tới việc ứng dụng công nghệ AI và y học 4.0 trong chẩn đoán và điều trị.'
        },
        milestones: [
          { year: '2014', event: 'Thành lập phòng khám đầu tiên tại TP.HCM' },
          { year: '2016', event: 'Mở rộng thành hệ thống 5 chi nhánh' },
          { year: '2019', event: 'Ra mắt dịch vụ tư vấn sức khỏe trực tuyến' },
          { year: '2021', event: 'Đầu tư trang thiết bị y tế hiện đại từ Nhật Bản' },
          { year: '2022', event: 'Đạt chứng nhận JCI về chất lượng dịch vụ y tế' },
          { year: '2024', event: 'Phát triển hệ thống AI hỗ trợ chẩn đoán bệnh' }
        ],
        stats: [
          { number: '10+', label: 'Năm kinh nghiệm' },
          { number: '100+', label: 'Bác sĩ chuyên khoa' },
          { number: '50,000+', label: 'Bệnh nhân tin tưởng' },
          { number: '15', label: 'Chi nhánh toàn quốc' },
          { number: '98%', label: 'Khách hàng hài lòng' }
        ],
        values: [
          { icon: 'FaGraduationCap', title: 'Chuyên nghiệp', description: 'Đội ngũ y bác sĩ được đào tạo bài bản, chuyên môn cao' },
          { icon: 'FaHeart', title: 'Tận tâm', description: 'Luôn đặt lợi ích và sức khỏe của bệnh nhân lên hàng đầu' },
          { icon: 'FaShieldAlt', title: 'Uy tín', description: 'Xây dựng niềm tin thông qua chất lượng dịch vụ' },
          { icon: 'FaRocket', title: 'Đổi mới', description: 'Không ngừng cải tiến, ứng dụng công nghệ hiện đại' },
          { icon: 'FaUsers', title: 'Đồng hành', description: 'Đồng hành cùng bệnh nhân trên hành trình chăm sóc sức khỏe' }
        ],
        leadership: [
          { image: 'https://i.pravatar.cc/300?img=12', alt: 'Giám đốc điều hành', name: 'PGS.TS. Nguyễn Văn A', position: 'Giám đốc điều hành', bio: 'Hơn 20 năm kinh nghiệm trong lĩnh vực y tế, từng công tác tại các bệnh viện lớn trong và ngoài nước.' },
          { image: 'https://i.pravatar.cc/300?img=5', alt: 'Giám đốc y khoa', name: 'TS.BS. Trần Thị B', position: 'Giám đốc y khoa', bio: 'Chuyên gia hàng đầu về tim mạch, nhiều năm nghiên cứu và giảng dạy tại các trường đại học y.' },
          { image: 'https://i.pravatar.cc/300?img=15', alt: 'Giám đốc điều dưỡng', name: 'ThS. Lê Thị C', position: 'Giám đốc điều dưỡng', bio: 'Đào tạo và quản lý đội ngũ điều dưỡng chuyên nghiệp, tận tâm với nghề.' }
        ],
        achievements: [
          { icon: 'FaTrophy', title: 'Top 10 phòng khám tư nhân uy tín', year: '2023', organization: 'Bộ Y tế' },
          { icon: 'FaMedal', title: 'Chứng nhận JCI quốc tế', year: '2022', organization: 'Joint Commission International' },
          { icon: 'FaAward', title: 'Giải thưởng Chất lượng dịch vụ', year: '2023', organization: 'Hội Bảo vệ người tiêu dùng' },
          { icon: 'FaStar', title: 'Top 5 dịch vụ y tế trực tuyến', year: '2024', organization: 'Vietnam Digital Awards' }
        ],
        facilities: [
          { image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=500', alt: 'Phòng khám', name: 'Phòng khám hiện đại', description: 'Được thiết kế theo tiêu chuẩn quốc tế, đảm bảo sự thoải mái cho bệnh nhân' },
          { image: 'https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=500', alt: 'Phòng xét nghiệm', name: 'Phòng xét nghiệm', description: 'Trang bị máy móc hiện đại, kết quả chính xác và nhanh chóng' },
          { image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=500', alt: 'Phòng phẫu thuật', name: 'Phòng phẫu thuật vô trùng', description: 'Đạt chuẩn vô trùng tuyệt đối, an toàn cho mọi ca phẫu thuật' },
          { image: 'https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=500', alt: 'Khu điều trị', name: 'Khu điều trị nội trú', description: 'Không gian yên tĩnh, tiện nghi để bệnh nhân nghỉ ngơi và hồi phục' }
        ]
      }
    },

    // ======================= 3. FACILITIES =======================
    {
      setting_key: 'facilities',
      value_json: {
        banner: {
          image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1200',
          alt: 'Cơ sở vật chất',
          title: 'Cơ Sở Vật Chất Hiện Đại',
          subtitle: 'Môi trường khám chữa bệnh chuyên nghiệp',
          description: 'Chúng tôi trang bị cơ sở vật chất đạt chuẩn quốc tế, mang đến sự thoải mái và an tâm cho bệnh nhân'
        },
        amenities: [
          { icon: 'FaWifi', title: 'Wifi miễn phí', description: 'Tốc độ cao trong toàn bộ khuôn viên' },
          { icon: 'FaParking', title: 'Bãi đậu xe rộng rãi', description: 'An toàn, có bảo vệ 24/7' },
          { icon: 'FaCoffee', title: 'Khu vực thư giãn', description: 'Phòng chờ thoải mái với đồ uống miễn phí' },
          { icon: 'FaAccessibleIcon', title: 'Thang máy, lối đi cho người khuyết tật', description: 'Thiết kế tiện lợi cho mọi đối tượng' },
          { icon: 'FaStore', title: 'Hiệu thuốc', description: 'Thuốc chính hãng, giá cả hợp lý' },
          { icon: 'FaUtensils', title: 'Căng tin', description: 'Phục vụ bữa ăn dinh dưỡng' }
        ],
        facilities: [
          { image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=500', alt: 'Phòng khám', name: 'Phòng khám đa khoa', area: '50m²', capacity: '5 giường', description: 'Thiết kế hiện đại, thoáng mát, riêng tư' },
          { image: 'https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=500', alt: 'Phòng xét nghiệm', name: 'Phòng xét nghiệm', area: '80m²', capacity: '10 vị trí', description: 'Trang bị máy móc hiện đại nhất' },
          { image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=500', alt: 'Phòng phẫu thuật', name: 'Phòng phẫu thuật', area: '60m²', capacity: '2 bàn mổ', description: 'Vô trùng tuyệt đối, công nghệ tiên tiến' },
          { image: 'https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=500', alt: 'Khu nội trú', name: 'Khu điều trị nội trú', area: '200m²', capacity: '20 giường', description: 'Tiện nghi như khách sạn' }
        ],
        gallery: [
          { image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400', alt: 'Sảnh chính', caption: 'Sảnh tiếp đón rộng rãi' },
          { image: 'https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=400', alt: 'Phòng chờ', caption: 'Khu vực chờ đợi thoải mái' },
          { image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=400', alt: 'Phòng khám', caption: 'Phòng khám riêng tư' },
          { image: 'https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=400', alt: 'Phòng bệnh', caption: 'Phòng bệnh đơn tiện nghi' },
          { image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400', alt: 'Hành lang', caption: 'Hành lang sạch sẽ, thoáng đãng' },
          { image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=400', alt: 'Khu vườn', caption: 'Khu vườn xanh mát' }
        ],
        stats: [
          { number: '5,000m²', label: 'Tổng diện tích' },
          { number: '50+', label: 'Phòng khám' },
          { number: '100+', label: 'Giường bệnh' },
          { number: '24/7', label: 'Hoạt động' }
        ]
      }
    },

    // ======================= 4. EQUIPMENT =======================
    {
      setting_key: 'equipment',
      value_json: {
        banner: {
          image: 'https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=1200',
          alt: 'Trang thiết bị',
          title: 'Trang Thiết Bị Y Tế Hiện Đại',
          subtitle: 'Công nghệ tiên tiến phục vụ chẩn đoán và điều trị',
          description: 'Đầu tư trang thiết bị y tế hàng đầu từ các nước phát triển, đảm bảo chất lượng khám chữa bệnh'
        },
        stats: [
          { number: '200+', label: 'Thiết bị hiện đại' },
          { number: '100%', label: 'Nhập khẩu chính hãng' },
          { number: '15+', label: 'Chuyên khoa' },
          { number: '24/7', label: 'Bảo dưỡng định kỳ' }
        ],
        categories: [
          { icon: 'FaXRay', name: 'Chẩn đoán hình ảnh', color: '#2196F3', count: 25 },
          { icon: 'FaVial', name: 'Xét nghiệm', color: '#4CAF50', count: 30 },
          { icon: 'FaHeartbeat', name: 'Tim mạch', color: '#F44336', count: 15 },
          { icon: 'FaLungs', name: 'Hô hấp', color: '#FF9800', count: 12 },
          { icon: 'FaUserMd', name: 'Phẫu thuật', color: '#9C27B0', count: 20 },
          { icon: 'FaBaby', name: 'Sản nhi', color: '#E91E63', count: 18 }
        ],
        equipment: [
          { image: 'https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=400', alt: 'Máy CT Scanner', name: 'Máy CT Scanner 128 lát cắt', origin: 'Siemens, Đức', description: 'Chẩn đoán hình ảnh chính xác, thời gian nhanh', category: 'Chẩn đoán hình ảnh' },
          { image: 'https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=400', alt: 'Máy MRI', name: 'Máy cộng hưởng từ MRI 1.5 Tesla', origin: 'GE, Mỹ', description: 'Hình ảnh sắc nét, không xạ trị', category: 'Chẩn đoán hình ảnh' },
          { image: 'https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=400', alt: 'Máy siêu âm', name: 'Máy siêu âm 4D màu', origin: 'Philips, Hà Lan', description: 'Siêu âm thai nhi và nội tạng rõ nét', category: 'Chẩn đoán hình ảnh' },
          { image: 'https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=400', alt: 'Máy xét nghiệm', name: 'Hệ thống xét nghiệm tự động', origin: 'Roche, Thụy Sĩ', description: 'Kết quả nhanh chóng, chính xác cao', category: 'Xét nghiệm' },
          { image: 'https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=400', alt: 'Máy điện tim', name: 'Máy điện tim 12 chuyển đạo', origin: 'Fukuda Denshi, Nhật Bản', description: 'Theo dõi nhịp tim, phát hiện bệnh lý', category: 'Tim mạch' },
          { image: 'https://images.unsplash.com/photo-1581594549595-35f6edc7b762?w=400', alt: 'Máy thở', name: 'Máy thở cao cấp', origin: 'Dräger, Đức', description: 'Hỗ trợ hô hấp hiệu quả', category: 'Hô hấp' }
        ],
        quality: [
          { icon: 'FaCheckCircle', title: 'Nhập khẩu chính hãng', description: 'Tất cả thiết bị đều nhập khẩu trực tiếp từ nhà sản xuất' },
          { icon: 'FaCertificate', title: 'Đầy đủ chứng nhận', description: 'Giấy phép lưu hành, chứng nhận CE, FDA' },
          { icon: 'FaTools', title: 'Bảo dưỡng định kỳ', description: 'Kiểm tra, hiệu chuẩn theo lịch trình nghiêm ngặt' },
          { icon: 'FaUserTie', title: 'Đội ngũ kỹ thuật chuyên nghiệp', description: 'Được đào tạo bởi hãng, sẵn sàng hỗ trợ 24/7' }
        ]
      }
    },

    // ======================= 5. HEADER-NAV-FOOTER =======================
    {
      setting_key: 'header-nav-footer',
      value_json: {
        header: {
          phone: '1900 1234',
          email: 'contact@easymedify.vn',
          working_hours: 'T2-T7: 7:00-20:00 | CN: 8:00-17:00',
          welcome_text: 'Chào mừng bạn đến với Easy Medify'
        },
        navbar: {
          logo_image: 'EasymedifyLogo.png',
          logo_text: 'Easy Medify',
          search_placeholder: 'Tìm kiếm dịch vụ, bác sĩ...'
        },
        footer: {
          about_title: 'Easy Medify',
          about_description: 'Hệ thống y tế hàng đầu Việt Nam, mang đến dịch vụ chăm sóc sức khỏe chất lượng cao với đội ngũ bác sĩ giàu kinh nghiệm và trang thiết bị hiện đại.',
          address: '123 Đường Nguyễn Văn Linh, Quận 7, TP.HCM',
          hotline: '1900 1234',
          email: 'contact@easymedify.vn',
          working_hours: 'T2 - T7: 7:00 - 20:00\nChủ nhật: 8:00 - 17:00',
          social_facebook: 'https://facebook.com/easymedify',
          social_twitter: 'https://twitter.com/easymedify',
          social_instagram: 'https://instagram.com/easymedify',
          social_youtube: 'https://youtube.com/easymedify',
          copyright_text: '© 2024 Easy Medify. Tất cả quyền được bảo lưu.',
          privacy_link: '/chinh-sach-bao-mat',
          terms_link: '/dieu-khoan-dich-vu'
        }
      }
    },

    // ======================= 6. CONTACT =======================
    {
      setting_key: 'contact',
      value_json: {
        hero: {
          title: 'Liên hệ với chúng tôi',
          subtitle: 'Chúng tôi luôn sẵn sàng lắng nghe và hỗ trợ bạn'
        },
        info_cards: [
          { icon: 'FaPhone', title: 'Điện thoại', details: ['Hotline: (028) 3822 1234', 'Cấp cứu: (028) 3822 9999'], color: '#4CAF50' },
          { icon: 'FaEnvelope', title: 'Email', details: ['info@easymedify.vn', 'support@easymedify.vn'], color: '#2196F3' },
          { icon: 'FaMapMarkerAlt', title: 'Địa chỉ', details: ['123 Đường Nguyễn Văn Linh', 'Quận 7, TP.HCM'], color: '#FF5722' },
          { icon: 'FaClock', title: 'Giờ làm việc', details: ['Thứ 2 - Thứ 7: 7:00 - 20:00', 'Chủ nhật: 8:00 - 17:00'], color: '#9C27B0' }
        ],
        departments: [
          { name: 'Khoa Nội', phone: '(028) 3822 1235' },
          { name: 'Khoa Ngoại', phone: '(028) 3822 1236' },
          { name: 'Khoa Sản', phone: '(028) 3822 1237' },
          { name: 'Khoa Nhi', phone: '(028) 3822 1238' },
          { name: 'Khoa Tim mạch', phone: '(028) 3822 1239' },
          { name: 'Khoa Thần kinh', phone: '(028) 3822 1240' }
        ],
        faqs: [
          { question: 'Làm thế nào để đặt lịch khám?', answer: 'Bạn có thể đặt lịch qua hotline (028) 3822 1234, website easymedify.vn, hoặc trực tiếp tại quầy tiếp đón.' },
          { question: 'Có cần mang theo giấy tờ gì khi đến khám?', answer: 'Vui lòng mang theo CMND/CCCD, thẻ bảo hiểm y tế (nếu có), và các kết quả xét nghiệm cũ (nếu có).' },
          { question: 'Phòng khám có nhận bảo hiểm y tế không?', answer: 'Có, chúng tôi chấp nhận tất cả các loại thẻ bảo hiểm y tế theo quy định của Bộ Y tế.' },
          { question: 'Thời gian chờ khám trung bình là bao lâu?', answer: 'Với hệ thống đặt lịch trực tuyến, thời gian chờ trung bình chỉ khoảng 15-20 phút.' },
          { question: 'Có dịch vụ cấp cứu 24/7 không?', answer: 'Có, chúng tôi có đội ngũ y bác sĩ trực cấp cứu 24/7. Hotline cấp cứu: (028) 3822 9999' }
        ],
        map_embed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.6306488178597!2d106.69544331480096!3d10.762622092324129!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTDCsDQ1JzQ1LjQiTiAxMDbCsDQxJzUxLjYiRQ!5e0!3m2!1sen!2s!4v1234567890',
        directions: [
          '🚇 Gần ga metro Bến Thành (300m)',
          '🚌 Các tuyến bus: 03, 14, 36, 93, 152',
          '🚗 Có bãi đậu xe miễn phí cho bệnh nhân',
          '🏍️ Khu vực gửi xe máy an toàn, có mái che'
        ]
      }
    },

    // ======================= 7. PRIVACY =======================
    {
      setting_key: 'privacy',
      value_json: {
        hero: {
          title: 'Chính sách bảo mật',
          subtitle: 'Chúng tôi cam kết bảo vệ quyền riêng tư và bảo mật thông tin cá nhân của bạn',
          last_updated: '01/11/2024'
        },
        sections: [
          {
            icon: 'FaDatabase',
            title: 'Thông tin chúng tôi thu thập',
            items: [
              { subtitle: 'Thông tin cá nhân', content: 'Họ và tên, ngày tháng năm sinh, giới tính, số CMND/CCCD, địa chỉ, số điện thoại, email.' },
              { subtitle: 'Thông tin y tế', content: 'Tiền sử bệnh, kết quả khám, chẩn đoán, đơn thuốc, kết quả xét nghiệm.' },
              { subtitle: 'Thông tin thanh toán', content: 'Thông tin thẻ tín dụng, số tài khoản ngân hàng (được mã hóa).' }
            ]
          },
          {
            icon: 'FaUserCheck',
            title: 'Mục đích sử dụng thông tin',
            items: [
              { subtitle: 'Cung cấp dịch vụ y tế', content: 'Sử dụng thông tin để khám, chẩn đoán, điều trị và theo dõi sức khỏe.' },
              { subtitle: 'Quản lý hồ sơ', content: 'Lưu trữ và quản lý hồ sơ bệnh án điện tử.' },
              { subtitle: 'Liên hệ', content: 'Gửi thông báo lịch hẹn, kết quả xét nghiệm, chương trình khuyến mãi.' }
            ]
          },
          {
            icon: 'FaShieldAlt',
            title: 'Biện pháp bảo mật',
            items: [
              { subtitle: 'Mã hóa dữ liệu', content: 'Tất cả dữ liệu nhạy cảm được mã hóa bằng SSL/TLS.' },
              { subtitle: 'Kiểm soát truy cập', content: 'Chỉ nhân viên được ủy quyền mới có quyền truy cập thông tin bệnh nhân.' },
              { subtitle: 'Sao lưu định kỳ', content: 'Dữ liệu được sao lưu tự động hàng ngày tại trung tâm dữ liệu an toàn.' }
            ]
          },
          {
            icon: 'FaUserShield',
            title: 'Quyền của bạn',
            items: [
              { subtitle: 'Quyền truy cập', content: 'Bạn có quyền xem và yêu cầu sao lưu thông tin cá nhân.' },
              { subtitle: 'Quyền chỉnh sửa', content: 'Bạn có quyền yêu cầu chỉnh sửa thông tin không chính xác.' },
              { subtitle: 'Quyền xóa', content: 'Bạn có quyền yêu cầu xóa thông tin (trừ hồ sơ y tế theo quy định pháp luật).' }
            ]
          },
          {
            icon: 'FaLock',
            title: 'Chia sẻ thông tin',
            items: [
              { subtitle: 'Không bán thông tin', content: 'Chúng tôi cam kết không bán hoặc cho thuê thông tin cá nhân của bạn.' },
              { subtitle: 'Chia sẻ có giới hạn', content: 'Chỉ chia sẻ khi có sự đồng ý của bạn hoặc theo yêu cầu của pháp luật.' }
            ]
          }
        ],
        contact_email: 'privacy@easymedify.vn',
        contact_phone: '(028) 3822 1234',
        contact_address: '123 Đường Nguyễn Văn Linh, Quận 7, TP.HCM'
      }
    },

    // ======================= 8. TERMS =======================
    {
      setting_key: 'terms',
      value_json: {
        hero: {
          title: 'Điều khoản dịch vụ',
          subtitle: 'Vui lòng đọc kỹ các điều khoản trước khi sử dụng dịch vụ của chúng tôi',
          effective_date: '01/01/2025'
        },
        intro: {
          title: 'Chào mừng đến với Easy Medify',
          content: 'Các điều khoản dịch vụ này điều chỉnh việc bạn sử dụng website và các dịch vụ y tế do Easy Medify cung cấp. Bằng việc sử dụng dịch vụ, bạn đồng ý tuân thủ các điều khoản dưới đây.'
        },
        sections: [
          {
            icon: 'FaUserCheck',
            title: 'Chấp nhận điều khoản',
            items: [
              { subtitle: 'Đồng ý sử dụng', content: 'Bằng việc sử dụng dịch vụ, bạn xác nhận đã đọc, hiểu và đồng ý với các điều khoản này.' },
              { subtitle: 'Thay đổi điều khoản', content: 'Chúng tôi có quyền cập nhật điều khoản bất kỳ lúc nào. Phiên bản mới có hiệu lực ngay khi đăng tải.' }
            ]
          },
          {
            icon: 'FaFileContract',
            title: 'Dịch vụ y tế',
            items: [
              { subtitle: 'Đặt lịch', content: 'Bạn có trách nhiệm đặt lịch chính xác và đến đúng giờ. Hủy/đổi lịch cần trước 24h.' },
              { subtitle: 'Thanh toán', content: 'Phí dịch vụ được niêm yết công khai. Bạn cần thanh toán đầy đủ trước khi sử dụng dịch vụ.' },
              { subtitle: 'Bảo hiểm y tế', content: 'Chúng tôi chấp nhận BHYT theo quy định. Bạn cần xuất trình thẻ hợp lệ.' }
            ]
          },
          {
            icon: 'FaComments',
            title: 'Tư vấn trực tuyến',
            items: [
              { subtitle: 'Phạm vi tư vấn', content: 'Dịch vụ tư vấn online chỉ mang tính chất tham khảo, không thay thế khám trực tiếp.' },
              { subtitle: 'Trách nhiệm', content: 'Bạn tự chịu trách nhiệm về quyết định điều trị dựa trên tư vấn online.' }
            ]
          },
          {
            icon: 'FaShieldAlt',
            title: 'Bảo mật thông tin',
            items: [
              { subtitle: 'Cam kết bảo mật', content: 'Thông tin y tế của bạn được bảo mật tuyệt đối theo quy định pháp luật.' },
              { subtitle: 'Chia sẻ thông tin', content: 'Chỉ chia sẻ khi có sự đồng ý của bạn hoặc theo yêu cầu cơ quan có thẩm quyền.' }
            ]
          },
          {
            icon: 'FaBan',
            title: 'Giới hạn trách nhiệm',
            items: [
              { subtitle: 'Không đảm bảo kết quả', content: 'Chúng tôi không đảm bảo kết quả điều trị cụ thể, chỉ cam kết nỗ lực tối đa.' },
              { subtitle: 'Bất khả kháng', content: 'Không chịu trách nhiệm cho thiệt hại do sự kiện bất khả kháng.' }
            ]
          }
        ],
        contact_email: 'legal@easymedify.vn',
        contact_phone: '(028) 3822 1234'
      }
    },

    // ======================= 9. SERVICES PAGE =======================
    {
      setting_key: 'services_page',
      value_json: {
        // ── Hero ──
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
        // ── Stats (số liệu nổi bật hero) ──
        hero_stats: [
          { num: '500+', lbl: 'Bác sĩ' },
          { num: '200+', lbl: 'Dịch vụ' },
          { num: '50k+', lbl: 'Bệnh nhân' },
          { num: '4.9★', lbl: 'Đánh giá' }
        ],
        // ── Quy trình 3 bước (tab tư vấn) ──
        consultation_steps: [
          {
            num: '01',
            icon: 'FaUserPlus',
            label: 'Chọn Bác sĩ',
            desc: 'Tìm bác sĩ phù hợp với chuyên khoa và nhu cầu của bạn.'
          },
          {
            num: '02',
            icon: 'FaCalendarCheck',
            label: 'Đặt Lịch hẹn',
            desc: 'Chọn khung giờ trống, xác nhận thông tin và thanh toán.'
          },
          {
            num: '03',
            icon: 'FaVideo',
            label: 'Bắt đầu Tư vấn',
            desc: 'Tham gia phòng tư vấn qua Video hoặc Chat đúng giờ hẹn.'
          }
        ],
        // ── Cam kết (Why Choose Us) ──
        why_choose: [
          { icon: 'FaUserMd',   title: '500+ Bác Sĩ Giỏi',    desc: 'Đội ngũ chuyên gia đầu ngành từ các bệnh viện lớn.', color: '#0ea5a4' },
          { icon: 'FaBolt',     title: 'Kết Nối Tức Thì',      desc: 'Không xếp hàng, kết nối bác sĩ chỉ sau vài giây.',  color: '#f39c12' },
          { icon: 'FaShieldAlt',title: 'Bảo Mật Tuyệt Đối',   desc: 'Hồ sơ bệnh án được mã hóa chuẩn quốc tế.',          color: '#3b82f6' },
          { icon: 'FaWallet',   title: 'Chi Phí Hợp Lý',       desc: 'Tiết kiệm chi phí đi lại và thời gian chờ đợi.',    color: '#8b5cf6' }
        ],
        // ── CTA Banner (tab hospital) ──
        hospital_cta: {
          title: 'Cần hỗ trợ chọn dịch vụ?',
          subtitle: 'Đội ngũ tư vấn của chúng tôi sẵn sàng giúp bạn 24/7.',
          phone: '1900 1234'
        },
        // ── CTA Banner (tab tư vấn) ──
        consultation_cta: {
          title: 'Sẵn sàng gặp bác sĩ ngay hôm nay?',
          subtitle: 'Đặt lịch chỉ mất 2 phút. Tư vấn bắt đầu trong 15 phút.'
        }
      }
    },

    // ===== [MỚI] APPOINTMENT OPTIMIZATION CONFIG =====
    {
      setting_key: 'appointment_capacity_config',
      value_json: {
        enabled: true,
        comment: 'Config quản lý quỹ thời gian động cho appointment system',
        
        // Thời lượng 1 khung (slot) - dùng để chia nhỏ Ca làm việc
        slot_duration_minutes: 30,
        
        // Thời gian khám trung bình trên 1 bệnh nhân (tính toán sức chứa)
        avg_consultation_time: 10,
        
        // Tỷ lệ xen kẽ U:N (Priority:Normal)
        // Ví dụ: '2:1' = gọi 2 U rồi gọi 1 N để công bằng
        queue_interleave_ratio: '2:1',
        
        // Thời gian chờ tối đa trước khi ưu tiên
        max_wait_time_minutes: 30,
        
        // Thời gian chênh lệch để coi là late arrival  
        late_arrival_threshold_minutes: 5,
        
        // Online appointment: bắt buộc thanh toán trước
        online_require_prepayment: true,
        online_slot_duration_minutes: 30,
        
        // Cấp cứu: bypass capacity, ưu tiên tuyệt đối
        enable_urgent_priority: true,
        
        // Log & debug
        enable_debug_logging: true
      }
    }
  ];
};

module.exports = { getDefaultSystemSettings };