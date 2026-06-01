// server/config/paymentsSeed.js
const { Op } = require('sequelize');

module.exports = async function seedPayments(models, transaction) {
  const appointments = await models.Appointment.findAll({
    where: { payment_status: { [Op.in]: ['unpaid', 'paid_online', 'paid_at_clinic', 'refunded'] } },
    include: [
      { association: 'Patient', include: [{ model: models.User }] },
      { association: 'Service' }
    ],
    limit: 12,
    transaction
  });

  const created = [];
  for (const appointment of appointments) {
    try {
      const patient = appointment.Patient;
      const userId = patient?.user_id;
      if (!userId) {
        continue;
      }

      const service = appointment.Service || await models.Service.findByPk(appointment.service_id, { transaction });
      const amount = service ? Number(service.price || 0) : 100000;
      if (!amount) {
        continue;
      }

      const statusMap = {
        unpaid: 'paid', // Ép thành 'paid' để có dữ liệu test hoàn tiền
        paid_online: 'paid',
        paid_at_clinic: 'paid',
        refunded: 'paid' 
      };

      const methodMap = {
        unpaid: 'bank_transfer',
        paid_online: 'vnpay',
        paid_at_clinic: 'cash',
        refunded: 'cash'
      };

      const paymentStatus = appointment.payment_status || 'unpaid';
      const payment = await models.Payment.create({
        appointment_id: appointment.id,
        consultation_id: null,
        user_id: userId,
        amount,
        status: statusMap[paymentStatus] || 'pending',
        method: methodMap[paymentStatus] || 'cash',
        transaction_id: paymentStatus === 'unpaid' ? null : `AP-${appointment.code}`,
        provider_ref: `APPT-${appointment.code}`,
        payment_info: `Seed payment for appointment ${appointment.code}`,
        admin_note: `Seeded from appointment payment status ${paymentStatus}`
      }, { transaction });

      created.push(payment);
    } catch (err) {
      console.error('❌ Error seeding payment:', err.message);
    }
  }

  return created;
};
