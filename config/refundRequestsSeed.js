// server/config/refundRequestsSeed.js
// Seed dữ liệu mẫu cho RefundRequest (Danh sách yêu cầu hoàn tiền)
// Created for CLINIC-SYSTEM-5 RefundRequestPage

const { Op } = require('sequelize');

module.exports = async function seedRefundRequests(models, transaction) {
  try {
    console.log('📋 Bắt đầu seed dữ liệu RefundRequest...');

    // Lấy danh sách Payment với status 'paid' để tạo refund request
    const payments = await models.Payment.findAll({
      where: { 
        status: 'paid'
      },
      include: [
        { association: 'User', attributes: ['id', 'full_name', 'email', 'phone'] },
        { association: 'Appointment' },
        { association: 'Consultation' }
      ],
      limit: 8,
      transaction
    });

    console.log(`✅ Tìm thấy ${payments.length} payment có trạng thái 'paid'`);

    const created = [];
    const refundReasons = [
      'Đơn hàng bị hủy do lịch trình thay đổi',
      'Bác sĩ không khả dụng vào thời gian đã đặt',
      'Lý do cá nhân không thể tham gia',
      'Dịch vụ không đáp ứng kỳ vọng',
      'Yêu cầu hoàn tiền do lỗi hệ thống',
      'Bệnh nhân không thể liên hệ được bác sĩ',
      'Đặt lịch sai và muốn chuyển sang dịch vụ khác'
    ];

    const statusChoices = ['pending', 'processing', 'completed', 'rejected'];

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      const user = payment.User;

      if (!user || !user.id) {
        console.warn(`⚠️  Payment ${payment.id} không có user, bỏ qua`);
        continue;
      }

      // Lấy thông tin ngân hàng từ profile user (nếu có)
      const userProfile = user.Profile || {};
      const bankInfo = {
        bank_name: userProfile.bank_name || 'Vietcombank',
        account_no: userProfile.bank_account || '123456789012',
        account_name: userProfile.bank_account_name || user.full_name || 'Không xác định'
      };

      // Tính toán penalty_fee (phạt 20% - 50% tùy trạng thái)
      const refundAmountPercent = [0.8, 0.7, 0.5][Math.floor(Math.random() * 3)];
      const originalAmount = parseFloat(payment.amount || 0);
      const refundAmount = originalAmount * refundAmountPercent;
      const penaltyFee = originalAmount - refundAmount;

      // Chọn admin xử lý ngẫu nhiên (nếu status không phải 'pending')
      let processedBy = null;
      let adminNote = null;
      
      // FIX DỨT ĐIỂM: Ép buộc 100% dữ liệu mẫu tạo ra là 'pending' (Chờ xử lý) để hiển thị lên giao diện
      const randomStatus = 'pending';

      if (randomStatus !== 'pending') {
        const admins = await models.Admin.findAll({ 
          limit: 1, 
          transaction,
          attributes: ['user_id']
        });
        if (admins.length > 0) {
          processedBy = admins[0].user_id;
          adminNote = randomStatus === 'completed' 
            ? 'Đã chuyển khoản ngân hàng thành công' 
            : 'Từ chối yêu cầu hoàn tiền';
        }
      }

      // Nếu là status 'completed', tạo refund_ref
      const refundRef = randomStatus === 'completed' 
        ? `REF-${Date.now()}-${Math.floor(Math.random() * 10000)}` 
        : null;

      try {
        const refundRequest = await models.RefundRequest.create({
          payment_id: payment.id,
          user_id: user.id,
          amount_original: originalAmount,
          refund_amount: refundAmount,
          penalty_fee: penaltyFee,
          
          // Snapshot policy
          policy_snapshot: {
            rule_name: 'Hủy trước 24 giờ',
            penalty_percent: Math.round((penaltyFee / originalAmount) * 100),
            refund_percent: Math.round((refundAmount / originalAmount) * 100),
            applied_at: new Date(),
            reason_code: 'CANCEL_BEFORE_24H'
          },
          
          // Thông tin ngân hàng
          bank_info_snapshot: bankInfo,
          
          // Lý do hoàn tiền
          reason: refundReasons[Math.floor(Math.random() * refundReasons.length)],
          
          // Trạng thái xử lý
          status: randomStatus,
          processed_by: processedBy,
          admin_note: adminNote,
          
          // Tham chiếu hoàn tiền
          refund_ref: refundRef,
          proof_images: randomStatus === 'completed' 
            ? [
                `/uploads/refund-proofs/proof-${Date.now()}-1.jpg`,
                `/uploads/refund-proofs/proof-${Date.now()}-2.jpg`
              ] 
            : null,
          
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random trong 30 ngày gần đây
          updated_at: new Date()
        }, { transaction });

        created.push(refundRequest);
        console.log(`✅ Tạo RefundRequest #${refundRequest.id} cho Payment #${payment.id} - Status: ${randomStatus}`);
      } catch (err) {
        console.error(`❌ Lỗi tạo RefundRequest cho Payment ${payment.id}:`, err.message);
      }
    }

    console.log(`✅ Seed hoàn tất: Tạo ${created.length} RefundRequest`);
    return created;
  } catch (error) {
    console.error('❌ Lỗi trong seedRefundRequests:', error.message);
    throw error;
  }
};