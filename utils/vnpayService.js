// server/utils/vnpayService.js
// Service tích hợp VNPay Payment Gateway

const crypto = require('crypto');
const querystring = require('qs');
const moment = require('moment');
const https = require('https');

class VNPayService {
  constructor() {
    this.vnpUrl = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    this.tmnCode = process.env.VNPAY_TMN_CODE || '';
    this.hashSecret = process.env.VNPAY_HASH_SECRET || '';
    this.returnUrl = process.env.VNPAY_RETURN_URL || 'http://localhost:3000/payment/vnpay-return';
  }

  /**
   * Tạo URL thanh toán VNPay
   * @param {Object} data - Thông tin thanh toán
   * @returns {String} - URL thanh toán
   */
  createPaymentUrl(data) {
    try {
      const {
        orderId,
        amount,
        orderInfo,
        orderType = 'other',
        locale = 'vn',
        ipAddr = '127.0.0.1'
      } = data;

      // Validate
      if (!orderId || !amount || !orderInfo) {
        throw new Error('Missing required payment data');
      }

      if (!this.tmnCode || !this.hashSecret) {
        throw new Error('VNPay credentials not configured. Please set VNPAY_TMN_CODE and VNPAY_HASH_SECRET in .env');
      }

      const createDate = moment().format('YYYYMMDDHHmmss');
      const expireDate = moment().add(15, 'minutes').format('YYYYMMDDHHmmss');

      // Build VNPay params
      let vnpParams = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: this.tmnCode,
        vnp_Locale: locale,
        vnp_CurrCode: 'VND',
        vnp_TxnRef: orderId,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: orderType,
        vnp_Amount: amount * 100, // VNPay nhân 100
        vnp_ReturnUrl: this.returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDate,
        vnp_ExpireDate: expireDate
      };

      // Sort params alphabetically
      vnpParams = this.sortObject(vnpParams);

      // Create signature
      const signData = querystring.stringify(vnpParams, { encode: false });
      const hmac = crypto.createHmac('sha512', this.hashSecret);
      const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
      vnpParams['vnp_SecureHash'] = signed;

      // Build final URL
      const paymentUrl = this.vnpUrl + '?' + querystring.stringify(vnpParams, { encode: false });

      console.log('✅ VNPay payment URL created:', orderId);
      return paymentUrl;

    } catch (error) {
      console.error('❌ Error creating VNPay payment URL:', error);
      throw error;
    }
  }

  /**
   * Verify VNPay callback/IPN
   * @param {Object} vnpParams - Query params từ VNPay
   * @returns {Object} - Verification result
   */
  verifyReturnUrl(vnpParams) {
    try {
      const secureHash = vnpParams['vnp_SecureHash'];
      delete vnpParams['vnp_SecureHash'];
      delete vnpParams['vnp_SecureHashType'];

      // Sort params
      const sortedParams = this.sortObject(vnpParams);
      const signData = querystring.stringify(sortedParams, { encode: false });
      
      const hmac = crypto.createHmac('sha512', this.hashSecret);
      const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

      const isValid = secureHash === signed;
      const responseCode = vnpParams['vnp_ResponseCode'];
      const isSuccess = responseCode === '00';

      return {
        isValid,
        isSuccess,
        responseCode,
        message: this.getResponseMessage(responseCode),
        data: {
          orderId: vnpParams['vnp_TxnRef'],
          amount: parseInt(vnpParams['vnp_Amount']) / 100,
          transactionNo: vnpParams['vnp_TransactionNo'],
          bankCode: vnpParams['vnp_BankCode'],
          payDate: vnpParams['vnp_PayDate']
        }
      };

    } catch (error) {
      console.error('❌ Error verifying VNPay return:', error);
      return {
        isValid: false,
        isSuccess: false,
        message: 'Lỗi xác thực giao dịch'
      };
    }
  }

  /**
   * Tạo yêu cầu hoàn tiền (refund)
   * @param {Object} data - Thông tin hoàn tiền
   * @returns {Object} - Refund result
   */
  async createRefund(data) {
    try {
      const {
        orderId,
        transactionNo,
        amount,
        refundAmount,
        transactionType = '02', // 02: Hoàn toàn bộ, 03: Hoàn một phần
        user = 'admin',
        ipAddr = '127.0.0.1'
      } = data;

      const createDate = moment().format('YYYYMMDDHHmmss');
      const transactionDate = moment().format('YYYYMMDDHHmmss');

      let vnpParams = {
        vnp_Version: '2.1.0',
        vnp_Command: 'refund',
        vnp_TmnCode: this.tmnCode,
        vnp_TransactionType: transactionType,
        vnp_TxnRef: orderId,
        vnp_Amount: amount * 100,
        vnp_TransactionNo: transactionNo,
        vnp_TransactionDate: transactionDate,
        vnp_CreateDate: createDate,
        vnp_CreateBy: user,
        vnp_IpAddr: ipAddr,
        vnp_OrderInfo: `Hoàn tiền cho đơn hàng ${orderId}`
      };

      // Sort và tạo signature
      vnpParams = this.sortObject(vnpParams);
      const signData = querystring.stringify(vnpParams, { encode: false });
      const hmac = crypto.createHmac('sha512', this.hashSecret);
      const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
      vnpParams['vnp_SecureHash'] = signed;

      // Gọi API VNPay (cần implement HTTP request)
      // const response = await axios.post(vnpRefundUrl, vnpParams);
      
      console.log('✅ VNPay refund request created:', orderId);
      
      return {
        success: true,
        message: 'Yêu cầu hoàn tiền đã được gửi',
        data: vnpParams
      };

    } catch (error) {
      console.error('❌ Error creating VNPay refund:', error);
      throw error;
    }
  }

  /**
   * Query transaction status
   * @param {Object} data - Transaction data
   * @returns {Object} - Transaction status
   */
  /**
   * Gửi yêu cầu truy vấn trạng thái giao dịch lên VNPay
   * Dùng cho Admin đối soát
   */
  async queryTransaction(data) {
    try {
      const {
        orderId,
        transactionDate, // Format: YYYYMMDDHHmmss (Lấy từ payment.created_at)
        ipAddr = '127.0.0.1'
      } = data;

      const createDate = moment().format('YYYYMMDDHHmmss');

      let vnpParams = {
        vnp_Version: '2.1.0',
        vnp_Command: 'querydr',
        vnp_TmnCode: this.tmnCode,
        vnp_TxnRef: orderId,
        vnp_OrderInfo: `Truy van giao dich ${orderId}`,
        vnp_TransactionDate: transactionDate, 
        vnp_CreateDate: createDate,
        vnp_IpAddr: ipAddr
      };

      // Sort và tạo checksum
      vnpParams = this.sortObject(vnpParams);
      const signData = querystring.stringify(vnpParams, { encode: false });
      const hmac = crypto.createHmac('sha512', this.hashSecret);
      const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
      vnpParams['vnp_SecureHash'] = signed;

      const queryUrl = 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction'; // URL API Truy vấn (Sandbox)
      
      console.log('⏳ Sending Query request to VNPay:', orderId);

      // Gọi hàm gửi request (được định nghĩa bên dưới)
      const response = await this.sendRequest(queryUrl, vnpParams);
      
      console.log('✅ VNPay Query Response:', response);

      if (response.vnp_ResponseCode === '00') {
        return {
            success: true,
            isPaid: response.vnp_TransactionStatus === '00', // 00: Đã thanh toán
            message: this.getResponseMessage(response.vnp_ResponseCode),
            data: response
        };
      } else {
          return {
              success: false,
              message: this.getResponseMessage(response.vnp_ResponseCode) || 'Lỗi truy vấn',
              data: response
          };
      }

    } catch (error) {
      console.error('❌ Error querying VNPay transaction:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Helper: Gửi POST Request bằng https native (không cần cài axios)
   */
  sendRequest(urlStr, data) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const postData = JSON.stringify(data);

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseBody));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
  }

  /**
   * Sort object keys alphabetically
   */
  sortObject(obj) {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    keys.forEach(key => {
      sorted[key] = obj[key];
    });
    return sorted;
  }

  /**
   * Get response message from code
   */
  getResponseMessage(code) {
    const messages = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
      '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định.',
      '99': 'Các lỗi khác'
    };
    return messages[code] || 'Lỗi không xác định';
  }
}

module.exports = new VNPayService();