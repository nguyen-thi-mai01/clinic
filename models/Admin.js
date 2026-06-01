const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Admin = sequelize.define('Admin', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.BIGINT, unique: true, allowNull: false },
    username: { type: DataTypes.STRING(50), unique: false, allowNull: false },
    code: { type: DataTypes.STRING(10), unique: true, allowNull: false },
    permissions_json: { type: DataTypes.JSON, allowNull: true }, // Cho phép null
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'admins',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['username'] }]
  });

  Admin.associate = (models) => {
    Admin.belongsTo(models.User, { foreignKey: 'user_id' });
    Admin.hasMany(models.SystemSetting, { foreignKey: 'updated_by', sourceKey: 'user_id' });
  };

  Admin.addHook('beforeValidate', async (admin, options) => {
    try {
      console.log('Bắt đầu hook beforeValidate cho Admin');
      
      // Chỉ thực hiện các thao tác này nếu chưa có username hoặc code
      if (!admin.username || !admin.code) {
        // Lấy username từ User nếu chưa có
        if (!admin.username) {
          const user = await sequelize.models.User.findOne({
            where: { id: admin.user_id },
            transaction: options.transaction
          });
          if (!user) {
            throw new Error(`Không tìm thấy User với user_id: ${admin.user_id}`);
          }
          admin.username = user.username;
          console.log(`SUCCESS: Đã gán username ${admin.username} cho Admin`);
        }

        // Tạo code nếu chưa có
        if (!admin.code) {
          const count = await Admin.count({ transaction: options.transaction });
          admin.code = `AD${String(count + 1).padStart(5, '0')}`;
          console.log(`SUCCESS: Tạo mã ${admin.code} cho quản trị viên mới.`);
        }
      }
    } catch (error) {
      console.error('ERROR trong hook beforeValidate cho Admin:', error.message);
      throw error;
    }
  });

  console.log('SUCCESS: Model Admin đã được định nghĩa.');
  return Admin;
};