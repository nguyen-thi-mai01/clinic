// server/config/consultationChatSeed.js
// Seed consultation records, chat messages, and linked consultation payments
const { Op } = require('sequelize');

module.exports = async function seedConsultationChat(models, transaction, context = {}) {
  const Consultation = models.Consultation;
  const ChatMessage = models.ChatMessage;
  const Payment = models.Payment;
  const User = models.User;
  const Specialty = models.Specialty;
  const ConsultationPricing = models.ConsultationPricing;

  const users = await User.findAll({ transaction });
  const patients = users.filter(user => user.role === 'patient');
  const doctors = users.filter(user => user.role === 'doctor');
  const specialties = await Specialty.findAll({ transaction });
  const packages = await ConsultationPricing.findAll({ transaction });

  if (!patients.length || !doctors.length || !packages.length) return [];

  // Cleanup old consultation sample data + related records before reseeding
  try {
    await ChatMessage.destroy({
      where: { consultation_id: { [Op.not]: null } },
      transaction
    });

    await Payment.destroy({
      where: { consultation_id: { [Op.not]: null } },
      transaction
    });

    await Consultation.destroy({
      where: {},
      transaction
    });
  } catch (cleanupError) {
    console.error('❌ Error cleaning old consultations data:', cleanupError.message);
    throw cleanupError;
  }

  const created = [];
  const now = new Date();

  const consultationTypes = ['chat', 'chat', 'video', 'video'];

  function generateConsultationCode() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `CS${timestamp}${random}`;
  }

  const makeDateTime = (daysOffset, hour = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  const buildResultSnapshot = (consultationType, index) => ({
    chief_complaint: `Triệu chứng mẫu ${index + 1}: ${consultationType === 'chat' ? 'Tư vấn qua chat' : consultationType === 'video' ? 'Tư vấn video call' : 'Khám trực tiếp'}`,
    symptoms: 'Đau đầu, mệt mỏi, khó tập trung',
    diagnosis: 'Theo dõi thêm, chưa ghi nhận dấu hiệu nguy cấp',
    treatment_plan: 'Nghỉ ngơi, uống đủ nước, theo dõi triệu chứng',
    advice: 'Nếu sốt cao hoặc đau tăng cần tái liên hệ ngay',
    severity_level: 'moderate',
    need_followup: index % 3 === 0,
    followup_notes: index % 3 === 0 ? 'Tái khám sau 7 ngày' : null,
    vitals_json: {
      temperature: 37.2,
      blood_pressure: '118/76',
      heart_rate: 76,
      spO2: 98
    },
    clinical_note: 'Bệnh nhân ổn định, chưa cần nhập viện',
    service_indications: index % 4 === 0 ? [{ service_name: 'Xét nghiệm máu', status: 'recommended' }] : [],
    test_images_json: index % 5 === 0 ? [{ file_name: `consultation-${index + 1}.png` }] : [],
    report_files_json: index % 4 === 0 ? [{ file_name: `report-${index + 1}.pdf` }] : []
  });

  // Seed minimal consultation data set: 2 chat + 2 video
  for (let i = 0; i < 4; i++) {
    const patient = patients[i % patients.length];
    const doctor = doctors[i % doctors.length];
    const specialty = specialties.length ? specialties[i % specialties.length] : null;
    const pkg = packages[i % packages.length];

    const daysOffset = i + 1;
    const status = 'confirmed';
    const paymentStatus = i % 2 === 0 ? 'unpaid' : 'paid_online';
    const consultationType = consultationTypes[i];

    const apptTime = makeDateTime(daysOffset, 8 + (i % 10));
    const durationMinutes = pkg.duration_minutes || 30;
    const resultSnapshot = buildResultSnapshot(consultationType, i);
    const isFinished = status === 'completed' || status === 'passed';
    const isInProgress = status === 'in_progress';
    const shouldSeedPayment = paymentStatus !== 'not_required';
    const paymentAmount = Number(pkg.price || 0) + Math.round(Number(pkg.price || 0) * 0.1);
    const consultationCode = generateConsultationCode();

    try {
      const consult = await Consultation.create({
        consultation_code: consultationCode,
        patient_id: patient.id,
        doctor_id: doctor.id,
        consultation_type: consultationType,
        specialty_id: specialty ? specialty.id : null,
        consultation_pricing_id: pkg.id,
        appointment_time: apptTime,
        started_at: isInProgress || isFinished ? new Date(apptTime.getTime() - 1000 * 60 * 5) : null,
        ended_at: isFinished ? new Date(apptTime.getTime() + durationMinutes * 1000 * 60) : null,
        duration_minutes: durationMinutes,
        chief_complaint: resultSnapshot.chief_complaint,
        medical_history: null,
        current_medications: null,
        symptom_duration: `${1 + (i % 7)} ngày`,
        status,
        medical_record_status: isFinished ? 'has_record' : 'no_record',
        diagnosis: isFinished ? resultSnapshot.diagnosis : null,
        treatment_plan: isFinished ? resultSnapshot.treatment_plan : null,
        prescription_data: isFinished ? [{ medicine: 'Paracetamol', dosage: '500mg', frequency: '2 lần/ngày' }] : null,
        symptoms: isFinished ? resultSnapshot.symptoms : null,
        advice: isFinished ? resultSnapshot.advice : null,
        vitals_json: isFinished ? resultSnapshot.vitals_json : null,
        clinical_note: isFinished ? resultSnapshot.clinical_note : null,
        service_indications: isFinished ? resultSnapshot.service_indications : null,
        test_images_json: isFinished ? resultSnapshot.test_images_json : null,
        report_files_json: isFinished ? resultSnapshot.report_files_json : null,
        result_snapshot: isFinished ? resultSnapshot : null,
        severity_level: isFinished ? resultSnapshot.severity_level : 'normal',
        need_followup: isFinished ? resultSnapshot.need_followup : false,
        followup_date: isFinished && resultSnapshot.need_followup ? new Date(apptTime.getTime() + 1000 * 60 * 60 * 24 * 7) : null,
        followup_notes: isFinished ? resultSnapshot.followup_notes : null,
        base_fee: pkg.price,
        platform_fee: Math.round(pkg.price * 0.1),
        total_fee: paymentAmount,
        payment_status: paymentStatus,
        payment_method: paymentStatus === 'paid_online' ? 'vnpay' : (paymentStatus === 'not_required' ? null : 'bank_transfer'),
        payment_transaction_id: paymentStatus === 'paid_online' ? `TX-${pkg.package_code}-${i + 1}` : null,
        room_id: `room-${consultationCode.toLowerCase()}`,
        chat_session_id: consultationType === 'chat' ? `chat-${i + 1}` : null,
        attachments: [],
        doctor_files: [],
        metadata: {
          seed: true,
          package_code: pkg.package_code,
          notes: `Ghi chú mẫu consultation ${i + 1}`
        },
        patient_device: i % 2 === 0 ? 'web' : 'mobile',
        doctor_device: 'web'
      }, { transaction });

      if (shouldSeedPayment) {
        const paymentStatusMap = {
          unpaid: 'pending',
          paid_online: 'paid',
          paid_at_clinic: 'paid',
          refunded: 'refunded'
        };

        await Payment.create({
          consultation_id: consult.id,
          appointment_id: null,
          user_id: patient.id,
          amount: paymentAmount,
          status: paymentStatusMap[paymentStatus] || 'pending',
          method: paymentStatus === 'paid_online' ? 'vnpay' : (paymentStatus === 'refunded' ? 'cash' : 'bank_transfer'),
          transaction_id: paymentStatus === 'paid_online' ? `TX-${consult.consultation_code}` : null,
          provider_ref: `CONS-${consult.consultation_code}`,
          payment_info: `Seed payment for consultation ${consult.consultation_code}`,
          admin_note: `Seeded from consultation payment status ${paymentStatus}`
        }, { transaction });
      }

      if ((consultationType === 'chat' || consultationType === 'video') && status === 'confirmed') {
        const messages = [
          { sender: patient, receiver: doctor, text: 'Chào bác sĩ, tôi cần tư vấn.' },
          { sender: doctor, receiver: patient, text: 'Chào bạn, mình đã nhận lịch tư vấn.' }
        ];

        for (const message of messages) {
          await ChatMessage.create({
            consultation_id: consult.id,
            sender_id: message.sender.id,
            sender_type: message.sender.role === 'doctor' ? 'doctor' : 'patient',
            receiver_id: message.receiver.id,
            message_type: 'text',
            content: message.text
          }, { transaction });
        }
      }

      created.push(consult);
    } catch (err) {
      console.error(`❌ Error creating consultation ${i}:`, err.message);
    }
  }

  console.log(`✅ Consultation + chat seed: created ${created.length}/4 consultations (2 chat, 2 video)`);
  return created;
};
