const { Op, DataTypes } = require('sequelize');
const { sequelize, models } = require('../config/db');

async function ensureRoleProfileColumn() {
  const table = await sequelize.getQueryInterface().describeTable('staff');

  if (!table.role_profile) {
    await sequelize.getQueryInterface().addColumn('staff', 'role_profile', {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Mã vai trò con theo phòng ban'
    });
    console.log('Added column staff.role_profile');
  }
}

async function run() {
  try {
    await ensureRoleProfileColumn();

    const [updatedCount] = await models.Staff.update(
      { role_profile: 'clinical_staff' },
      {
        where: {
          department: 'clinical',
          rank: 'staff',
          [Op.or]: [
            { role_profile: null },
            { role_profile: '' }
          ]
        }
      }
    );

    const totalClinicalStaff = await models.Staff.count({
      where: { department: 'clinical', rank: 'staff' }
    });

    const mappedClinicalStaff = await models.Staff.count({
      where: {
        department: 'clinical',
        rank: 'staff',
        role_profile: 'clinical_staff'
      }
    });

    console.log(`Updated staff rows: ${updatedCount}`);
    console.log(`Clinical staff total: ${totalClinicalStaff}`);
    console.log(`Clinical staff mapped to clinical_staff: ${mappedClinicalStaff}`);

    process.exit(0);
  } catch (error) {
    console.error('Map clinical role_profile failed:', error.message);
    process.exit(1);
  }
}

run();
