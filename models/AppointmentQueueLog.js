const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AppointmentQueueLog = sequelize.define('AppointmentQueueLog', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    appointment_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'appointments',
        key: 'id'
      }
    },
    called_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    queue_number: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    doctor_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    service_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    patient_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    appointment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    called_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'appointment_queue_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['appointment_id'] },
      { fields: ['called_by'] },
      { fields: ['appointment_date'] },
      { fields: ['called_at'] }
    ]
  });

  AppointmentQueueLog.associate = (models) => {
    AppointmentQueueLog.belongsTo(models.Appointment, {
      foreignKey: 'appointment_id',
      as: 'appointment'
    });

    AppointmentQueueLog.belongsTo(models.User, {
      foreignKey: 'called_by',
      as: 'caller'
    });
  };

  return AppointmentQueueLog;
};
