// server/config/articlesSeed.js
// Hàm seed dữ liệu cho bảng Articles

module.exports = async function seedArticles(models, transaction, context = {}) {
  const tinTucCategory = context.tinTucCategory;
  const admins = context.admins;
  
  if (!tinTucCategory) throw new Error('articlesSeed requires tinTucCategory');
  if (!admins || admins.length === 0) throw new Error('articlesSeed requires admins');

  const adminId = admins[0].id; // Lấy admin đầu tiên làm tác giả

  // Danh sách các bài viết với nội dung dài, format HTML chuẩn để test CKEditor
  const sampleArticles = [
    { 
      title: 'Hiểu đúng về bệnh Tim mạch và 5 phương pháp phòng ngừa toàn diện', 
      slug: 'phong-ngua-benh-tim-mach-toan-dien', 
      content: `
        <h2>1. Bệnh tim mạch là gì?</h2>
        <p>Bệnh tim mạch là các tình trạng liên quan đến sức khỏe của trái tim và mạch máu, bao gồm bệnh mạch vành, nhồi máu cơ tim, đột quỵ, và suy tim. Đây là nguyên nhân gây tử vong hàng đầu trên toàn thế giới, nhưng hoàn toàn có thể phòng ngừa được nếu chúng ta duy trì một lối sống lành mạnh.</p>
        <img src="https://images.unsplash.com/photo-1505576399279-565b52d4ac71?auto=format&fit=crop&q=80&w=800" alt="Tim mạch" style="max-width:100%; border-radius:8px; margin: 10px 0;"/>
        <h2>2. Dấu hiệu nhận biết sớm</h2>
        <ul>
          <li>Đau thắt ngực, cảm giác đè nặng hoặc vắt nghẹt ở vùng tim.</li>
          <li>Khó thở, đặc biệt là khi gắng sức hoặc nằm xuống.</li>
          <li>Nhịp tim đập nhanh, đánh trống ngực không rõ nguyên nhân.</li>
          <li>Chóng mặt, choáng váng hoặc ngất xỉu.</li>
        </ul>
        <h2>3. 5 Phương pháp phòng ngừa hiệu quả</h2>
        <p><strong>- Chế độ ăn uống:</strong> Tăng cường rau xanh, trái cây, ngũ cốc nguyên hạt. Hạn chế muối, đường và chất béo bão hòa.</p>
        <p><strong>- Tập thể dục:</strong> Ít nhất 150 phút tập thể dục cường độ trung bình mỗi tuần (như đi bộ nhanh, bơi lội, đạp xe).</p>
        <p><strong>- Kiểm soát cân nặng:</strong> Duy trì chỉ số khối cơ thể (BMI) ở mức lý tưởng từ 18.5 đến 24.9.</p>
        <p><strong>- Không hút thuốc lá:</strong> Khói thuốc làm hỏng lớp niêm mạc của động mạch, dẫn đến sự tích tụ của các mảng bám mỡ.</p>
        <p><strong>- Khám sức khỏe định kỳ:</strong> Kiểm tra huyết áp, mỡ máu và đường huyết ít nhất 6 tháng một lần.</p>
        <blockquote>"Trái tim khỏe mạnh bắt đầu từ những thói quen nhỏ nhất trong bữa ăn hàng ngày." - Hội Tim Mạch Học Việt Nam.</blockquote>
      `,
      tags_json: ['tim mạch', 'phòng ngừa', 'sức khỏe', 'huyết áp'], 
      status: 'approved',
      is_medical_review_required: true,
      views: 1250
    },
    { 
      title: 'Cẩm nang dinh dưỡng chuẩn y khoa dành cho người Bệnh Tiểu Đường', 
      slug: 'dinh-duong-cho-nguoi-tieu-duong', 
      content: `
        <h2>Tầm quan trọng của dinh dưỡng đối với bệnh nhân tiểu đường</h2>
        <p>Đối với người bệnh đái tháo đường (tiểu đường), chế độ ăn uống không chỉ cung cấp năng lượng mà còn là "liều thuốc" quan trọng giúp kiểm soát đường huyết, ngăn ngừa các biến chứng nguy hiểm như suy thận, mù lòa hay hoại tử chi.</p>
        <h2>Nguyên tắc xây dựng thực đơn</h2>
        <p>Người bệnh không cần phải kiêng khem khổ sở đến mức suy dinh dưỡng. Chìa khóa nằm ở việc <strong>kiểm soát lượng carbohydrate (tinh bột)</strong> tiêu thụ trong mỗi bữa ăn.</p>
        <h3>Thực phẩm NÊN ăn:</h3>
        <ul>
          <li><strong>Rau xanh và trái cây ít ngọt:</strong> Cải bó xôi, súp lơ, táo, bưởi, ổi (chứa nhiều chất xơ giúp làm chậm quá trình hấp thu đường).</li>
          <li><strong>Ngũ cốc nguyên cám:</strong> Gạo lứt, yến mạch, khoai lang thay vì gạo trắng hay bánh mì trắng.</li>
          <li><strong>Đạm chất lượng cao:</strong> Thịt nạc, cá hồi, đậu phụ, trứng.</li>
        </ul>
        <h3>Thực phẩm CẦN TRÁNH:</h3>
        <ul>
          <li>Đồ ngọt có đường tinh luyện: Bánh kẹo, nước ngọt có ga, trà sữa.</li>
          <li>Chất béo xấu: Nội tạng động vật, mỡ lợn, thức ăn nhanh chiên ngập dầu.</li>
          <li>Trái cây quá ngọt: Sầu riêng, mít, nhãn, vải (nên ăn với số lượng rất ít).</li>
        </ul>
        <p><em>Lưu ý: Bạn nên chia nhỏ thành 5-6 bữa ăn trong ngày thay vì ăn 3 bữa no, điều này giúp đường huyết không bị tăng vọt sau khi ăn và không bị hạ quá thấp khi xa bữa ăn.</em></p>
      `,
      tags_json: ['tiểu đường', 'dinh dưỡng', 'thực đơn', 'đường huyết'], 
      status: 'pending_medical', // Đang chờ bác sĩ duyệt
      is_medical_review_required: true,
      views: 0
    },
    { 
      title: 'Rối loạn tiền đình: Nguyên nhân, triệu chứng và cách điều trị dứt điểm', 
      slug: 'roi-loan-tien-dinh-cach-dieu-tri', 
      content: `
        <h2>Tiền đình là gì?</h2>
        <p>Tiền đình là một bộ phận phức tạp nằm ở phía sau ốc tai hai bên, có vai trò cực kỳ quan trọng trong việc giữ thăng bằng cơ thể, phối hợp các cử động của mắt, đầu và thân mình. Rối loạn tiền đình xảy ra khi dây thần kinh số 8 hoặc hệ thống mạch máu nuôi dưỡng não bị tổn thương.</p>
        <h2>Những triệu chứng điển hình</h2>
        <p>Rất nhiều người nhầm lẫn rối loạn tiền đình với thiếu máu não. Dưới đây là các dấu hiệu phân biệt:</p>
        <ul>
          <li><strong>Chóng mặt:</strong> Cảm giác đồ vật xung quanh quay cuồng, nghiêng ngả. Thường xảy ra khi thay đổi tư thế đột ngột (từ nằm sang ngồi dậy).</li>
          <li><strong>Mất thăng bằng:</strong> Khó khăn khi đi lại, dễ vấp ngã.</li>
          <li><strong>Ù tai:</strong> Có tiếng kêu "ve ve" trong tai.</li>
          <li><strong>Buồn nôn và nôn:</strong> Đặc biệt khi chóng mặt dữ dội.</li>
        </ul>
        <h2>Cách sơ cứu khi bị cơn chóng mặt cấp tính</h2>
        <p>1. Nằm xuống ngay lập tức ở nơi yên tĩnh, thoáng mát, tránh ánh sáng chói.</p>
        <p>2. Chọn tư thế nằm thoải mái nhất, không nên quay đầu quá mạnh.</p>
        <p>3. Uống một cốc nước gừng ấm hoặc nước trà đường ấm để giảm buồn nôn.</p>
        <p>4. Nếu các triệu chứng không giảm sau 30 phút, cần gọi hỗ trợ y tế ngay lập tức.</p>
        <h2>Điều trị và phòng ngừa</h2>
        <p>Điều trị rối loạn tiền đình cần tuân theo chỉ định của Bác sĩ chuyên khoa Thần kinh. Người bệnh không nên tự ý mua thuốc chống chóng mặt uống vì có thể che lấp triệu chứng của các bệnh lý nguy hiểm khác như u não hay tai biến mạch máu não.</p>
      `,
      tags_json: ['tiền đình', 'chóng mặt', 'thần kinh', 'sơ cứu'], 
      status: 'approved',
      is_medical_review_required: false,
      views: 3420
    },
    { 
      title: 'Lịch tiêm chủng mở rộng các loại Vaccine cần thiết cho trẻ em năm 2026', 
      slug: 'lich-tiem-chung-vaccine-cho-tre-2026', 
      content: `
        <p>Hệ miễn dịch của trẻ nhỏ rất non yếu, do đó việc tiêm chủng đầy đủ và đúng lịch là biện pháp phòng bệnh hiệu quả và ít tốn kém nhất. Dưới đây là lịch tiêm chủng cập nhật mới nhất mà các bậc phụ huynh cần ghi nhớ.</p>
        <h2>Giai đoạn Sơ sinh (Vừa sinh ra)</h2>
        <ul>
          <li><strong>Vaccine Lao (BCG):</strong> Tiêm 1 mũi duy nhất càng sớm càng tốt sau sinh.</li>
          <li><strong>Vaccine Viêm gan B:</strong> Mũi 1 tiêm trong vòng 24 giờ đầu sau sinh.</li>
        </ul>
        <h2>Giai đoạn 2 tháng tuổi</h2>
        <p>Trẻ cần được tiêm mũi tổng hợp 6 trong 1 hoặc 5 trong 1, bao gồm: Bạch hầu, ho gà, uốn ván, bại liệt, viêm gan B và các bệnh do vi khuẩn Haemophilus influenzae type b (Hib) gây ra.</p>
        <p>Uống vaccine ngừa Rotavirus (phòng tiêu chảy cấp).</p>
        <h2>Những lưu ý trước và sau khi đưa trẻ đi tiêm</h2>
        <p><strong>Trước khi tiêm:</strong> Vệ sinh thân thể sạch sẽ, cho trẻ mặc quần áo thoáng mát. Thông báo cho bác sĩ về tiền sử dị ứng hoặc phản ứng với các lần tiêm trước.</p>
        <p><strong>Sau khi tiêm:</strong> Ở lại cơ sở y tế 30 phút để theo dõi phản ứng sau tiêm. Khi về nhà, tiếp tục theo dõi nhiệt độ cơ thể, vết tiêm và tinh thần của trẻ trong 24-48 giờ.</p>
      `,
      tags_json: ['vaccine', 'tiêm chủng', 'trẻ em', 'nhi khoa'], 
      status: 'pending', // Chờ trưởng phòng duyệt (giả sử đã qua bác sĩ)
      is_medical_review_required: false,
      views: 0
    }
  ];

  const articlesToCreate = sampleArticles.map((a) => ({
    category_id: tinTucCategory.id,
    author_id: adminId, // Gán tác giả là admin đầu tiên
    title: a.title,
    slug: a.slug,
    content: a.content,
    tags_json: a.tags_json,
    status: a.status,
    is_medical_review_required: a.is_medical_review_required,
    views: a.views || 0,
    // Nếu status là approved, gán người duyệt và thời gian xuất bản
    approved_by_id: a.status === 'approved' ? adminId : null,
    published_at: a.status === 'approved' ? new Date() : null,
    created_at: new Date(),
    updated_at: new Date()
  }));

  // Lưu vào DB bằng transaction
  const createdArticles = await models.Article.bulkCreate(articlesToCreate, { transaction });
  console.log(`Đã seed thành công ${sampleArticles.length} bài viết mẫu vào danh mục Tin tức.`);
  return createdArticles;
};