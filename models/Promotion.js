// server/models/Promotion.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Promotion = sequelize.define('Promotion', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING(50), unique: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    
    // Loại khuyến mãi
    discount_type: { 
      type: DataTypes.ENUM('percentage', 'fixed_amount'), 
      defaultValue: 'percentage' 
    },
    discount_value: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, 
    
    // --- BỔ SUNG CÁC ĐIỀU KIỆN ÁP DỤNG ---
    max_discount_amount: { 
      type: DataTypes.DECIMAL(10, 2), 
      comment: 'Số tiền giảm tối đa (nếu giảm theo %)' 
    }, 
    min_order_value: { 
      type: DataTypes.DECIMAL(10, 2), 
      defaultValue: 0,
      comment: 'Giá trị đơn hàng tối thiểu để áp dụng' 
    },
    // Áp dụng cho đối tượng nào?
    apply_for: {
      type: DataTypes.ENUM('all', 'service', 'medicine', 'shipping', 'consultation'), // Thêm consultation
      defaultValue: 'all',
      comment: 'Áp dụng cho: Tất cả, Dịch vụ, Thuốc, hoặc Phí ship'
    },
    // Bổ sung danh sách ID cụ thể (Lưu dạng JSON string hoặc TEXT)
    applicable_ids: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Danh sách ID (Dịch vụ/Thuốc/Gói tư vấn) được áp dụng, cách nhau bởi dấu phẩy'
    },
    exclude_ids: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Danh sách ID bị loại trừ'
    },
    // Quản lý số lượng & Thời gian
    usage_limit: { type: DataTypes.INTEGER, defaultValue: 100 }, 
    usage_count: { type: DataTypes.INTEGER, defaultValue: 0 }, 
    start_date: { type: DataTypes.DATE, allowNull: false }, // Bắt buộc
    end_date: { type: DataTypes.DATE, allowNull: false },   // Bắt buộc
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },

    // SAU KHI SỬA
    // Game Config
    is_game_reward: { type: DataTypes.BOOLEAN, defaultValue: false },
    //  THÊM MỚI: CẤU HÌNH CHO CỬA HÀNG ĐỔI ĐIỂM
    is_exchange_reward: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'Đánh dấu là quà đổi điểm' },
    exchange_points: { type: DataTypes.INTEGER, defaultValue: 0, comment: 'Số điểm cần để đổi mã này' },
    exchange_limit: { type: DataTypes.INTEGER, defaultValue: -1, comment: 'Giới hạn số lần đổi mã này cho mỗi user' },
    image_url: { type: DataTypes.STRING, allowNull: true, comment: 'Ảnh voucher chung' },
    
    game_type: {
      type: DataTypes.ENUM('lucky_wheel', 'check_in', 'none'),
      defaultValue: 'none',
      comment: 'Loại game áp dụng: Vòng quay, Điểm danh...'
    },
    game_probability: { 
      type: DataTypes.INTEGER, 
      defaultValue: 0, 
      comment: 'Tỷ lệ trúng thưởng (0-100%)' 
    },
    //  THÊM MỚI: PHÂN LOẠI PHẦN THƯỞNG GAME
    reward_type: {
      type: DataTypes.ENUM('voucher', 'card', 'item'),
      defaultValue: 'voucher',
      comment: 'Loại phần thưởng: Voucher giảm giá, Thẻ cào, hoặc Hiện vật'
    },
    external_code: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Mã nạp thẻ điện thoại hoặc mã PIN'
    },
    reward_image_url: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Ảnh thẻ cào hoặc hiện vật'
    }
  }, {
    tableName: 'promotions',
    underscored: true
  });

  Promotion.associate = (models) => {
    Promotion.hasMany(models.UserVoucher, { foreignKey: 'promotion_id' });
    Promotion.hasMany(models.GamePlay,    { foreignKey: 'promotion_id', as: 'gamePlays' });
    Promotion.hasMany(models.WheelPrize,  { foreignKey: 'promotion_id', as: 'wheelPrizes' });
  };

  return Promotion;
};