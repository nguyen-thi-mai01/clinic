// server/controllers/appointmentOptimizationController.js
// ===== [MỚI] APPOINTMENT OPTIMIZATION: Dynamic Capacity, Service Indications, Edge Cases =====
// Các functions hỗ trợ quy trình khám bệnh tối ưu: Quỹ thời gian động, multi-stop journey, xử lý ngoại lệ

const { Op } = require('sequelize');
let models, sequelize;
try {
  const db = require('../config/db');
  models = db.models;
  sequelize = db.sequelize;
} catch (error) {
  console.error('❌ ERROR: Database not configured for optimization:', error.message);
}

// =========================================================================
// HELPER: Tính toán Quỹ thời gian (Capacity) theo Real-time
// =========================================================================
/**
 * Tính sức chứa của một khung giờ (Time Slot)
 * Công thức: Sức chứa = Quỹ thời gian - Thời gian nghỉ phép - Thời gian đang khám Online
 */
const calculateSlotCapacity = async (doctorId, slotStartTime, slotEndTime, date, transaction = null) => {
  try {
    console.log(`[DEBUG] calculateSlotCapacity: Doctor ${doctorId}, Slot ${slotStartTime}-${slotEndTime}, Date ${date}`);

    // 1. Lấy config sức chứa mặc định từ SystemSetting
    const capacityConfig = await models.SystemSetting.findOne({
      where: { setting_key: 'appointment_capacity_config' },
      transaction
    });

    const config = capacityConfig?.value_json || {
      slot_duration_minutes: 30,
      avg_consultation_time: 10,
      queue_interleave_ratio: '2:1'
    };

    // 2. Chuyển thời gian thành phút
    const timeToMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const slotDurationMinutes = timeToMinutes(slotEndTime) - timeToMinutes(slotStartTime);
    const capacityBefore = Math.floor(slotDurationMinutes / config.avg_consultation_time);

    console.log(`[DEBUG] Slot duration: ${slotDurationMinutes}min, Available before deduction: ${capacityBefore}`);

    // 3. Trừ đi: Online appointments (khóa cứng)
    const onlineAppointments = await models.Appointment.findAll({
      where: {
        doctor_id: doctorId,
        appointment_date: date,
        appointment_type: 'online',
        status: { [Op.notIn]: ['cancelled', 'passed'] }
      },
      attributes: ['id'],
      transaction
    });

    const onlineCount = onlineAppointments.length;
    console.log(`[DEBUG] Online appointments (locked): ${onlineCount}`);

    // 4. Trừ đi: Thời gian xin nghỉ phép
    const leaveRequests = await models.LeaveRequest.findOne({
      where: {
        user_id: (await models.Doctor.findByPk(doctorId, { attributes: ['user_id'], transaction }))?.user_id,
        status: 'approved',
        date_from: { [Op.lte]: date },
        [Op.or]: [
          { date_to: null, date_from: date },
          { date_to: { [Op.gte]: date } }
        ]
      },
      transaction
    });

    const leaveDeduction = leaveRequests ? Math.ceil(slotDurationMinutes / config.avg_consultation_time) : 0;
    console.log(`[DEBUG] Leave deduction: ${leaveDeduction}`);

    // 5. Tính capacity cuối cùng
    const finalCapacity = Math.max(capacityBefore - onlineCount - leaveDeduction, 0);
    console.log(`[DEBUG] Final capacity: ${finalCapacity} (${capacityBefore} - ${onlineCount} - ${leaveDeduction})`);

    return { capacity: finalCapacity, config };
  } catch (error) {
    console.error(`❌ ERROR in calculateSlotCapacity:`, error.message);
    return { capacity: 0, config: {} };
  }
};

// =========================================================================
// 1. CHECK-IN: Cấp STT động cho bệnh nhân
// =========================================================================
/**
 * Check-in lịch hẹn tại phòng khám (offline)
 * - Phát hiện late arrival
 * - Cấp STT ưu tiên (U) hoặc thường (N)
 * - Xen kẽ thông minh: 2U + 1N
 */
exports.checkInAppointment = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { is_late, override_queue } = req.body;

    console.log(`[DEBUG checkInAppointment] Appointment ${id}, is_late: ${is_late}, override: ${override_queue}`);

    const appointment = await models.Appointment.findOne({
      where: isNaN(id) ? { code: id } : { id },
      transaction
    });

    if (!appointment) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
    }

    // Kiểm tra late arrival
    const now = new Date();
    const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_start_time}`);
    const minutesLate = Math.floor((now - appointmentDateTime) / 60000);

    console.log(`[DEBUG] Actual arrival time, minutes late: ${minutesLate}`);

    // Cập nhật actual arrival time
    appointment.actual_arrival_time = now;

    // Phát hiện late arrival
    if (minutesLate > 5) {
      if (!appointment.edge_case_flags) appointment.edge_case_flags = {};
      appointment.edge_case_flags.late_arrival = true;
      appointment.edge_case_flags.late_minutes = minutesLate;

      console.log(`[WARN] Late arrival detected: ${minutesLate} minutes`);

      // Nếu không override, tước priority
      if (!override_queue && appointment.queue_type === 'priority') {
        console.log(`[ACTION] Downgrading from priority to normal queue due to late arrival`);
        appointment.queue_type = 'normal';

        // Ghi log vào AppointmentChange
        await models.AppointmentChange.create({
          appointment_id: appointment.id,
          change_type: 'cancel',
          requested_by: 'system',
          edge_case_type: 'late_arrival',
          change_status: 'completed',
          notes: `Tước priority vì đến trễ ${minutesLate} phút`
        }, { transaction });
      }
    }

    // Cấp STT động: xen kẽ 2U + 1N
    const queueInfo = await issueQueueNumber(appointment.doctor_id, appointment.appointment_date, appointment.queue_type, transaction);
    appointment.queue_number = queueInfo.queue_number;
    appointment.display_queue = queueInfo.display_queue;
    appointment.checked_in_at = now;
    appointment.status = 'waiting_exam';

    await appointment.save({ transaction });

    console.log(`✅ Check-in successful: ${appointment.display_queue}`);
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: `Check-in thành công. Số thứ tự: ${appointment.display_queue}`,
      data: {
        queue_number: appointment.display_queue,
        late_arrival: !!appointment.edge_case_flags?.late_arrival,
        late_minutes: appointment.edge_case_flags?.late_minutes
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error(`❌ ERROR in checkInAppointment:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. ISSUE QUEUE NUMBER: Xen kẽ thông minh (2U + 1N)
// =========================================================================
/**
 * Cấp STT với logic xen kẽ
 * - Tính toán: 2 U thì gọi 1 N
 * - Đảm bảo công bằng cho cả bệnh nhân đặt trước và walk-in
 */
const issueQueueNumber = async (doctorId, date, queueType, transaction = null) => {
  try {
    console.log(`[DEBUG issueQueueNumber] Doctor ${doctorId}, Date ${date}, Type ${queueType}`);

    // Lấy config xen kẽ
    const capacityConfig = await models.SystemSetting.findOne({
      where: { setting_key: 'appointment_capacity_config' },
      transaction
    });
    const ratios = capacityConfig?.value_json?.queue_interleave_ratio?.split(':') || ['2', '1'];
    const [uRatio, nRatio] = [parseInt(ratios[0]) || 2, parseInt(ratios[1]) || 1];

    // Đếm số U và N đã cấp trong ngày
    const existingQueues = await models.Appointment.findAll({
      where: {
        doctor_id: doctorId,
        appointment_date: date,
        [Op.or]: [
          { display_queue: { [Op.like]: 'U%' } },
          { display_queue: { [Op.like]: 'N%' } }
        ]
      },
      attributes: ['display_queue'],
      raw: true,
      transaction
    });

    const uCount = existingQueues.filter(a => a.display_queue?.startsWith('U')).length;
    const nCount = existingQueues.filter(a => a.display_queue?.startsWith('N')).length;

    console.log(`[DEBUG] Current counts - U: ${uCount}, N: ${nCount}`);

    // Quyết định cấp U hay N
    let shouldIssueN = false;
    if (nCount < Math.ceil(uCount / uRatio)) {
      shouldIssueN = true;
    }

    const prefix = shouldIssueN ? 'N' : 'U';
    const nextNum = shouldIssueN ? (nCount + 1) : (uCount + 1);
    const displayQueue = `${prefix}${String(nextNum).padStart(2, '0')}`;

    console.log(`✅ Issued queue: ${displayQueue}`);

    return {
      queue_number: nextNum,
      display_queue: displayQueue,
      type: prefix
    };
  } catch (error) {
    console.error(`❌ ERROR in issueQueueNumber:`, error.message);
    return { queue_number: 1, display_queue: 'U01', type: 'U' };
  }
};

exports.issueQueueNumber = issueQueueNumber;

// =========================================================================
// 3. SERVICE INDICATIONS: Chỉ định dịch vụ phụ
// =========================================================================
/**
 * Bác sĩ chỉ định dịch vụ cận lâm sàng (Siêu âm, Lấy máu...)
 */
exports.addServiceIndications = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { indications } = req.body; // Array: [{ service_name, service_code, order_sequence... }]

    console.log(`[DEBUG addServiceIndications] Appointment ${id}, Indications count: ${indications?.length}`);

    const appointment = await models.Appointment.findOne({
      where: isNaN(id) ? { code: id } : { id },
      transaction
    });

    if (!appointment) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
    }

    // Khởi tạo service_indications if needed
    if (!appointment.service_indications) {
      appointment.service_indications = [];
    }

    // Thêm các chỉ định mới
    indications.forEach((ind, idx) => {
      const indication = {
        id: `ind_${Date.now()}_${idx}`,
        service_name: ind.service_name,
        service_code: ind.service_code || 'SVC',
        status: 'pending',
        order_sequence: ind.order_sequence || idx + 1,
        dependencies: ind.dependencies || [],
        checked_in_at: null,
        completed_at: null,
        result: null
      };
      appointment.service_indications.push(indication);
      console.log(`[DEBUG] Added indication: ${indication.service_code} (sequence: ${indication.order_sequence})`);
    });

    await appointment.save({ transaction });

    console.log(`✅ Service indications added: ${indications.length} items`);
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: `Đã thêm ${indications.length} dịch vụ chỉ định`,
      data: appointment.service_indications
    });
  } catch (error) {
    await transaction.rollback();
    console.error(`❌ ERROR in addServiceIndications:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. CHECK-IN SERVICE ROOM: Bệnh nhân quẹt mã tại phòng dịch vụ
// =========================================================================
/**
 * Bệnh nhân/Staff quẹt mã tại phòng Siêu âm/Lấy máu
 * - Kiểm tra thứ tự y khoa (dependencies)
 * - Cấp STT phòng (SA-01, LM-02...)
 * - Cập nhật trạng thái indication
 */
exports.checkInServiceRoom = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id, indication_id } = req.params;

    console.log(`[DEBUG checkInServiceRoom] Appointment ${id}, Indication ${indication_id}`);

    const appointment = await models.Appointment.findOne({
      where: isNaN(id) ? { code: id } : { id },
      transaction
    });

    if (!appointment || !appointment.service_indications) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy chỉ định dịch vụ' });
    }

    const indication = appointment.service_indications.find(ind => ind.id === indication_id);
    if (!indication) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy indication' });
    }

    // ===== KIỂM TRA DEPENDENCIES (Thứ tự y khoa) =====
    if (indication.dependencies && indication.dependencies.length > 0) {
      const missingDeps = indication.dependencies.filter(depId => {
        const depIndication = appointment.service_indications.find(ind => ind.id === depId);
        return !depIndication || depIndication.status !== 'completed';
      });

      if (missingDeps.length > 0) {
        console.warn(`⚠️ Dependencies not met for ${indication.service_code}`);
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Vui lòng hoàn thành các dịch vụ trước đó trước: ${missingDeps.join(', ')}`
        });
      }
    }

    // Cấp STT phòng dịch vụ
    const existingCount = appointment.service_indications
      .filter(ind => ind.service_code === indication.service_code && ind.status !== 'pending')
      .length;
    const queueNumber = existingCount + 1;
    const displayCode = `${indication.service_code}${String(queueNumber).padStart(2, '0')}`;

    indication.status = 'in_progress';
    indication.checked_in_at = new Date();
    indication.queue_number = queueNumber;
    indication.display_code = displayCode;

    await appointment.save({ transaction });

    console.log(`✅ Service room check-in: ${displayCode}`);
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: `Check-in phòng dịch vụ: ${displayCode}`,
      data: {
        display_code: displayCode,
        service_code: indication.service_code,
        service_name: indication.service_name
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error(`❌ ERROR in checkInServiceRoom:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 5. COMPLETE SERVICE INDICATION: Hoàn thành dịch vụ
// =========================================================================
/**
 * Kỹ thuật viên/Bác sĩ nhập kết quả và hoàn thành dịch vụ
 * - Cập nhật status → completed
 * - Nếu tất cả dịch vụ đã xong → tạo signal gọi bệnh nhân quay lại bác sĩ ban đầu
 */
exports.completeServiceIndication = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id, indication_id } = req.params;
    const { result } = req.body;

    console.log(`[DEBUG completeServiceIndication] Appointment ${id}, Indication ${indication_id}`);

    const appointment = await models.Appointment.findOne({
      where: isNaN(id) ? { code: id } : { id },
      transaction
    });

    if (!appointment || !appointment.service_indications) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy appointment' });
    }

    const indication = appointment.service_indications.find(ind => ind.id === indication_id);
    if (!indication) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy indication' });
    }

    // Hoàn thành dịch vụ
    indication.status = 'completed';
    indication.completed_at = new Date();
    indication.result = result;

    console.log(`✅ Service completed: ${indication.service_code}`);

    // Kiểm tra: tất cả dịch vụ đã xong?
    const allCompleted = appointment.service_indications.every(ind => ind.status === 'completed');
    if (allCompleted) {
      console.log(`✅ ALL SERVICES COMPLETED! Calling patient back to original doctor...`);
      appointment.status = 'waiting_result';

      // Tạo indication "quay lại bác sĩ ban đầu" với ưu tiên cao
      const resultIndication = {
        id: `ind_result_${Date.now()}`,
        service_name: 'Đọc kết quả',
        service_code: 'KQ',
        status: 'pending',
        order_sequence: 999,
        is_priority: true
      };
      appointment.service_indications.push(resultIndication);
    }

    await appointment.save({ transaction });
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Hoàn thành dịch vụ',
      data: {
        indication: indication,
        all_completed: allCompleted
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error(`❌ ERROR in completeServiceIndication:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. HANDLE NO-SHOW: Bác sĩ đánh dấu bệnh nhân vắng mặt
// =========================================================================
/**
 * Khi bệnh nhân không xuất hiện (Online)
 * - Bác sĩ bấm "Vắng mặt"
 * - Hủy appointment, trả lại quỹ thời gian
 * - Auto refund nếu paid_online
 */
exports.handleNoShow = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    console.log(`[DEBUG handleNoShow] Appointment ${id}, Reason: ${reason}`);

    const appointment = await models.Appointment.findOne({
      where: isNaN(id) ? { code: id } : { id },
      include: [{ model: models.Patient, as: 'Patient' }],
      transaction
    });

    if (!appointment) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
    }

    // Cập nhật edge case flag
    if (!appointment.edge_case_flags) appointment.edge_case_flags = {};
    appointment.edge_case_flags.no_show = true;
    appointment.edge_case_flags.no_show_reason = reason;

    appointment.status = 'cancelled';
    appointment.cancelled_at = new Date();
    appointment.cancelled_by = req.user?.role || 'doctor';

    // Ghi log thay đổi
    await models.AppointmentChange.create({
      appointment_id: appointment.id,
      change_type: 'cancel',
      requested_by: 'system',
      edge_case_type: 'no_show',
      change_status: 'completed',
      notes: `No-show: ${reason}`
    }, { transaction });

    // TODO: Auto refund nếu paid_online (cần integrate với Payment service)
    if (appointment.payment_status === 'paid_online') {
      console.log(`[TODO] Auto-refund trigged for appointment ${id}`);
    }

    await appointment.save({ transaction });
    await transaction.commit();

    console.log(`✅ No-show marked and appointment cancelled`);

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu vắng mặt và hủy lịch hẹn',
      data: { appointment_code: appointment.code }
    });
  } catch (error) {
    await transaction.rollback();
    console.error(`❌ ERROR in handleNoShow:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 7. GET QUEUE FOR DOCTOR: Danh sách xếp hàng cho bác sĩ gọi số
// =========================================================================
/**
 * Bác sĩ xem danh sách xếp hàng (U/N xen kẽ)
 * - Ưu tiên: Cấp cứu > Đang khám > U > N
 */
exports.getQueueForDoctor = async (req, res) => {
  try {
    const { doctor_id } = req.params;
    const { date } = req.query;

    const queryDate = date || new Date().toISOString().split('T')[0];
    console.log(`[DEBUG getQueueForDoctor] Doctor ${doctor_id}, Date ${queryDate}`);

    const appointments = await models.Appointment.findAll({
      where: {
        doctor_id,
        appointment_date: queryDate,
        status: { [Op.in]: ['waiting_exam', 'in_progress', 'waiting_result'] },
        appointment_type: 'offline'
      },
      order: [
        // Ưu tiên logic
        sequelize.literal("FIELD(status, 'in_progress', 'waiting_result', 'waiting_exam')"),
        sequelize.literal("FIELD(queue_type, 'priority', 'normal')"),
        ['queue_number', 'ASC']
      ],
      raw: true
    });

    console.log(`✅ Fetched queue: ${appointments.length} appointments`);

    res.status(200).json({
      success: true,
      data: appointments.map(a => ({
        id: a.id,
        code: a.code,
        queue_number: a.display_queue,
        patient_name: a.guest_name || 'Patient', // TODO: fetch từ relation
        status: a.status,
        service: a.service_id
      }))
    });
  } catch (error) {
    console.error(`❌ ERROR in getQueueForDoctor:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 8. PRIORITIZE NOW: Ưu tiên khám cho bệnh nhân chờ quá lâu
// =========================================================================
/**
 * Lễ tân bấm "Ưu Tiên Khám Ngay" khi bệnh nhân chờ > 30p
 * - Chèn hồ sơ lên ngay dưới bệnh nhân đang khám
 */
exports.prioritizeNow = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    console.log(`[DEBUG prioritizeNow] Appointment ${id}`);

    const appointment = await models.Appointment.findOne({
      where: isNaN(id) ? { code: id } : { id },
      transaction
    });

    if (!appointment) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
    }

    // Cập nhật queue: đẩy lên
    appointment.queue_number = 0.5; // Chèn ngay dưới in_progress

    if (!appointment.edge_case_flags) appointment.edge_case_flags = {};
    appointment.edge_case_flags.prioritized_at = new Date();
    appointment.edge_case_flags.wait_time_minutes = Math.floor((new Date() - appointment.checked_in_at) / 60000);

    await appointment.save({ transaction });
    await transaction.commit();

    console.log(`✅ Prioritized: ${appointment.code}`);

    res.status(200).json({
      success: true,
      message: 'Đã ưu tiên khám ngay',
      data: { wait_time: appointment.edge_case_flags.wait_time_minutes }
    });
  } catch (error) {
    await transaction.rollback();
    console.error(`❌ ERROR in prioritizeNow:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// EXPORT HELPERS
// =========================================================================
exports.calculateSlotCapacity = calculateSlotCapacity;
