// server/models/Payment.js
// PHIÊN BẢN CHUẨN HÓA:
// 1. Cho phép appointment_id và consultation_id là NULL (để linh hoạt)
// 2. Chuyển method sang STRING để tránh lỗi ENUM khi thêm phương thức mới

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
    id: { 
      type: DataTypes.BIGINT, 
      primaryKey: true, 
      autoIncrement: true 
    },
    
    code: { 
      type: DataTypes.STRING(50), 
      unique: true,
      comment: 'Mã thanh toán'
    },
    
    //  CHO PHÉP NULL (Để thanh toán Tư vấn thì cái này null)
    appointment_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      comment: 'ID lịch hẹn (nếu có)'
    },

    //  CHO PHÉP NULL (Để thanh toán Lịch hẹn thì cái này null)
    consultation_id: { 
      type: DataTypes.BIGINT, 
      allowNull: true, 
      comment: 'ID buổi tư vấn (nếu có)'
    },
    
    user_id: { 
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'ID người thanh toán'
    },
    
    amount: { 
      type: DataTypes.DECIMAL(15, 2), 
      allowNull: false,
      comment: 'Số tiền thanh toán'
    },
    
    discount_id: { 
      type: DataTypes.BIGINT,
      allowNull: true
    },
    
    status: { 
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'), 
      defaultValue: 'pending',
      comment: 'Trạng thái thanh toán'
    },
    
    method: { 
      type: DataTypes.STRING(50), // Dùng String thay vì ENUM để linh hoạt hơn
      allowNull: false,
      comment: 'bank_transfer, cash, vnpay, momo...'
    },
    
    transaction_id: { 
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Mã giao dịch (SePay, VNPay...)'
    },

    provider_ref: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Mã tham chiếu gốc (Nội dung CK)'
    },

    admin_note: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    raw_response: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    payment_info: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    proof_image_url: {
      type: DataTypes.TEXT,
      allowNull: true
    }

  }, {
    tableName: 'payments',
    timestamps: true,
    underscored: true
  });

  Payment.associate = (models) => {
    // Quan hệ với Appointment (có thể null)
    Payment.belongsTo(models.Appointment, { 
      foreignKey: 'appointment_id',
      as: 'Appointment'
    });
    
    // Quan hệ với Consultation (có thể null)
    Payment.belongsTo(models.Consultation, { 
      foreignKey: 'consultation_id',
      as: 'Consultation'
    });
    
    Payment.belongsTo(models.User, { 
      foreignKey: 'user_id',
      as: 'User'
    });
  };

  // Hook tự động tạo mã PY...
  Payment.addHook('beforeCreate', async (payment) => {
    if (!payment.code) {
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const random = Math.floor(1000 + Math.random() * 9000);
        payment.code = `PY${dateStr}${random}`;
    }
  });

  return Payment;
};