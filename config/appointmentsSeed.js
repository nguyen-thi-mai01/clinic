// server/config/appointmentsSeed.js
const { Op } = require('sequelize');

function generateAppointmentCode() {
  const date = new Date();
  const datePart = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const randomPart = String(Math.floor(1000 + Math.random() * 9000));
  return `AP-${datePart}-${randomPart}`;
}

module.exports = async function seedAppointments(models, transaction) {
  const patients = await models.Patient.findAll({ include: [{ model: models.User }], transaction });
  const doctors = await models.Doctor.findAll({ include: [{ association: 'user' }, { association: 'specialty' }], transaction });
  const services = await models.Service.findAll({ transaction });

  if (!patients.length || !doctors.length || !services.length) return [];

  // Cleanup old appointment sample data + related records before reseeding
  try {
    await models.Payment.destroy({
      where: { appointment_id: { [Op.not]: null } },
      transaction
    });

    await models.MedicalRecord.destroy({
      where: { appointment_id: { [Op.not]: null } },
      transaction
    });

    await models.Appointment.destroy({
      where: {},
      transaction
    });
  } catch (cleanupError) {
    console.error('❌ Error cleaning old appointments data:', cleanupError.message);
    throw cleanupError;
  }

  const getDoctorForService = (service, index) => {
    const serviceDoctorCodes = Array.isArray(service.doctor_codes) ? service.doctor_codes : [];
    const eligibleDoctors = doctors.filter(doctor => {
      if (service.specialty_id && Number(doctor.specialty_id) === Number(service.specialty_id)) return true;
      return serviceDoctorCodes.includes(doctor.code);
    });
    return eligibleDoctors.length ? eligibleDoctors[index % eligibleDoctors.length] : doctors[index % doctors.length];
  };

  const buildGuestSnapshot = (patient) => {
    const user = patient.User || patient.user || {};
    return {
      guest_name: user.full_name || `Bệnh nhân ${patient.code || patient.id}`,
      guest_phone: user.phone || null,
      guest_email: user.email || null,
      guest_gender: user.gender || null,
      guest_dob: user.dob || null
    };
  };

  const appointments = [];
  const today = new Date();
  const makeDate = (offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const appointmentTypes = ['offline', 'offline'];
  const timeSlots = [
    { start: '07:00:00', end: '07:30:00' },
    { start: '08:00:00', end: '08:30:00' },
    { start: '09:00:00', end: '09:30:00' },
    { start: '10:00:00', end: '10:30:00' },
    { start: '14:00:00', end: '14:30:00' },
    { start: '15:00:00', end: '15:30:00' },
    { start: '16:00:00', end: '16:30:00' }
  ];

  // Seed minimal data set: only 2 service appointments
  for (let i = 0; i < 2; i++) {
    const patient = patients[i % patients.length];
    const service = services[i % services.length];
    const doctor = getDoctorForService(service, i);
    const timeSlot = timeSlots[i % timeSlots.length];

    // Keep upcoming appointments for easier testing
    const dateOffset = i + 1;

    const date = makeDate(dateOffset);
    const status = 'confirmed';
    const paymentStatus = i % 2 === 0 ? 'unpaid' : 'paid_online';

    const guestSnapshot = buildGuestSnapshot(patient);
    const useGuestSnapshot = false;
    const queueType = i % 3 === 0 ? 'priority' : 'normal';
    const queueNumber = i + 1;
    const displayQueue = `${queueType === 'priority' ? 'U' : 'N'}${String(queueNumber).padStart(2, '0')}`;
    const appointmentDateTime = new Date(`${date}T${timeSlot.start}`);
    const isCompleted = status === 'completed';
    const isPaid = paymentStatus === 'paid_online' || paymentStatus === 'paid_at_clinic';

    appointments.push({
      patient_id: useGuestSnapshot ? null : patient.id,
      doctor_id: doctor.id,
      service_id: service.id,
      specialty_id: service.specialty_id || doctor.specialty_id || null,
      appointment_date: date,
      appointment_start_time: timeSlot.start,
      appointment_end_time: timeSlot.end,
      appointment_type: appointmentTypes[i % appointmentTypes.length],
      status,
      payment_status: paymentStatus,
      payment_method: paymentStatus === 'paid_online' ? 'vnpay' : (paymentStatus === 'paid_at_clinic' ? 'cash' : null),
      paid_at: isPaid ? new Date(appointmentDateTime.getTime() - 1000 * 60 * 15) : null,
      reason: `Khám dịch vụ mẫu ${i + 1} - ${service.name || 'dịch vụ'}`,
      cancel_reason: status === 'cancelled' ? 'Bệnh nhân đổi lịch' : null,
      cancelled_by: status === 'cancelled' ? 'patient' : null,
      cancelled_at: status === 'cancelled' ? new Date(appointmentDateTime.getTime() - 1000 * 60 * 30) : null,
      medical_result: isCompleted ? 'Khám và đánh giá ban đầu ổn định' : null,
      prescription: isCompleted ? 'Paracetamol 500mg, 2 lần/ngày trong 3 ngày' : null,
      next_appointment: isCompleted ? 'Tái khám sau 7 ngày nếu triệu chứng không cải thiện' : null,
      medical_files: isCompleted ? [{ type: 'result', name: `appointment-${i + 1}.pdf` }] : null,
      completed_at: isCompleted ? new Date(appointmentDateTime.getTime() + 1000 * 60 * 20) : null,
      completed_by: isCompleted ? doctor.user_id : null,
      medical_record_status: isCompleted ? 'has_record' : 'no_record',
      queue_type: queueType,
      payment_queue_number: queueNumber,
      queue_number: queueNumber,
      display_queue: displayQueue,
      checked_in_at: status === 'in_progress' || isCompleted ? new Date(appointmentDateTime.getTime() - 1000 * 60 * 10) : null,
      actual_arrival_time: status === 'in_progress' || isCompleted ? new Date(appointmentDateTime.getTime() - 1000 * 60 * 8) : null,
      appointment_address: appointmentTypes[i % appointmentTypes.length] === 'offline' ? 'Phòng khám trung tâm' : null,
      service_indications: null,
      edge_case_flags: status === 'cancelled' ? { cancelled_seeded: true } : null,
      code: generateAppointmentCode(),
      ...guestSnapshot,
      guest_name: useGuestSnapshot ? guestSnapshot.guest_name : null,
      guest_phone: useGuestSnapshot ? guestSnapshot.guest_phone : null,
      guest_email: useGuestSnapshot ? guestSnapshot.guest_email : null,
      guest_gender: useGuestSnapshot ? guestSnapshot.guest_gender : null,
      guest_dob: useGuestSnapshot ? guestSnapshot.guest_dob : null,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  try {
    await models.Appointment.bulkCreate(appointments, { transaction, ignoreDuplicates: true });
    console.log(`✅ Appointments seed: created ${appointments.length}/2 appointments`);
  } catch (err) {
    console.error('❌ Error seeding appointments:', err);
  }

  const created = await models.Appointment.findAll({ limit: 2, transaction });
  return created;
};
