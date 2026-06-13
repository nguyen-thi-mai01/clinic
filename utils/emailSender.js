// server/utils/emailSender.js


const BASE_STYLE = `
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
    .header { background-color: #4CAF50; color: #ffffff; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
    .content { padding: 30px; background-color: #ffffff; }
    .content p { margin-bottom: 20px; font-size: 16px; }
    .footer { text-align: center; padding: 20px; font-size: 13px; color: #666; background-color: #f9fafb; border-top: 1px solid #eee; }
    .button { display: inline-block; padding: 14px 30px; background-color: #2E7D32; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: background-color 0.3s; }
    .button:hover { background-color: #1B5E20; }
    .link-text { word-break: break-all; color: #555; padding: 15px; background-color: #f5f5f5; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 14px; border: 1px dashed #ccc; }
    .warning { color: #D32F2F; font-weight: bold; }
    .info-box { background-color: #F1F8E9; border-left: 5px solid #4CAF50; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .danger-box { background-color: #FFF3F3; border-left: 5px solid #E53935; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #c8e6c9; }
    .info-row:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #555; }
    .value { font-weight: 600; color: #222; text-align: right; }
    .otp-code { font-size: 32px; font-weight: 800; color: #1565C0; text-align: center; padding: 20px; background: #E3F2FD; border-radius: 8px; margin: 25px 0; letter-spacing: 8px; border: 2px dashed #90CAF9; }
    .subtle { color: #666; font-size: 14px; }
  </style>
`;

const { Resend } = require('resend');

const sendEmail = async (emailData) => {
  try {
    const { to, subject, template, data, html, text } = emailData;
    if (!to || !subject) throw new Error('Email address and subject are required');

    const emailContent = html || generateHTMLFromTemplate(template, data);
    const textContent = text || generateTextFromTemplate(template, data);

    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `${process.env.HOSPITAL_NAME || 'Easy Medify'} <support@easymedify.com>`,
      to,
      subject,
      html: emailContent,
      text: textContent
    });

    console.log(`Email sent successfully to ${to}. ID: ${result.data?.id}`);
    return { success: true, messageId: result.data?.id, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message, message: 'Failed to send email' };
  }
};

const generateHTMLFromTemplate = (templateName, data = {}) => {
  const headerColors = { warning: '#D32F2F', info: '#0288D1', success: '#4CAF50', alert: '#FBC02D' };

  const templates = {
    verification_email: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header"><h1>Kich hoat tai khoan</h1></div><div class="content"><p>Xin chao <strong>${data.userName || 'Quy khach'}</strong>,</p><p>Cam on ban da dang ky tai khoan tai <strong>Easy Medify</strong>. Vui long xac thuc dia chi email cua ban.</p><div style="text-align: center;"><a href="${data.verificationLink}" class="button">XAC THUC TAI KHOAN NGAY</a></div></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    password_reset_request: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color: ${headerColors.alert}; color: #333;"><h1>Dat lai mat khau</h1></div><div class="content"><p>Xin chao <strong>${data.userName}</strong>,</p><p>Ban da yeu cau dat lai mat khau. Vui long nhan vao nut ben duoi:</p><div style="text-align: center;"><a href="${data.resetLink}" class="button" style="background-color: #F57F17;">DAT LAI MAT KHAU</a></div></div><div class="footer"><p>Easy Medify Security</p></div></div></body></html>`,
    password_reset_success: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header"><h1>Mat khau da thay doi</h1></div><div class="content"><p>Xin chao <strong>${data.userName}</strong>,</p><p>Mat khau cua ban da duoc thay doi thanh cong vao luc: ${data.dateTime || new Date().toLocaleString('vi-VN')}</p></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    account_verified: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header"><h1>Tai khoan da kich hoat!</h1></div><div class="content"><p>Xin chao <strong>${data.userName}</strong>,</p><p>Tai khoan cua ban da duoc kich hoat thanh cong.</p></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    welcome_email: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header"><h1>Chao mung!</h1></div><div class="content"><p>Xin chao <strong>${data.userName}</strong>,</p><p>Cam on ban da tham gia cung chung toi.</p></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    appointment_confirmation: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header"><h1>Xac nhan dat lich</h1></div><div class="content"><p>Xin chao <strong>${data.patientName}</strong>,</p><p>Ma lich hen cua ban la: <strong>${data.appointmentCode}</strong></p></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    appointment_reminder: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color: ${headerColors.alert}; color: #333;"><h1>Nhac nho lich hen</h1></div><div class="content"><p>Xin chao <strong>${data.patientName}</strong>,</p><p>Ban co lich hen vao ngay mai.</p></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    appointment_cancelled: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color: ${headerColors.warning};"><h1>Huy lich hen</h1></div><div class="content"><p>Xin chao <strong>${data.patientName || 'Quy khach'}</strong>,</p><p>Lich hen <strong>${data.appointmentCode || ''}</strong> da bi huy.</p><div class="danger-box"><p style="margin:0"><strong>Ly do:</strong> ${data.cancelReason || 'Khong co'}</p><p style="margin:10px 0 0 0"><strong>Thoi gian:</strong> ${data.cancelledAt || new Date().toLocaleString('vi-VN')}</p></div><p class="subtle">Neu lich nay da duoc thanh toan, he thong se gui email huong dan hoan tien hoac hoan tien tu dong tuy theo phuong thuc thanh toan.</p><div style="text-align: center;"><a href="${data.refundLink || `${process.env.CLIENT_URL || 'http://localhost:3000'}/lich-hen/${data.appointmentCode || ''}`}" class="button">XEM / GUI YEU CAU HOAN TIEN</a></div></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    appointment_cancelled_payment_deadline: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color: ${headerColors.warning};"><h1>Lich hen bi huy do het han thanh toan</h1></div><div class="content"><p>Xin chao <strong>${data.patientName || 'Quy khach'}</strong>,</p><p>Lich hen <strong>${data.appointmentCode || ''}</strong> da bi huy vi ban chua hoan tat thanh toan truoc han.</p><div class="danger-box"><p style="margin:0"><strong>Bac si:</strong> ${data.doctorName || 'Bac si'}</p><p style="margin:10px 0 0 0"><strong>Dich vu:</strong> ${data.serviceName || 'Dich vu'}</p><p style="margin:10px 0 0 0"><strong>Ngay hen:</strong> ${data.appointmentDate || '---'} ${data.appointmentStartTime || ''}</p><p style="margin:10px 0 0 0"><strong>Han thanh toan:</strong> ${data.paymentDeadline || '---'}</p></div><p class="subtle">Vui long dat lich moi neu ban van co nhu cau kham chua benh.</p><div style="text-align: center;"><a href="${data.appointmentLink || `${process.env.CLIENT_URL || 'http://localhost:3000'}/lich-hen/${data.appointmentCode || ''}`}" class="button" style="background-color:#607D8B;">XEM LICH HEN</a></div></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    consultation_cancelled_payment_deadline: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color: ${headerColors.warning};"><h1>Buoi tu van bi huy do het han thanh toan</h1></div><div class="content"><p>Xin chao <strong>${data.patientName || 'Quy khach'}</strong>,</p><p>Buoi tu van <strong>${data.consultationCode || ''}</strong> da bi huy vi ban chua hoan tat thanh toan truoc han.</p><div class="danger-box"><p style="margin:0"><strong>Bac si:</strong> ${data.doctorName || 'Bac si'}</p><p style="margin:10px 0 0 0"><strong>Hinh thuc tu van:</strong> ${data.consultationType || 'Tu van'}</p><p style="margin:10px 0 0 0"><strong>Thoi gian hen:</strong> ${data.appointmentTime || '---'}</p><p style="margin:10px 0 0 0"><strong>Han thanh toan:</strong> ${data.paymentDeadline || '---'}</p></div><p class="subtle">Vui long tao lich moi neu ban muon dat lai buoi tu van.</p><div style="text-align: center;"><a href="${data.consultationLink || `${process.env.CLIENT_URL || 'http://localhost:3000'}/tu-van/${data.consultationId || ''}`}" class="button" style="background-color:#607D8B;">XEM BUOI TU VAN</a></div></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    refund_request_prompt: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color: ${headerColors.alert};"><h1>Yeu cau hoan tien</h1></div><div class="content"><p>Xin chao <strong>${data.patientName || 'Quy khach'}</strong>,</p><p>He thong da ghi nhan lich hen <strong>${data.appointmentCode || ''}</strong> bi huy va co the hoan tien.</p><div class="info-box"><p style="margin:0"><strong>So tien du kien:</strong> ${data.refundAmount ? new Intl.NumberFormat('vi-VN').format(data.refundAmount) : '0'} VNĐ</p><p style="margin:10px 0 0 0"><strong>Trang thai:</strong> Dang cho xac nhan</p></div><p class="subtle">Vui long mo form hoan tien de nhap thong tin tai khoan nhan tien. Neu ban thanh toan qua ngan hang/vi dien tu, he thong se doi chieu va xu ly theo quy trinh.</p><div style="text-align: center;"><a href="${data.refundLink || `${process.env.CLIENT_URL || 'http://localhost:3000'}/lich-hen/${data.appointmentCode || ''}`}" class="button" style="background-color:#F57C00;">MO FORM HOAN TIEN</a></div></div><div class="footer"><p>Easy Medify Finance</p></div></div></body></html>`,
    refund_request_received: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color: ${headerColors.info};"><h1>Da tiep nhan yeu cau hoan tien</h1></div><div class="content"><p>Xin chao <strong>${data.patientName || 'Quy khach'}</strong>,</p><p>Yeu cau hoan tien cho lich <strong>${data.appointmentCode || ''}</strong> da duoc gui thanh cong.</p><div class="info-box"><p style="margin:0"><strong>So tien du kien:</strong> ${data.refundAmount ? new Intl.NumberFormat('vi-VN').format(data.refundAmount) : '0'} VNĐ</p><p style="margin:10px 0 0 0"><strong>Trang thai:</strong> ${data.statusLabel || 'Dang cho staff/admin xet duyet'}</p></div><p class="subtle">Ban se nhan email tiep theo khi hoan tien duoc phe duyet hoac tu dong xu ly thanh cong.</p><div style="text-align: center;"><a href="${data.appointmentLink || `${process.env.CLIENT_URL || 'http://localhost:3000'}/lich-hen/${data.appointmentCode || ''}`}" class="button">XEM CHI TIET LICH HEN</a></div></div><div class="footer"><p>Easy Medify Finance</p></div></div></body></html>`,
    refund_request_completed: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header"><h1>Hoan tien thanh cong</h1></div><div class="content"><p>Xin chao <strong>${data.patientName || 'Quy khach'}</strong>,</p><p>Yeu cau hoan tien cho lich <strong>${data.appointmentCode || ''}</strong> da hoan tat.</p><div class="info-box"><p style="margin:0"><strong>So tien hoan:</strong> ${data.refundAmount ? new Intl.NumberFormat('vi-VN').format(data.refundAmount) : '0'} VNĐ</p><p style="margin:10px 0 0 0"><strong>Ma tham chieu:</strong> ${data.refundRef || 'AUTO_REFUND'}</p></div><p class="subtle">Neu sau 24 gio ban chua nhan duoc tien, vui long lien he CSKH de kiem tra lai giao dich.</p><div style="text-align: center;"><a href="${data.appointmentLink || `${process.env.CLIENT_URL || 'http://localhost:3000'}/lich-hen/${data.appointmentCode || ''}`}" class="button">XEM LICH HEN</a></div></div><div class="footer"><p>Easy Medify Finance</p></div></div></body></html>`,
    refund_request_rejected: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color:${headerColors.warning};"><h1>Yeu cau hoan tien bi tu choi</h1></div><div class="content"><p>Xin chao <strong>${data.patientName || 'Quy khach'}</strong>,</p><p>Yeu cau hoan tien cho lich <strong>${data.appointmentCode || ''}</strong> da duoc xem xet va tam thoi khong duoc phe duyet.</p><div class="danger-box"><p style="margin:0"><strong>Ly do:</strong> ${data.adminNote || 'Khong co'}</p></div><p class="subtle">Neu ban can ho tro them, vui long lien he CSKH hoac gui lai thong tin thanh toan chinh xac.</p><div style="text-align: center;"><a href="${data.contactLink || `${process.env.CLIENT_URL || 'http://localhost:3000'}/lien-he`}" class="button" style="background-color:#607D8B;">LIEN HE CSKH</a></div></div><div class="footer"><p>Easy Medify Finance</p></div></div></body></html>`,
    payment_success_invoice: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header"><h1>Thanh Toan Thanh Cong</h1></div><div class="content"><p>Xin chao <strong>${data.patientName || 'Quy khach'}</strong>,</p><p>Lich hen <strong>${data.appointmentCode || ''}</strong> da duoc thanh toan thanh cong.</p><div class="info-box"><p style="margin:0"><strong>Dich vu:</strong> ${data.serviceName || '---'}</p><p style="margin:10px 0 0 0"><strong>Bac si:</strong> ${data.doctorName || '---'}</p><p style="margin:10px 0 0 0"><strong>So tien:</strong> ${data.amount ? new Intl.NumberFormat('vi-VN').format(data.amount) : '0'} VNĐ</p></div><p class="subtle">Neu ban can hoan tien do huy lich, vui long mo lich hen va gui yeu cau hoan tien neu du dieu kien.</p><div style="text-align: center;"><a href="${data.link || `${process.env.CLIENT_URL || 'http://localhost:3000'}/lich-hen/${data.appointmentCode || ''}`}" class="button">XEM LICH HEN</a></div></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    chat_reminder_otp: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color: ${headerColors.info};"><h1>OTP Tu Van</h1></div><div class="content"><div class="otp-code">${data.otp}</div></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    video_reminder: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color: ${headerColors.info};"><h1>OTP Video</h1></div><div class="content"><div class="otp-code">${data.otp}</div></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    appointment_code_recovery: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header"><h1>Khoi phuc Ma</h1></div><div class="content"><p>Cac ma lich hen cua ban da duoc gui.</p></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    medical_record_created: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color:#0288D1;"><h1>Ket qua kham</h1></div><div class="content"><p>Ma tra cuu: ${data.lookupCode}</p></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    review_reminder: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header"><h1>Danh gia</h1></div><div class="content"><p>Vui long danh gia dich vu.</p></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,
    event_reminder: `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body><div class="container"><div class="header" style="background-color: ${headerColors.info};"><h1>Nhac nho tham gia su kien</h1></div><div class="content"><p>Xin chao <strong>\${data.guestName}</strong>,</p><p>Su kien <strong>\${data.eventTitle}</strong> ma ban da dang ky se dien ra vao ngay mai: <strong>\${data.startTime}</strong>.</p><div class="info-box"><p style="margin:0"><strong>Dia diem/Hinh thuc:</strong> \${data.location}</p></div><p>Vui long luu lai ma QR duoi day de Check-in khi den tham gia:</p><div class="otp-code" style="font-size: 24px; letter-spacing: 2px;">\${data.qrCode}</div><p class="subtle" style="text-align: center;">\${data.note}</p><div style="text-align: center;"><br><a href="\${data.eventLink}" class="button">XEM CHI TIET SU KIEN</a></div></div><div class="footer"><p>Easy Medify</p></div></div></body></html>`,

    contact_ticket_claimed: `
      <!DOCTYPE html><html><head>${BASE_STYLE}</head><body>
        <div class="container">
          <div class="header" style="background-color: #0288D1;"><h1>Da tiep nhan yeu cau</h1></div>
          <div class="content">
            <p>Xin chao <strong>${data.userName}</strong>,</p>
            <p>Yeu cau ho tro cua ban (Ma: <strong>#${data.ticketId}</strong>) da duoc bo phan Cham soc khach hang tiep nhan.</p>
            <div class="info-box" style="background-color: #f5f5f5; border-left-color: #9e9e9e; color: #555; font-style: italic; white-space: pre-wrap;">
              "${data.originalMessage}"
            </div>
            <p>Nhan vien <strong>${data.staffName}</strong> dang truc tiep xem xet va se phan hoi ban qua email nay trong thoi gian som nhat. Vui long giu email nay de theo doi tien trinh.</p>
          </div>
          <div class="footer"><p>Easy Medify Support Team</p></div>
        </div></body></html>`,

    // MẪU NÀY LÀ TRỌNG TÂM: HTML từ CKEditor được truyền thẳng, không có header rườm rà.
    contact_admin_reply: `
      <!DOCTYPE html><html><body>
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
          ${data.htmlContent}
        </div>
      </body></html>`,

    contact_ticket_closed: `
      <!DOCTYPE html><html><head>${BASE_STYLE}</head><body>
        <div class="container">
          <div class="header" style="background-color: #607D8B;"><h1>Yeu cau da duoc dong</h1></div>
          <div class="content">
            <p>Xin chao <strong>${data.userName}</strong>,</p>
            <p>Yeu cau ho tro cua ban (Ma: <strong>#${data.ticketId}</strong>) da duoc danh dau la <strong>Hoan thanh / Dong</strong>.</p>
            <p>Chung toi hy vong da giai quyet tron ven van de cua ban. Kenh trao doi cho Ticket nay hien da duoc khoa.</p>
            <div style="text-align: center;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/lien-he" class="button" style="background-color: #607D8B;">LIEN HE MOI NEU CAN THIET</a>
            </div>
          </div>
          <div class="footer"><p>Cam on ban da tin tuong Easy Medify</p></div>
        </div></body></html>`
  };

  return templates[templateName] || templates.default || '<p>Email Content Not Found</p>';
};

const generateTextFromTemplate = (templateName, data = {}) => {
  return `Thong bao tu Easy Medify.`;
};

const sendVerificationEmail = async (toEmail, userName, verificationLink) => await sendEmail({ to: toEmail, subject: 'Xac thuc tai khoan', template: 'verification_email', data: { userName, verificationLink }});
const sendPasswordResetRequestEmail = async (toEmail, userName, resetLink) => await sendEmail({ to: toEmail, subject: 'Dat lai mat khau', template: 'password_reset_request', data: { userName, resetLink }});
const sendPasswordResetEmail = async (toEmail, userName) => await sendEmail({ to: toEmail, subject: 'Mat khau da doi', template: 'password_reset_success', data: { userName, email: toEmail }});
const sendWelcomeEmail = async (toEmail, userName) => await sendEmail({ to: toEmail, subject: 'Chao mung!', template: 'welcome_email', data: { userName }});
const sendAccountVerifiedEmail = async (toEmail, userName, verifiedBy = 'email') => await sendEmail({ to: toEmail, subject: 'Tai khoan da xac thuc', template: 'account_verified', data: { userName, email: toEmail, verifiedBy }});
const sendOTPEmail = async (toEmail, otp) => await sendEmail({ to: toEmail, subject: `OTP: ${otp}`, text: `OTP: ${otp}`});
const sendBulkEmails = async (recipients) => {
  const results = [];
  for (const recipient of recipients) {
    try { const r = await sendEmail(recipient); results.push({ email: recipient.to, success: r.success, messageId: r.messageId }); } 
    catch (e) { results.push({ email: recipient.to, success: false, error: e.message }); }
  }
  return results;
};

module.exports = {
  sendEmail, sendBulkEmails, generateHTMLFromTemplate, generateTextFromTemplate,
  sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail, sendPasswordResetRequestEmail, sendAccountVerifiedEmail, sendOTPEmail
};