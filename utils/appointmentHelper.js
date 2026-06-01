/**
 * server/utils/appointmentHelper.js
 * Helper functions for appointment queue management & walk-in logic
 * 
 * @log DEBUG: Các function đều có console.log để track flow
 * @author Staff Management System v2.0
 */

const moment = require('moment');
const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = String(timeStr).split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const minutesToTime = (minutes) => {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
};

const rangesOverlap = (startA, endA, startB, endB) => startA < endB && endA > startB;

async function resolveDoctorRecord(doctorId, transaction = null) {
  const includeOptions = [{
    model: models.Schedule,
    as: 'activeScheduleRegistration',
    attributes: ['weekly_schedule_json'],
    required: false
  }];

  let doctor = await models.Doctor.findByPk(doctorId, {
    include: includeOptions,
    transaction
  });

  if (!doctor) {
    doctor = await models.Doctor.findOne({
      where: { user_id: doctorId },
      include: includeOptions,
      transaction
    });
  }

  return doctor;
}

function addWindow(windowMap, windowData) {
  if (!windowData || !windowData.start_time || !windowData.end_time) return;

  const key = [
    windowData.start_time,
    windowData.end_time,
    windowData.shift_name || '',
    windowData.schedule_type || ''
  ].join('|');

  if (!windowMap.has(key)) {
    windowMap.set(key, windowData);
  }
}

async function getDoctorAvailabilityContext({ doctorId, appointmentDate, transaction = null }) {
  const dateStr = moment(appointmentDate).format('YYYY-MM-DD');
  const dayOfWeek = moment(dateStr).day();

  console.log(`[appointmentHelper] getDoctorAvailabilityContext: doctor=${doctorId}, date=${dateStr}`);

  const doctor = await resolveDoctorRecord(doctorId, transaction);
  if (!doctor) {
    throw new Error('Không tìm thấy bác sĩ');
  }

  const leave = await models.LeaveRequest.findOne({
    where: {
      user_id: doctor.user_id,
      status: 'approved',
      date_from: { [Op.lte]: dateStr },
      [Op.or]: [
        { date_to: null, date_from: dateStr },
        { date_to: { [Op.gte]: dateStr } }
      ]
    },
    transaction
  });

  const leaveShiftNames = [];
  const leaveBlocksAll = !!leave && leave.leave_type !== 'time_range';

  if (leave && leave.leave_type === 'single_shift' && leave.shift_name) {
    leaveShiftNames.push(String(leave.shift_name));
  }

  const windowMap = new Map();
  const activeShiftConfigs = await models.WorkShiftConfig.findAll({
    where: { is_active: true },
    transaction,
    raw: true
  });

  const flexibleJson = doctor.activeScheduleRegistration?.weekly_schedule_json || null;
  const useFlexible = doctor.schedule_preference_type === 'flexible' && flexibleJson && typeof flexibleJson === 'object';

  if (useFlexible) {
    const dayKey = DAY_KEYS[dayOfWeek];
    const flexibleSlots = Array.isArray(flexibleJson[dayKey]) ? flexibleJson[dayKey] : [];

    flexibleSlots.forEach((slot, index) => {
      if (!slot || typeof slot !== 'string' || !slot.includes('-')) return;
      const [startTime, endTime] = slot.split('-');
      if (!startTime || !endTime) return;

      addWindow(windowMap, {
        start_time: `${startTime.trim()}:00`,
        end_time: `${endTime.trim()}:00`,
        shift_name: `flexible_${dayKey}_${index}`,
        schedule_type: 'flexible',
        status: 'available',
        source: 'flexible_registration'
      });
    });
  } else {
    activeShiftConfigs.forEach((shift) => {
      const daysOfWeek = Array.isArray(shift.days_of_week) ? shift.days_of_week : [];
      if (daysOfWeek.length > 0 && !daysOfWeek.includes(dayOfWeek) && !daysOfWeek.includes(String(dayOfWeek))) {
        return;
      }

      addWindow(windowMap, {
        start_time: shift.start_time,
        end_time: shift.end_time,
        shift_name: shift.shift_name,
        schedule_type: 'fixed',
        status: 'available',
        source: 'work_shift_config'
      });
    });
  }

  const dateSchedules = await models.Schedule.findAll({
    where: {
      [Op.or]: [
        { user_id: doctor.user_id },
        { doctor_id: doctor.id }
      ],
      date: dateStr,
      status: { [Op.in]: ['available', 'approved'] },
      schedule_type: { [Op.in]: ['fixed', 'overtime', 'shift_change'] }
    },
    transaction,
    raw: true
  });

  dateSchedules.forEach((schedule) => {
    addWindow(windowMap, {
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      shift_name: schedule.shift_name || schedule.schedule_type,
      schedule_type: schedule.schedule_type,
      status: schedule.status,
      source: 'schedule_table'
    });
  });

  const sourceShifts = Array.from(windowMap.values()).sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

  const appointmentBusy = await models.Appointment.findAll({
    where: {
      [Op.or]: [
        { doctor_id: doctor.id },
        { doctor_id: doctor.user_id }
      ],
      appointment_date: dateStr,
      status: { [Op.notIn]: ['cancelled'] }
    },
    attributes: ['appointment_start_time', 'appointment_end_time', 'appointment_type'],
    raw: true,
    transaction
  });

  const consultationBusy = await models.Consultation.findAll({
    where: {
      [Op.or]: [
        { doctor_id: doctor.user_id },
        { doctor_id: doctor.id }
      ],
      status: { [Op.notIn]: ['cancelled', 'rejected', 'expired'] },
      appointment_time: {
        [Op.between]: [
          moment(dateStr).startOf('day').toISOString(),
          moment(dateStr).endOf('day').toISOString()
        ]
      }
    },
    attributes: ['appointment_time', 'duration_minutes'],
    raw: true,
    transaction
  });

  const busyIntervals = appointmentBusy.map((appointment) => ({
    start: timeToMinutes(appointment.appointment_start_time),
    end: timeToMinutes(appointment.appointment_end_time),
    source: 'appointment',
    appointment_type: appointment.appointment_type || 'offline'
  }));

  consultationBusy.forEach((consultation) => {
    const startMoment = moment(consultation.appointment_time);
    const start = startMoment.hours() * 60 + startMoment.minutes();
    const end = start + (consultation.duration_minutes || 30);
    busyIntervals.push({
      start,
      end,
      source: 'consultation'
    });
  });

  console.log('[appointmentHelper] availability context built:', JSON.stringify({
    doctorId,
    date: dateStr,
    sourceShiftCount: sourceShifts.length,
    busyCount: busyIntervals.length,
    leaveType: leave?.leave_type || null,
    leaveShiftNames
  }));

  return {
    doctor,
    dateStr,
    dayOfWeek,
    sourceShifts,
    busyIntervals,
    leave,
    leaveBlocksAll,
    leaveShiftNames
  };
}

// ============================================================================
// 1. QUEUE TYPE CALCULATION: U-series (Ưu tiên) vs N-series (Thường)
// ============================================================================

/**
 * Calculate queue_type based on booking date vs appointment date
 * 
 * Rules:
 * - Hôm nay (booking_date == appointment_date): N-series (thường)
 * - Ngày mai+ (appointment_date > booking_date):
 *   - Nếu tại quầy (<24h): N-series (thường)
 *   - Nếu đặt trước (≥24h): U-series (ưu tiên)
 * 
 * @param {Date|String} bookingDate - Ngày đặt lịch (now)
 * @param {Date|String} appointmentDate - Ngày khám
 * @param {Boolean} isWalkIn - Is this walk-in booking (default true for tại quầy)
 * @returns {String} 'priority' | 'normal'
 * 
 * @log Trace bookingDate, appointmentDate, timeDiff, result
 */
function calculateQueueType(bookingDate, appointmentDate, isWalkIn = true) {
  const booking = moment(bookingDate).startOf('day');
  const appointment = moment(appointmentDate).startOf('day');
  const timeDiffHours = appointment.diff(booking, 'hours');
  
  const log = {
    bookingDate: booking.format('YYYY-MM-DD'),
    appointmentDate: appointment.format('YYYY-MM-DD'),
    timeDiffHours: timeDiffHours,
    isWalkIn: isWalkIn
  };

  let queueType = 'normal'; // Default: N-series

  // Hôm nay: luôn N-series
  if (timeDiffHours < 24) {
    queueType = 'normal';
    log.reason = 'Booking hôm nay → N-series (thường)';
  }
  // Ngày mai+: check xem tại quầy hay đặt trước
  else if (timeDiffHours >= 24) {
    if (isWalkIn) {
      queueType = 'normal'; // Tại quầy <24h → N
      log.reason = 'Walk-in ≥24h → N-series (thường vì tại quầy)';
    } else {
      queueType = 'priority'; // Đặt online ≥24h → U
      log.reason = 'Booking online ≥24h → U-series (ưu tiên)';
    }
  }

  log.result = queueType;
  console.log(`[appointmentHelper] calculateQueueType:`, JSON.stringify(log, null, 2));
  return queueType === 'priority' ? 'priority' : 'normal';
}

// ============================================================================
// 2. AVAILABLE SLOTS FINDER: Find doctor's available slots
// ============================================================================

/**
 * Find soonest available time slot for doctor on given date
 * 
 * Returns first available 1-hour slot within working hours (8h-17h)
 * 
 * @param {Number} serviceId - Service ID (scope numbering per service per day)
 * @param {Date|String} appointmentDate - Date to search
 * @param {Number} durationMinutes - Appointment duration (default 60)
 * @returns {Promise<{time: String, slot: Object}|null>}
 * 
 * @log Trace doctor schedule, booked slots, available slots, result
 */
async function findSoonestAvailableSlot(doctorId, appointmentDate, durationMinutes = 60) {
  try {
    const dateStr = moment(appointmentDate).format('YYYY-MM-DD');
    console.log(`[appointmentHelper] findSoonestAvailableSlot: doctor=${doctorId}, date=${dateStr}`);

    const context = await getDoctorAvailabilityContext({ doctorId, appointmentDate: dateStr });

    if (context.leaveBlocksAll) {
      console.warn(`[appointmentHelper] Doctor ${doctorId} is on full-day leave for ${dateStr}`);
      return null;
    }

    const windows = context.sourceShifts || [];
    if (windows.length === 0) {
      console.warn(`[appointmentHelper] No working windows found for doctor ${doctorId} on ${dateStr}`);
      return null;
    }

    const now = moment();
    const isToday = now.format('YYYY-MM-DD') === dateStr;
    const earliestAllowedStart = isToday ? now.clone().add(15, 'minutes') : moment(`${dateStr} 00:00:00`, 'YYYY-MM-DD HH:mm:ss');
    const scanStepMinutes = Math.max(15, Math.min(durationMinutes, 30));
    const possibleSlots = [];

    for (const window of windows) {
      const windowStart = timeToMinutes(window.start_time);
      const windowEnd = timeToMinutes(window.end_time);

      for (let startMinutes = windowStart; startMinutes + durationMinutes <= windowEnd; startMinutes += scanStepMinutes) {
        const slotStart = moment(`${dateStr} ${minutesToTime(startMinutes)}`, 'YYYY-MM-DD HH:mm:ss');
        const slotEnd = slotStart.clone().add(durationMinutes, 'minutes');

        if (slotStart.isBefore(earliestAllowedStart)) continue;

        if (context.leave && context.leave.leave_type === 'time_range') {
          const leaveStart = timeToMinutes(context.leave.time_from);
          const leaveEnd = timeToMinutes(context.leave.time_to);
          if (rangesOverlap(startMinutes, startMinutes + durationMinutes, leaveStart, leaveEnd)) {
            continue;
          }
        }

        if (context.leaveShiftNames?.length > 0 && context.leaveShiftNames.includes(String(window.shift_name || ''))) {
          continue;
        }

        const busyConflict = (context.busyIntervals || []).some((busy) =>
          rangesOverlap(startMinutes, startMinutes + durationMinutes, busy.start, busy.end)
        );

        if (!busyConflict) {
          possibleSlots.push({
            time: slotStart.format('HH:mm:ss'),
            start: slotStart,
            end: slotEnd,
            shift_name: window.shift_name || window.schedule_type,
            schedule_type: window.schedule_type
          });
          break;
        }
      }
    }

    possibleSlots.sort((a, b) => a.start.valueOf() - b.start.valueOf());

    console.log(`[appointmentHelper] Available slots found: ${possibleSlots.length}`);

    if (possibleSlots.length > 0) {
      const soonest = possibleSlots[0];
      console.log(`[appointmentHelper] Soonest slot: ${soonest.time}`);
      return { time: soonest.time, slot: soonest };
    }

    console.warn(`[appointmentHelper] No available slots found for doctor ${doctorId} on ${dateStr}`);
    return null;

  } catch (error) {
    console.error(`[appointmentHelper] Error in findSoonestAvailableSlot:`, error.message);
    return null;
  }
}

// ============================================================================
// 3. QUEUE NUMBER GENERATOR: Generate display_queue (U01, N02, etc)
// ============================================================================

/**
 * Generate display_queue number (U01, N02, etc)
 * 
 * Separate counters for U-series (priority) and N-series (normal)
 * Resets daily by doctor
 * 
 * @param {DateTime} appointmentDate - Date of appointment
 * @param {Number} doctorId - Doctor ID
 * @param {String} queueType - 'priority' or 'normal'
 * @param {Object} transaction - Sequelize transaction (for data consistency)
 * @returns {Promise<String>} e.g. 'U01', 'N05'
 * 
 * @log Trace prefix, max number, next number, result
 */
async function generateQueueNumber(appointmentDate, serviceId, queueType, transaction = null) {
  try {
    const dateStr = moment(appointmentDate).format('YYYY-MM-DD');
    const prefix = queueType === 'priority' ? 'U' : 'N';
    console.log(`[appointmentHelper] generateQueueNumber: date=${dateStr}, service=${serviceId}, type=${queueType}(${prefix})`);

    // Find max display_queue for this prefix on this date for this service
    const { literal } = require('sequelize');
    const maxRecord = await models.Appointment.findOne({
      where: {
        appointment_date: dateStr,
        service_id: serviceId,
        display_queue: { [Op.like]: `${prefix}%` }
      },
      order: [[literal('CAST(SUBSTRING(display_queue, 2) AS UNSIGNED)'), 'DESC']],
      attributes: ['display_queue'],
      transaction: transaction
    });

    let nextNum = 1;
    if (maxRecord && maxRecord.display_queue) {
      const currentNum = parseInt(maxRecord.display_queue.substring(1));
      nextNum = currentNum + 1;
      console.log(`[appointmentHelper] Found max queue: ${maxRecord.display_queue}, next will be: ${prefix}${String(nextNum).padStart(2, '0')}`);
    } else {
      console.log(`[appointmentHelper] No existing queue for prefix ${prefix}, starting from 01`);
    }

    const displayQueue = `${prefix}${String(nextNum).padStart(2, '0')}`;
    console.log(`[appointmentHelper] Generated display_queue: ${displayQueue}`);
    return displayQueue;

  } catch (error) {
    console.error(`[appointmentHelper] Error in generateQueueNumber:`, error.message);
    throw error;
  }
}

// ============================================================================
// 4. AUTO QUEUE GENERATION: Trigger queue assignment after payment
// ============================================================================

/**
 * Auto-generate queue numbers after successful payment
 * Called when staff marks appointment as paid OR online payment completes
 * 
 * Sets:
 * - display_queue (U01, N02, etc)
 * - queue_number (1, 2, 3, ...)
 * - status: pending → confirmed (if was pending)
 * 
 * @param {Object} appointment - Appointment object (must have: id, code, appointment_date, doctor_id, queue_type)
 * @param {Object} transaction - Sequelize transaction
 * @returns {Promise<Object>} Updated appointment
 * 
 * @log Trace appointment code, queue_type, generated displays, status change
 */
async function autoGenerateQueueAfterPayment(appointment, transaction = null) {
  try {
    const { code, appointment_date, doctor_id, queue_type } = appointment;
    const dateStr = moment(appointment_date).format('YYYY-MM-DD');

    console.log(`[appointmentHelper] autoGenerateQueueAfterPayment: code=${code}, queueType=${queue_type}`);

    // 1. Generate display_queue (U01, N02, etc) scoped by service
    const displayQueue = await generateQueueNumber(
      appointment_date,
      appointment.service_id,
      queue_type === 'priority' ? 'priority' : 'normal',
      transaction
    );

    // 2. Generate regular queue_number (sequential) scoped by service
    const { literal } = require('sequelize');
    const maxQueueRecord = await models.Appointment.findOne({
      where: {
        appointment_date: dateStr,
        service_id: appointment.service_id,
        queue_number: { [Op.ne]: null }
      },
      order: [['queue_number', 'DESC']],
      attributes: ['queue_number'],
      transaction: transaction
    });

    const nextQueueNumber = (maxQueueRecord?.queue_number || 0) + 1;
    console.log(`[appointmentHelper] Generated queue_number: ${nextQueueNumber}`);

    // 3. Update appointment with queue info
    const updateData = {
      display_queue: displayQueue,
      queue_number: nextQueueNumber,
      checked_in_at: new Date() // Also mark as checked-in (capped)
    };

    // Change status: pending → confirmed (trong payment flow)
    if (appointment.status === 'pending') {
      updateData.status = 'confirmed';
      console.log(`[appointmentHelper] Status change: pending → confirmed`);
    }

    await appointment.update(updateData, { transaction });
    console.log(`[appointmentHelper] Queue assignment completed: ${displayQueue} (queue #${nextQueueNumber})`);

    return appointment;

  } catch (error) {
    console.error(`[appointmentHelper] Error in autoGenerateQueueAfterPayment:`, error.message);
    throw error;
  }
}

// ============================================================================
// Export functions
// ============================================================================

module.exports = {
  calculateQueueType,
  getDoctorAvailabilityContext,
  findSoonestAvailableSlot,
  generateQueueNumber,
  autoGenerateQueueAfterPayment
};
