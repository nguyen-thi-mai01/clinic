// server/config/forumTopicsSeed.js
const { models } = require('./db');

async function seedForumTopics() {
  try {
    console.log('🌱 Seeding Forum Topics...');

    const topics = [
      {
        title: 'Tư vấn sức khỏe',
        description: 'Các câu hỏi về tình trạng sức khỏe, triệu chứng bệnh và lời khuyên chung',
        requiresApproval: true,
        icon: '🩺',
        color: '#2fbf71'
      },
      {
        title: 'Dinh dưỡng & Chế độ ăn',
        description: 'Thực đơn lành mạnh, chế độ ăn kiêng, tư vấn dinh dưỡng',
        requiresApproval: false,
        icon: '🥗',
        color: '#27ae60'
      },
      {
        title: 'Thai sản & Nuôi con',
        description: 'Mang thai, sinh nở, chăm sóc trẻ sơ sinh và nuôi dạy con',
        requiresApproval: true,
        icon: '👶',
        color: '#e91e63'
      },
      {
        title: 'Sức khỏe tâm lý',
        description: 'Căng thẳng, lo âu, trầm cảm và các vấn đề tâm lý',
        requiresApproval: true,
        icon: '🧠',
        color: '#9c27b0'
      },
      {
        title: 'Thể dục & Luyện tập',
        description: 'Tập luyện, yoga, gym và các hoạt động thể chất',
        requiresApproval: false,
        icon: '💪',
        color: '#ff9800'
      },
      {
        title: 'Thuốc & Điều trị',
        description: 'Thông tin về thuốc men, cách dùng và tác dụng phụ',
        requiresApproval: true,
        icon: '💊',
        color: '#f44336'
      },
      {
        title: 'Xét nghiệm & Chẩn đoán',
        description: 'Các loại xét nghiệm y khoa và cách đọc kết quả',
        requiresApproval: true,
        icon: '🔬',
        color: '#3f51b5'
      },
      {
        title: 'Bệnh mãn tính',
        description: 'Tiểu đường, huyết áp, tim mạch và các bệnh mãn tính',
        requiresApproval: true,
        icon: '💉',
        color: '#d32f2f'
      },
      {
        title: 'Làm đẹp & Chăm sóc da',
        description: 'Skincare, làm đẹp tự nhiên và chăm sóc nhan sắc',
        requiresApproval: false,
        icon: '✨',
        color: '#ec407a'
      },
      {
        title: 'Y học cổ truyền',
        description: 'Đông y, châm cứu, bấm huyệt và phương pháp điều trị truyền thống',
        requiresApproval: false,
        icon: '🌿',
        color: '#4caf50'
      },
      {
        title: 'Phòng bệnh & Tiêm chủng',
        description: 'Vaccine, vệ sinh phòng bệnh và các biện pháp phòng ngừa',
        requiresApproval: false,
        icon: '💉',
        color: '#00bcd4'
      },
      {
        title: 'Cấp cứu & Sơ cứu',
        description: 'Xử lý tình huống khẩn cấp và kỹ năng sơ cứu cơ bản',
        requiresApproval: true,
        icon: '🚑',
        color: '#ff5722'
      },
      {
        title: 'Sức khỏe người cao tuổi',
        description: 'Chăm sóc sức khỏe và dinh dưỡng cho người già',
        requiresApproval: false,
        icon: '👴',
        color: '#795548'
      },
      {
        title: 'Thảo luận chung',
        description: 'Chia sẻ kinh nghiệm, câu chuyện và thảo luận tự do',
        requiresApproval: false,
        icon: '💬',
        color: '#607d8b'
      },
      {
        title: 'Hỏi đáp bác sĩ',
        description: 'Đặt câu hỏi trực tiếp với bác sĩ (có phê duyệt)',
        requiresApproval: true,
        icon: '👨‍⚕️',
        color: '#0b2f40'
      }
    ];

    for (const topicData of topics) {
      const [topic, created] = await models.Topic.findOrCreate({
        where: { title: topicData.title },
        defaults: topicData
      });

      if (created) {
        console.log(`  ✅ Created topic: ${topic.title}`);
      } else {
        console.log(`  ℹ️  Topic already exists: ${topic.title}`);
      }
    }

    console.log('✅ Forum Topics seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding forum topics:', error);
    throw error;
  }
}

module.exports = seedForumTopics;
