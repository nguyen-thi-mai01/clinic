// server/config/medicalRecordsSeed.js
module.exports = async function seedMedicalRecords(models, transaction) {
  const appointments = await models.Appointment.findAll({ where: { status: 'confirmed' }, limit: 8, transaction });
  if (!appointments.length) return [];

  const records = [];
  appointments.forEach(appt => {
    records.push({
      appointment_id: appt.id,
      patient_id: appt.patient_id || null,
      doctor_id: appt.doctor_id,
      diagnosis: 'Theo dõi và điều trị theo triệu chứng',
      symptoms: 'Sốt, đau đầu nhẹ',
      treatment_plan: 'Nghỉ ngơi, uống thuốc giảm đau',
      advice: 'Uống nhiều nước và theo dõi',
      prescription_json: [{ medicine: 'Paracetamol', dosage: '500mg', frequency: '2 lần/ngày' }]
    });
  });

  const created = [];
  // Use create() to ensure hooks (lookup hash) run
  for (const r of records) {
    try {
      const rec = await models.MedicalRecord.create(r, { transaction });
      created.push(rec);
    } catch (err) {
      // ignore errors (duplicate appointment_id etc.)
    }
  }

  return created;
};
