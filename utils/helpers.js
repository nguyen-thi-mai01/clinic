// server/utils/helpers.js - ENHANCED UTILITY FUNCTIONS
const crypto = require('crypto');

// =================================================================
// ======================= SECURITY UTILITIES =====================
// =================================================================

// Tạo OTP 6 số ngẫu nhiên
exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate random token
exports.generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate secure appointment code (format: APT-DDMM-XXXX)
exports.generateAppointmentCode = () => {
  const date = exports.formatDate();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `APT-${date}-${random}`;
};

// Generate patient ID (format: PT-YYYYMM-XXXXX)
exports.generatePatientId = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(10000 + Math.random() * 90000);
  return `PT-${year}${month}-${random}`;
};

// Generate secure password
exports.generateSecurePassword = (length = 12) => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  let password = '';
  
  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill remaining length
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Hash password with salt
exports.hashPassword = (password, salt = null) => {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
};

// Verify password
exports.verifyPassword = (password, hash, salt) => {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
};

// =================================================================
// ======================= VALIDATION UTILITIES ===================
// =================================================================

// Validate email
exports.isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate số điện thoại (Việt Nam)
exports.isValidPhone = (phone) => {
  const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
  return phoneRegex.test(phone);
};

// Kiểm tra độ mạnh mật khẩu
exports.isStrongPassword = (password) => {
  // Ít nhất 8 ký tự, có chữ hoa, chữ thường, số
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return strongRegex.test(password);
};

// Validate CMND/CCCD Việt Nam
exports.isValidIdCard = (idCard) => {
  // CMND: 9 hoặc 12 số, CCCD: 12 số
  const idRegex = /^[0-9]{9}$|^[0-9]{12}$/;
  return idRegex.test(idCard);
};

// Validate tên tiếng Việt
exports.isValidVietnameseName = (name) => {
  const nameRegex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵýỷỹ\s]+$/;
  return nameRegex.test(name) && name.length >= 2 && name.length <= 50;
};

// Validate tuổi
exports.isValidAge = (age) => {
  return Number.isInteger(age) && age >= 0 && age <= 150;
};

// Validate ngày sinh
exports.isValidBirthDate = (birthDate) => {
  const date = new Date(birthDate);
  const now = new Date();
  const age = now.getFullYear() - date.getFullYear();
  
  return date instanceof Date && !isNaN(date) && 
         date <= now && age >= 0 && age <= 150;
};

// =================================================================
// ======================= FORMATTING UTILITIES ===================
// =================================================================

// Format ngày tháng cho code (DDMM)
exports.formatDate = (date = new Date()) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}${month}`;
};

// Format currency VND
exports.formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
};

// Format phone number
exports.formatPhoneNumber = (phone) => {
  // Convert to standard format: 0xxx xxx xxx
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('84')) {
    return '0' + cleaned.substring(2);
  }
  return cleaned.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
};

// Format date for display (DD/MM/YYYY)
exports.formatDateDisplay = (date) => {
  return new Date(date).toLocaleDateString('vi-VN');
};

// Format datetime for display (DD/MM/YYYY HH:mm)
exports.formatDateTimeDisplay = (datetime) => {
  return new Date(datetime).toLocaleString('vi-VN');
};

// Format file size
exports.formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// =================================================================
// ======================= STRING UTILITIES ========================
// =================================================================

// Sanitize input để tránh XSS
exports.sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Capitalize first letter
exports.capitalizeFirst = (str) => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Convert to title case
exports.toTitleCase = (str) => {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

// Remove Vietnamese accents
exports.removeVietnameseAccents = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

// Generate slug from string
exports.generateSlug = (str) => {
  return exports.removeVietnameseAccents(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Mask sensitive data
exports.maskString = (str, visibleChars = 3, maskChar = '*') => {
  if (!str || str.length <= visibleChars * 2) return str;
  
  const start = str.substring(0, visibleChars);
  const end = str.substring(str.length - visibleChars);
  const middle = maskChar.repeat(str.length - visibleChars * 2);
  
  return start + middle + end;
};

// =================================================================
// ======================= DATA UTILITIES ==========================
// =================================================================

// Parse JSON an toàn
exports.safeJSONParse = (jsonString, defaultValue = null) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Lỗi parse JSON:', error);
    return defaultValue;
  }
};

// Deep clone object
exports.deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Check if object is empty
exports.isEmpty = (obj) => {
  if (obj === null || obj === undefined) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
};

// Get nested property safely
exports.getNestedProperty = (obj, path, defaultValue = undefined) => {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result !== undefined ? result : defaultValue;
};

// =================================================================
// ======================= TIME UTILITIES ==========================
// =================================================================

// Get time difference in Vietnamese
exports.getTimeAgo = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} ngày trước`;
  if (hours > 0) return `${hours} giờ trước`;
  if (minutes > 0) return `${minutes} phút trước`;
  return 'Vừa xong';
};

// Check if date is today
exports.isToday = (date) => {
  const today = new Date();
  const checkDate = new Date(date);
  
  return today.toDateString() === checkDate.toDateString();
};

// Check if date is in business hours
exports.isBusinessHours = (date = new Date()) => {
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hour = date.getHours();
  
  // Monday to Friday, 8 AM to 5 PM
  return day >= 1 && day <= 5 && hour >= 8 && hour < 17;
};

// Add business days to date
exports.addBusinessDays = (date, days) => {
  const result = new Date(date);
  let remainingDays = days;
  
  while (remainingDays > 0) {
    result.setDate(result.getDate() + 1);
    
    // Skip weekends
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      remainingDays--;
    }
  }
  
  return result;
};

// =================================================================
// ======================= ARRAY UTILITIES =========================
// =================================================================

// Remove duplicates from array
exports.removeDuplicates = (arr, key = null) => {
  if (!key) {
    return [...new Set(arr)];
  }
  
  const seen = new Map();
  return arr.filter(item => {
    const keyValue = item[key];
    if (seen.has(keyValue)) {
      return false;
    }
    seen.set(keyValue, true);
    return true;
  });
};

// Group array by key
exports.groupBy = (arr, key) => {
  return arr.reduce((groups, item) => {
    const group = item[key];
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
};

// Paginate array
exports.paginate = (arr, page, limit) => {
  const offset = (page - 1) * limit;
  const paginatedItems = arr.slice(offset, offset + limit);
  
  return {
    data: paginatedItems,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(arr.length / limit),
      totalItems: arr.length,
      itemsPerPage: limit
    }
  };
};

// =================================================================
// ======================= ERROR HANDLING ==========================
// =================================================================

// Create standardized error response
exports.createErrorResponse = (message, code = 'INTERNAL_ERROR', details = null) => {
  return {
    success: false,
    error: {
      code: code,
      message: message,
      details: details,
      timestamp: new Date().toISOString()
    }
  };
};

// Create success response
exports.createSuccessResponse = (data = null, message = 'Success') => {
  return {
    success: true,
    message: message,
    data: data,
    timestamp: new Date().toISOString()
  };
};

// =================================================================
// ======================= MEDICAL UTILITIES =======================
// =================================================================

// Calculate BMI
exports.calculateBMI = (weight, height) => {
  const heightInMeters = height / 100;
  const bmi = weight / (heightInMeters * heightInMeters);
  
  let category = '';
  if (bmi < 18.5) category = 'Thiếu cân';
  else if (bmi < 25) category = 'Bình thường';
  else if (bmi < 30) category = 'Thừa cân';
  else category = 'Béo phì';
  
  return {
    bmi: Math.round(bmi * 10) / 10,
    category: category
  };
};

// Calculate age from birth date
exports.calculateAge = (birthDate) => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

// Generate medical record number
exports.generateMedicalRecordNumber = (patientId) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  
  return `MR-${year}${month}${day}-${patientId.split('-')[2]}-${random}`;
};

// =================================================================
// ======================= RATE LIMITING ===========================
// =================================================================

// Simple in-memory rate limiter
const rateLimitMap = new Map();

exports.checkRateLimit = (key, maxRequests = 10, windowMs = 60000) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, []);
  }
  
  const requests = rateLimitMap.get(key);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(time => time > windowStart);
  
  if (validRequests.length >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: validRequests[0] + windowMs
    };
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitMap.set(key, validRequests);
  
  return {
    allowed: true,
    remaining: maxRequests - validRequests.length,
    resetTime: now + windowMs
  };
};

// Clean up old rate limit entries
exports.cleanupRateLimit = () => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [key, requests] of rateLimitMap.entries()) {
    const validRequests = requests.filter(time => time > now - oneHour);
    
    if (validRequests.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, validRequests);
    }
  }
};

module.exports = exports;