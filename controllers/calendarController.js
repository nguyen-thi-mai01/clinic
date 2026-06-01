// server/controllers/calendarController.js
const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment'); // Đảm bảo đã import

// Helper gán thông tin user vào sự kiện
const mapUserToEvent = (event, userMap) => {
  const eventJSON = event.toJSON ? event.toJSON() : event;
  // SỬA: Dùng user_id từ bản thân event (nếu có)
  const userId = event.user_id || event.user?.id; 
  const user = userMap.get(userId);
  return {
    ...eventJSON,
    user: user || null,
  };
};

exports.getCalendarData = async (req, res) => {
  try {
    const { user_ids, date_from, date_to, types, user_ids_kind } = req.query;
    const requestUser = req.user;

    if (!date_from || !date_to) {
      return res.status(400).json({ success: false, message: 'Thiếu date_from hoặc date_to' });
    }

    let targetUserIds = [];
    // SỬA: Bổ sung 'overtime' vào types mặc định
    let typesToFetch = types ? types.split(',') : ['schedules', 'leaves', 'appointments', 'overtime'];

    // ========== 1. Xác định danh sách User ==========
    // ✅ FIX QUAN TRỌNG: KHÔNG dùng hasOwnProperty vì req.query trong Express là Object không có prototype.
    // Dùng req.query.user_ids !== undefined để tránh bị crash và nhảy vào catch.
    try {
      if (req.query.user_ids !== undefined) {
        // user_ids được gửi (dù rỗng hay không)
        if (user_ids && user_ids.trim && user_ids.trim()) {
          targetUserIds = user_ids.split(',')
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id)); // Lọc bỏ NaN
        }
        
        if (targetUserIds.length > 5) {
          return res.status(400).json({ success: false, message: 'Chỉ được phép lọc tối đa 5 người dùng' });
        }
        
        // Check quyền
        if (!['admin', 'staff', 'doctor'].includes(requestUser.role) && (targetUserIds.length > 1 || (targetUserIds.length === 1 && targetUserIds[0] !== requestUser.id))) {
          return res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch của người dùng khác' });
        }
        
        // Nếu admin gửi user_ids rỗng, return dữ liệu rỗng (không lấy appointments)
        if (targetUserIds.length === 0) {
  if (requestUser.role === 'admin') {
    const allUsers = await models.User.findAll({
      where: { role: { [Op.in]: ['doctor', 'staff'] } },
      attributes: ['id']
    });
    targetUserIds = allUsers.map(u => u.id);
  } else {
    targetUserIds = [requestUser.id];
  }
}
      } else {
        // user_ids không được gửi -> dùng default logic
        if (requestUser.role === 'admin') {
          const allUsers = await models.User.findAll({
            where: { role: { [Op.in]: ['doctor', 'staff'] } },
            attributes: ['id']
          });
          targetUserIds = allUsers.map(u => u.id);
        } else {
          targetUserIds = [requestUser.id];
        }
      }
    } catch (err) {
      console.error('Error parsing user_ids:', err);
      targetUserIds = [requestUser.id];
    }

    // HỖ TRỢ: Frontend đôi khi gửi ID của bảng Doctor (thay vì ID User) — map chúng về user_id
    // Nếu client đã nói rõ là user IDs thì không map ngược sang Doctor để tránh mở rộng nhầm lịch.
    try {
      if (targetUserIds.length > 0 && user_ids_kind !== 'user') {
        // Tách các ID có thể là doctor.id
        const doctorRecords = await models.Doctor.findAll({ where: { id: { [Op.in]: targetUserIds } }, attributes: ['id', 'user_id'] });
        const doctorUserIds = doctorRecords.map(d => d.user_id).filter(Boolean);

        // Tách các ID thực sự là user.id
        const userRecords = await models.User.findAll({ where: { id: { [Op.in]: targetUserIds } }, attributes: ['id'] });
        const userIds = userRecords.map(u => u.id);

        // Kết hợp và loại bỏ trùng
        const combined = Array.from(new Set([...(userIds || []), ...(doctorUserIds || [])]));
        if (combined.length > 0) targetUserIds = combined;
      }
    } catch (err) {
      console.error('Error mapping doctor IDs to user IDs:', err);
    }

    let resolvedDoctorIds = [];
    let resolvedDoctorUserIds = [];
    try {
      if (targetUserIds.length > 0) {
        const doctorRecords = await models.Doctor.findAll({
          where: {
            [Op.or]: [
              { id: { [Op.in]: targetUserIds } },
              { user_id: { [Op.in]: targetUserIds } }
            ]
          },
          attributes: ['id', 'user_id']
        });
        resolvedDoctorIds = Array.from(new Set(doctorRecords.map(d => d.id).filter(Boolean)));
        resolvedDoctorUserIds = Array.from(new Set(doctorRecords.map(d => d.user_id).filter(Boolean)));
      }
    } catch (err) {
      console.error('Error resolving doctor IDs:', err);
    }

    if (targetUserIds.length === 0) {
      return res.status(200).json({ 
        success: true, 
        data: { schedules: [], leaves: [], appointments: [], overtime_schedules: [] } 
      });
    }

    // DEBUG: Log targetUserIds
    console.log('[DEBUG] REQUEST PARAMS - user_ids:', req.query.user_ids);
    console.log('[DEBUG] REQUEST PARAMS - date_from:', req.query.date_from);
    console.log('[DEBUG] REQUEST PARAMS - date_to:', req.query.date_to);
    console.log('[DEBUG] Parsed targetUserIds:', targetUserIds);
    console.log('[DEBUG] Resolved doctor IDs:', resolvedDoctorIds);
    console.log('[DEBUG] Resolved doctor user IDs:', resolvedDoctorUserIds);
    console.log('[DEBUG] typesToFetch:', typesToFetch);

    // ========== 2. Lấy thông tin User (UserMap) ==========
    const users = await models.User.findAll({
      where: { id: { [Op.in]: targetUserIds } },
      attributes: ['id', 'full_name', 'avatar_url', 'role']
    });
    const userMap = new Map(users.map(u => [u.id, u.toJSON()]));

    // ========== 3. Lấy dữ liệu theo từng loại ==========
    let schedules = []; // Lịch làm việc (Fixed/Flexible)
    let overtime_schedules = []; // Lịch tăng ca
    let leaves = []; // Lịch nghỉ
    let appointments = []; // Lịch hẹn
    
    const dateRange = { [Op.between]: [date_from, date_to] };

    // --- A. TỰ ĐỘNG SINH LỊCH LÀM VIỆC (Schedules) ---
    if (typesToFetch.includes('schedules')) {
      // 1. Lấy cấu hình ca cố định (WorkShiftConfig)
      const shiftsConfig = await models.WorkShiftConfig.findAll({ 
        where: { is_active: true } 
      });
      
      // 2. Lấy thông tin (Doctor/Staff) của tất cả user mục tiêu
      // (Bao gồm bản đăng ký 'active' của họ)
      const userProfiles = await models.User.findAll({
        where: { id: { [Op.in]: targetUserIds } },
        attributes: ['id', 'role'],
        include: [
          {
            model: models.Doctor,
            required: false,
            attributes: ['id', 'schedule_preference_type', 'current_schedule_id'],
            include: [{
              model: models.Schedule,
              as: 'activeScheduleRegistration',
              attributes: ['weekly_schedule_json'],
              required: false 
            }]
          },
          {
            model: models.Staff,
            required: false,
            attributes: ['id', 'schedule_preference_type', 'current_schedule_id'],
            include: [{
              model: models.Schedule,
              as: 'activeScheduleRegistration',
              attributes: ['weekly_schedule_json'],
              required: false 
            }]
          }
        ]
      });

      // 3. Helper lặp ngày
      const getDatesInRange = (startDate, endDate) => {
        const dates = [];
        let currentDate = moment(startDate);
        const stopDate = moment(endDate);
        while (currentDate <= stopDate) {
          dates.push({ 
            date: currentDate.format('YYYY-MM-DD'), 
            dayOfWeek: currentDate.day() // 0 = CN, 1 = T2
          });
          currentDate = currentDate.add(1, 'days');
        }
        return dates;
      };
      const allDates = getDatesInRange(date_from, date_to);

      // 4. Lặp qua từng user và sinh lịch
      for (const profile of userProfiles) {
        const user_id = profile.id;
        const user_role = profile.role;
        const userMapData = userMap.get(user_id);
        
        const userTypeProfile = (user_role === 'doctor') ? profile.Doctor : profile.Staff;
        
        const preference = userTypeProfile?.schedule_preference_type || 'fixed';
        const activeReg = userTypeProfile?.activeScheduleRegistration;
        const flexibleJson = activeReg?.weekly_schedule_json;

        // Lặp qua các ngày trong khoảng thời gian
        for (const { date, dayOfWeek } of allDates) {
          
          if (preference === 'fixed') {
            // ----- LOGIC LỊCH CỐ ĐỊNH -----
            for (const shift of shiftsConfig) {
              if (shift.days_of_week.includes(dayOfWeek)) {
                schedules.push({
                  id: `fixed-${user_id}-${date}-${shift.shift_name}`,
                  user_id: user_id,
                  user: userMapData,
                  date: date,
                  start_time: shift.start_time,
                  end_time: shift.end_time,
                  schedule_type: 'fixed', // Màu Xanh
                  status: 'available' 
                });
              }
            }
          } 
          else if (preference === 'flexible' && flexibleJson) {
            // ----- LOGIC LỊCH LINH HOẠT -----
            const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek]; 
            const flexibleSlots = flexibleJson[dayKey] || []; 
            
            for (const slot of flexibleSlots) {
              const [start_time, end_time] = slot.split('-');
              if (start_time && end_time) {
                schedules.push({
                  id: `flex-${user_id}-${date}-${start_time}`,
                  user_id: user_id,
                  user: userMapData,
                  date: date,
                  start_time: `${start_time}:00`,
                  end_time: `${end_time}:00`,
                  schedule_type: 'flexible', // Màu Tím
                  status: 'available'
                });
              }
            }
          }
        }
      }
    }
    
    // --- B. LẤY LỊCH TĂNG CA (Overtime) ---
    if (typesToFetch.includes('overtime')) {
      // Parse raw input ids (frontend may send doctor.id or user.id)
      const rawInputIds = req.query.user_ids && req.query.user_ids.trim ? (user_ids && user_ids.trim() ? user_ids.split(',').map(i => parseInt(i, 10)).filter(i => !isNaN(i)) : []) : [];

      // Find doctor records that match either input doctor IDs or by user_id
      const doctorsById = rawInputIds.length ? await models.Doctor.findAll({ where: { id: { [Op.in]: rawInputIds } }, attributes: ['id', 'user_id'] }) : [];
      const userIdsFromDoctorInput = doctorsById.map(d => d.user_id).filter(Boolean);

      const usersById = rawInputIds.length ? await models.User.findAll({ where: { id: { [Op.in]: rawInputIds } }, attributes: ['id'] }) : [];
      const userIdsDirect = usersById.map(u => u.id);

      // Also find doctors that correspond to user IDs in both raw input and resolved targetUserIds
      const userIdsForDoctorLookup = Array.from(new Set([...(userIdsDirect || []), ...(targetUserIds || [])]));
      const doctorsByUserIds = userIdsForDoctorLookup.length
        ? await models.Doctor.findAll({ where: { user_id: { [Op.in]: userIdsForDoctorLookup } }, attributes: ['id', 'user_id'] })
        : [];
      const doctorIdsFromUserIds = doctorsByUserIds.map(d => d.id);

      const doctorIdsToSearch = Array.from(new Set([...(doctorsById.map(d => d.id)), ...doctorIdsFromUserIds]));
      const userIdsToSearch = Array.from(new Set([...(userIdsDirect), ...userIdsFromDoctorInput, ...targetUserIds]));
      const overtimeUserIdsToSearch = Array.from(new Set([...(userIdsToSearch), ...(doctorIdsToSearch)]));

      const overtimeData = await models.Schedule.findAll({
        where: {
          schedule_type: 'overtime',
          status: 'approved',
          date: dateRange,
          [Op.or]: [
            { user_id: { [Op.in]: overtimeUserIdsToSearch } },
            { doctor_id: { [Op.in]: doctorIdsToSearch } }
          ]
        }
      });
      console.log('[DEBUG-OT] Overtime records found:', overtimeData.length);
      if (overtimeData.length === 0) {
        console.log('[DEBUG-OT] Sample overtime records in DB with status="approved":');
        const sampleOT = await models.Schedule.findAll({ where: { schedule_type: 'overtime', status: 'approved' }, limit: 5 });
        console.log('[DEBUG-OT]', sampleOT.map(s => ({ id: s.id, user_id: s.user_id, doctor_id: s.doctor_id, status: s.status, date: s.date })));
      }

      overtime_schedules = overtimeData.map(event => {
        const ev = event.toJSON ? event.toJSON() : event;
        const docByDoctorId = doctorsById.find(d => d.id === ev.doctor_id) || doctorsByUserIds.find(d => d.id === ev.doctor_id);
        const docByLegacyUserId = ev.user_type === 'doctor'
          ? (doctorsById.find(d => d.id === ev.user_id) || doctorsByUserIds.find(d => d.id === ev.user_id))
          : null;

        if (docByLegacyUserId) {
          ev.user_id = docByLegacyUserId.user_id;
          ev.doctor_id = docByLegacyUserId.id;
        } else if (!ev.user_id && docByDoctorId) {
          ev.user_id = docByDoctorId.user_id;
          ev.doctor_id = docByDoctorId.id;
        } else if (docByDoctorId && (!ev.user_id || !userMap.has(ev.user_id))) {
          ev.user_id = docByDoctorId.user_id;
          ev.doctor_id = docByDoctorId.id;
        }
        return mapUserToEvent(ev, userMap);
      });
    }


    // --- C. Lấy Lịch Nghỉ (Leaves) ---
    if (typesToFetch.includes('leaves')) {
      // Parse raw input ids as above
      const rawInputIds = req.query.user_ids && req.query.user_ids.trim ? (user_ids && user_ids.trim() ? user_ids.split(',').map(i => parseInt(i, 10)).filter(i => !isNaN(i)) : []) : [];

      const doctorsById = rawInputIds.length ? await models.Doctor.findAll({ where: { id: { [Op.in]: rawInputIds } }, attributes: ['id', 'user_id'] }) : [];
      const userIdsFromDoctorInput = doctorsById.map(d => d.user_id).filter(Boolean);
      const usersById = rawInputIds.length ? await models.User.findAll({ where: { id: { [Op.in]: rawInputIds } }, attributes: ['id'] }) : [];
      const userIdsDirect = usersById.map(u => u.id);
      const userIdsForDoctorLookup = Array.from(new Set([...(userIdsDirect || []), ...(targetUserIds || [])]));
      const doctorsByUserIds = userIdsForDoctorLookup.length
        ? await models.Doctor.findAll({ where: { user_id: { [Op.in]: userIdsForDoctorLookup } }, attributes: ['id', 'user_id'] })
        : [];
      const doctorIdsFromUserIds = doctorsByUserIds.map(d => d.id);
      const doctorIdsToSearch = Array.from(new Set([...(doctorsById.map(d => d.id)), ...doctorIdsFromUserIds]));
      const userIdsToSearch = Array.from(new Set([...(userIdsDirect), ...userIdsFromDoctorInput, ...targetUserIds]));

      // 1) LeaveRequest table (explicit leaves)
      const leaveUserIdsToSearch = Array.from(new Set([...(userIdsToSearch), ...(doctorIdsToSearch)]));

      const leaveData = await models.LeaveRequest.findAll({
        where: {
          user_id: { [Op.in]: leaveUserIdsToSearch },
          status: 'approved',
          [Op.or]: [
            { date_to: { [Op.not]: null }, date_from: { [Op.lte]: date_to }, date_to: { [Op.gte]: date_from } },
            { date_to: null, date_from: dateRange }
          ]
        }
      });
      console.log('[DEBUG-LEAVE] LeaveRequest records found:', leaveData.length);

      // 2) Schedule table where schedule_type='leave'
      const leaveSchedules = await models.Schedule.findAll({
        where: {
          schedule_type: 'leave',
          date: dateRange,
          [Op.or]: [ { user_id: { [Op.in]: userIdsToSearch } }, { doctor_id: { [Op.in]: doctorIdsToSearch } } ]
        }
      });
      console.log('[DEBUG-LEAVE] Schedule(leave) records found:', leaveSchedules.length);

      const mappedFromRequests = leaveData.map(event => {
        const ev = event.toJSON ? event.toJSON() : event;
        const docByDoctorId = doctorsById.find(d => d.id === ev.doctor_id) || doctorsByUserIds.find(d => d.id === ev.doctor_id);
        const docByLegacyUserId = ev.user_type === 'doctor'
          ? (doctorsById.find(d => d.id === ev.user_id) || doctorsByUserIds.find(d => d.id === ev.user_id))
          : null;

        if (docByLegacyUserId) {
          ev.user_id = docByLegacyUserId.user_id;
          ev.doctor_id = docByLegacyUserId.id;
        } else if (docByDoctorId && (!ev.user_id || !userMap.has(ev.user_id))) {
          ev.user_id = docByDoctorId.user_id;
          ev.doctor_id = docByDoctorId.id;
        }
        return mapUserToEvent(ev, userMap);
      });
      const mappedFromSchedules = leaveSchedules.map(sch => {
        const sj = sch.toJSON ? sch.toJSON() : sch;
        const docByDoctorId = doctorsById.find(d => d.id === sj.doctor_id) || doctorsByUserIds.find(d => d.id === sj.doctor_id);
        const docByLegacyUserId = sj.user_type === 'doctor'
          ? (doctorsById.find(d => d.id === sj.user_id) || doctorsByUserIds.find(d => d.id === sj.user_id))
          : null;

        if (docByLegacyUserId) {
          sj.user_id = docByLegacyUserId.user_id;
          sj.doctor_id = docByLegacyUserId.id;
        } else if (!sj.user_id && docByDoctorId) {
          sj.user_id = docByDoctorId.user_id;
          sj.doctor_id = docByDoctorId.id;
        }
        return mapUserToEvent(sj, userMap);
      });

      leaves = [...mappedFromRequests, ...mappedFromSchedules];
    }

    // --- D. Lấy Lịch Hẹn (Appointments) ---
    if (typesToFetch.includes('appointments')) {
      console.log('[DEBUG-APPT] Looking for appointments with doctors having user_id IN:', targetUserIds);
      console.log('[DEBUG-APPT] Date range:', dateRange);
      
      const appointmentData = await models.Appointment.findAll({
        where: {
          appointment_date: dateRange,
          status: { [Op.notIn]: ['cancelled', 'passed'] }
        },
        include: [
          {
            model: models.Doctor,
            as: 'Doctor',
            required: true,
            attributes: ['id', 'user_id'],
            where: {
              [Op.or]: [
                { user_id: { [Op.in]: targetUserIds } },
                { id: { [Op.in]: resolvedDoctorIds } }
              ]
            }
          },
          { 
            model: models.Patient, 
            as: 'Patient',
            attributes: ['id', 'user_id'], 
            required: false,
            include: [{
              model: models.User,
              attributes: ['full_name', 'email', 'phone'],
              required: false
            }]
          },
        ],
        attributes: [
          'id', 'patient_id', 'doctor_id', 'guest_name', 'guest_phone', 'code', 'status',
          'appointment_date', 'appointment_start_time', 'appointment_end_time'
        ]
      });
      
      console.log('[DEBUG-APPT] Appointment records found:', appointmentData.length, 'for user IDs:', targetUserIds);
      if (appointmentData.length > 0) {
        console.log('[DEBUG-APPT] First appointment details:', {
          id: appointmentData[0].id,
          doctor_id: appointmentData[0].doctor_id,
          doctor_user_id: appointmentData[0].Doctor?.user_id,
          status: appointmentData[0].status,
          appointment_date: appointmentData[0].appointment_date
        });
      }
      
      appointments = appointmentData.map(app => {
        const appJSON = app.toJSON();
        const userId = app.Doctor?.user_id;
        
        if (appJSON.Patient && appJSON.Patient.User) {
           appJSON.Patient.full_name = appJSON.Patient.User.full_name;
        }

        return {
          ...appJSON,
          date: appJSON.appointment_date, 
          start_time: appJSON.appointment_start_time,
          end_time: appJSON.appointment_end_time,
          appointment_type: 'service', // ✅ Mark as service appointment
          user_id: userId,
          user: userMap.get(userId) || null
        };
      });
    }

    // --- E. Include Consultations that look like appointments (so dashboard/calendar shows them) ---
    if (typesToFetch.includes('appointments')) {
      try {
        console.log('[DEBUG-CONSULT] Query params - user_ids:', targetUserIds, 'date range:', { [Op.between]: [date_from, date_to] });
        
        const consultationData = await models.Consultation.findAll({
          where: {
            appointment_time: dateRange,
            status: { [Op.notIn]: ['cancelled', 'passed'] }
          },
          include: [
            {
              model: models.User,
              as: 'doctor',
              required: true,
              attributes: ['id', 'full_name', 'avatar_url'],
              where: {
                [Op.or]: [
                  { id: { [Op.in]: targetUserIds } },
                  { id: { [Op.in]: resolvedDoctorUserIds } }
                ]
              }
            },
            {
              model: models.User,
              as: 'patient',
              required: false,
              attributes: ['id', 'full_name', 'email', 'phone']
            }
          ],
          attributes: [
            'id', 'patient_id', 'doctor_id', 'consultation_code', 'status', 'appointment_time', 'started_at', 'ended_at', 'duration_minutes'
          ]
        });

        console.log('[DEBUG-CONSULT] Consultation records found:', consultationData.length);
        if (consultationData.length > 0) {
          console.log('[DEBUG-CONSULT] First consultation:', {
            id: consultationData[0].id,
            doctor_id: consultationData[0].doctor_id,
            doctor: consultationData[0].doctor?.id,
            status: consultationData[0].status,
            appointment_time: consultationData[0].appointment_time
          });
        }

        const mappedConsultations = consultationData.map(c => {
          const cJSON = c.toJSON();
          const userId = c.doctor?.id;
          // appointment_date and times adapted from appointment_time / started_at
          // Ensure we convert Date objects to ISO string first if needed
          const getISOString = (dateVal) => {
            if (!dateVal) return null;
            if (dateVal instanceof Date) return dateVal.toISOString();
            if (typeof dateVal === 'string' && dateVal.includes('T')) return dateVal;
            return String(dateVal);
          };
          
          // Convert UTC time to local time (Vietnam timezone: UTC+7)
          const convertToLocalTime = (isoDateString) => {
            if (!isoDateString) return null;
            try {
              const date = new Date(isoDateString);
              // Check if date is valid
              if (isNaN(date.getTime())) {
                console.warn('[WARNING] Invalid date for time conversion:', isoDateString);
                return null;
              }
              const localDate = new Date(date.getTime() + 7 * 60 * 60 * 1000); // Add 7 hours for UTC+7
              const iso = localDate.toISOString();
              const timeStr = iso.substring(11, 16); // HH:mm format from ISO string
              return timeStr;
            } catch (err) {
              console.error('[ERROR] Failed to convert time:', isoDateString, err.message);
              return null;
            }
          };
          
          const convertToLocalDate = (isoDateString) => {
            if (!isoDateString) return null;
            try {
              const date = new Date(isoDateString);
              // Check if date is valid
              if (isNaN(date.getTime())) {
                // Try to parse as local YYYY-MM-DD if already in that format
                const match = String(isoDateString).match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (match) {
                  return `${match[1]}-${match[2]}-${match[3]}`;
                }
                console.warn('[WARNING] Invalid date for conversion:', isoDateString);
                return null;
              }
              const localDate = new Date(date.getTime() + 7 * 60 * 60 * 1000); // Add 7 hours for UTC+7
              const iso = localDate.toISOString();
              const dateStr = iso.substring(0, 10); // YYYY-MM-DD format
              return dateStr;
            } catch (err) {
              console.error('[ERROR] Failed to convert date:', isoDateString, err.message);
              return null;
            }
          };
          
          const isoTime = getISOString(cJSON.appointment_time) || getISOString(cJSON.started_at);
          const appointmentDate = convertToLocalDate(isoTime);
          const appointmentTime = convertToLocalTime(isoTime);
          
          let endTime = null;
          const isoEndTime = getISOString(cJSON.ended_at);
          if (isoEndTime) {
            endTime = convertToLocalTime(isoEndTime);
          } else if (appointmentTime) {
            const durationMinutes = Number(cJSON.duration_minutes || 0);
            if (durationMinutes > 0) {
              const [hours, minutes] = appointmentTime.split(':').map(Number);
              if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
                const totalMinutes = hours * 60 + minutes + durationMinutes;
                const endHours = Math.floor((totalMinutes % (24 * 60)) / 60);
                const endMinutes = totalMinutes % 60;
                endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
              }
            }
          }

          // patient is included directly as User on Consultation model
          if (cJSON.patient) {
            cJSON.patient.full_name = cJSON.patient.full_name || cJSON.patient.name;
          }

          return {
            ...cJSON,
            id: `consult-${cJSON.id}`,
            code: cJSON.consultation_code,
            date: appointmentDate,
            start_time: appointmentTime,
            end_time: endTime,
            appointment_type: 'online', // ✅ Mark as online consultation
            user_id: userId,
            user: userMap.get(userId) || null,
            is_consultation: true
          };
        });

        // Append consultations to appointments array so frontend calendar shows them
        console.log('[DEBUG-CONSULT] Mapped consultations count:', mappedConsultations.length);
        if (mappedConsultations.length > 0) {
          console.log('[DEBUG-CONSULT] First mapped:', {
            id: mappedConsultations[0].id,
            is_consultation: mappedConsultations[0].is_consultation,
            date: mappedConsultations[0].date,
            user_id: mappedConsultations[0].user_id
          });
        }
        appointments = [...appointments, ...mappedConsultations];
        console.log('[DEBUG-APPPT-FINAL] After adding consultations, total appointments:', appointments.length);
      } catch (err) {
        console.error('Error fetching consultations for calendar:', err);
      }
    }

    // DEBUG: Log final response
    console.log('[DEBUG-FINAL] Final Response Counts:', {
      schedules: schedules.length,
      overtime_schedules: overtime_schedules.length,
      leaves: leaves.length,
      appointments: appointments.length,
      targetUserIds: targetUserIds,
      requestedUserIds: req.query.user_ids
    });

    // Trả về 4 mảng dữ liệu
    res.status(200).json({
      success: true,
      data: {
        schedules: schedules,
        overtime_schedules: overtime_schedules, // Bổ sung
        leaves: leaves,
        appointments: appointments
      }
    });

  } catch (error) {
    console.error('ERROR in getCalendarData:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy dữ liệu lịch',
      error: error.message
    });
  }
};