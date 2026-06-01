// server/models/ContactMessage.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContactMessage = sequelize.define('ContactMessage', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    subject: { type: DataTypes.STRING(500), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.ENUM('new', 'read', 'replied', 'closed'),
      defaultValue: 'new',
      allowNull: false
    },
    admin_note: { type: DataTypes.TEXT, allowNull: true },
    replied_by: { type: DataTypes.BIGINT, allowNull: true },
    replied_at: { type: DataTypes.DATE, allowNull: true },
    ip_address: { type: DataTypes.STRING(50), allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'contact_messages',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['email'] },
      { fields: ['created_at'] }
    ]
  });

  ContactMessage.associate = (models) => {
    if (models.User) {
      ContactMessage.belongsTo(models.User, {
        foreignKey: 'replied_by',
        as: 'replier'
      });
    }
  };

  console.log('SUCCESS: Model ContactMessage đã được định nghĩa.');
  return ContactMessage;
};