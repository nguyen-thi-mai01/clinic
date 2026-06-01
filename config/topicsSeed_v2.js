// server/config/topicsSeed.js
// Seed riêng cho Topics - CHỦ ĐỀ DIỄN ĐÀN

module.exports = async function seedTopics(models, transaction) {
  try {
    console.log('🌱 Seeding Topics...');

    const { Topic } = models;

    const topicsData = [
      {
        title: 'Sức khỏe tổng quát',
        description: 'Các câu hỏi về sức khỏe, chăm sóc sức khỏe hàng ngày, tư vấn sức khỏe tổng thể',
        slug: 'suc-khoe-tong-quat',
        specialtyIds: [],
        requiresApproval: true,
        autoApprove: false,
        moderatorIds: [],
        isActive: true,
        icon: 'FaHeartbeat',
        color: '#2ecc71',
        displayOrder: 1
      },
      {
        title: 'Dinh dưỡng',
        description: 'Tư vấn dinh dưỡng, chế độ ăn uống lành mạnh, thực đơn cho từng đối tượng',
        slug: 'dinh-duong',
        specialtyIds: [],
        requiresApproval: true,
        autoApprove: true,
        moderatorIds: [],
        isActive: true,
        icon: 'FaAppleAlt',
        color: '#f39c12',
        displayOrder: 2
      },
      {
        title: 'Tim mạch',
        description: 'Các vấn đề về tim mạch, huyết áp, mạch máu, bệnh lý tim',
        slug: 'tim-mach',
        specialtyIds: [1],
        requiresApproval: true,
        autoApprove: false,
        moderatorIds: [],
        isActive: true,
        icon: 'FaHeart',
        color: '#e74c3c',
        displayOrder: 3
      },
      {
        title: 'Tiêu hóa',
        description: 'Rối loạn tiêu hóa, đau dạ dày, gan mật, viêm ruột',
        slug: 'tieu-hoa',
        specialtyIds: [2],
        requiresApproval: true,
        autoApprove: false,
        moderatorIds: [],
        isActive: true,
        icon: 'FaStethoscope',
        color: '#3498db',
        displayOrder: 4
      },
      {
        title: 'Da liễu',
        description: 'Các vấn đề về da, mụn, dị ứng da, nấm da, zona',
        slug: 'da-lieu',
        specialtyIds: [3],
        requiresApproval: true,
        autoApprove: true,
        moderatorIds: [],
        isActive: true,
        icon: 'FaSpa',
        color: '#9b59b6',
        displayOrder: 5
      },
      {
        title: 'Thần kinh',
        description: 'Đau đầu, mất ngủ, stress, lo âu, trầm cảm, Parkinson',
        slug: 'than-kinh',
        specialtyIds: [4],
        requiresApproval: true,
        autoApprove: false,
        moderatorIds: [],
        isActive: true,
        icon: 'FaBrain',
        color: '#1abc9c',
        displayOrder: 6
      },
      {
        title: 'Sản phụ khoa',
        description: 'Thai nghén, sinh đẻ, chăm sóc sau sinh, vô sinh hiếm muộn',
        slug: 'san-phu-khoa',
        specialtyIds: [5],
        requiresApproval: true,
        autoApprove: false,
        moderatorIds: [],
        isActive: true,
        icon: 'FaBaby',
        color: '#e91e63',
        displayOrder: 7
      },
      {
        title: 'Nhi khoa',
        description: 'Chăm sóc sức khỏe trẻ em, tiêm chủng, dinh dưỡng trẻ',
        slug: 'nhi-khoa',
        specialtyIds: [6],
        requiresApproval: true,
        autoApprove: false,
        moderatorIds: [],
        isActive: true,
        icon: 'FaChild',
        color: '#ff9800',
        displayOrder: 8
      },
      {
        title: 'Mắt',
        description: 'Các vấn đề về mắt, cận thị, viễn thị, đục thủy tinh thể',
        slug: 'mat',
        specialtyIds: [7],
        requiresApproval: true,
        autoApprove: true,
        moderatorIds: [],
        isActive: true,
        icon: 'FaEye',
        color: '#00bcd4',
        displayOrder: 9
      },
      {
        title: 'Răng hàm mặt',
        description: 'Nha khoa, chỉnh nha, trồng răng, nhổ răng khôn',
        slug: 'rang-ham-mat',
        specialtyIds: [8],
        requiresApproval: true,
        autoApprove: false,
        moderatorIds: [],
        isActive: true,
        icon: 'FaTooth',
        color: '#795548',
        displayOrder: 10
      }
    ];

    const createdTopics = [];
    for (const topicData of topicsData) {
      const [topic, created] = await Topic.findOrCreate({
        where: { slug: topicData.slug },
        defaults: topicData,
        transaction
      });
      createdTopics.push(topic);
    }

    console.log(`✅ Seeded ${createdTopics.length} topics`);
    return createdTopics;
  } catch (error) {
    console.error('❌ Error seeding topics:', error);
    throw error;
  }
};
