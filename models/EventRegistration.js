const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EventRegistration = sequelize.define('EventRegistration', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    event_id: { type: DataTypes.BIGINT, allowNull: false },
    user_id: { type: DataTypes.BIGINT, allowNull: true, comment: 'null nếu khách vãng lai' },

    // Thông tin người đăng ký
    guest_name:  { type: DataTypes.STRING, allowNull: true },
    guest_email: { type: DataTypes.STRING, allowNull: true },
    guest_phone: { type: DataTypes.STRING, allowNull: true },
    attendee_count: { type: DataTypes.INTEGER, defaultValue: 1, comment: 'Số người đi cùng' },

    // QR Check-in
    qr_code:        { type: DataTypes.STRING, unique: true, comment: 'Mã QR động duy nhất' },
    checked_in:     { type: DataTypes.BOOLEAN, defaultValue: false },
    checked_in_at:  { type: DataTypes.DATE, allowNull: true },

    // Trạng thái đăng ký
    status: {
      type: DataTypes.ENUM('registered', 'confirmed', 'cancelled', 'waitlist', 'attended', 'no_show'),
      defaultValue: 'registered'
    },
    checked_out_at: { type: DataTypes.DATE, allowNull: true, comment: 'Giờ rời sự kiện' },

    // Thanh toán (nếu sự kiện có thu phí)
    payment_id: { type: DataTypes.BIGINT, allowNull: true },

    // Trạng thái Quà tặng
    gift_status: {
      type: DataTypes.ENUM('none', 'pending', 'distributed'),
      defaultValue: 'none',
      comment: 'Trạng thái nhận quà'
    },
    gift_received_at: { type: DataTypes.DATE, allowNull: true },
    digital_signature: { type: DataTypes.TEXT('long'), allowNull: true, comment: 'Chữ ký điện tử người nhận' },

    notes: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'event_registrations',
    underscored: true
  });

  EventRegistration.associate = (models) => {
    EventRegistration.belongsTo(models.Event, { foreignKey: 'event_id', as: 'event' });
    EventRegistration.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    if (models.Payment) {
      EventRegistration.belongsTo(models.Payment, { foreignKey: 'payment_id', as: 'payment' });
    }
  };

  return EventRegistration;
};