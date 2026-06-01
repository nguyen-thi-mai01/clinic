// server/utils/momoService.js
// Service tích hợp MoMo Payment Gateway

const crypto = require('crypto');
const https = require('https');

class MoMoService {
  constructor() {
    this.partnerCode = process.env.MOMO_PARTNER_CODE || '';
    this.accessKey = process.env.MOMO_ACCESS_KEY || '';
    this.secretKey = process.env.MOMO_SECRET_KEY || '';
    this.endpoint = process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';
    this.returnUrl = process.env.MOMO_RETURN_URL || 'http://localhost:3000/payment/momo-return';
    this.notifyUrl = process.env.MOMO_NOTIFY_URL || 'http://yourdomain.com/api/payment/momo-ipn';
  }

  /**
   * Tạo payment request MoMo
   * @param {Object} data - Payment data
   * @returns {Promise<Object>} - Payment result
   */
  async createPayment(data) {
    try {
      const {
        orderId,
        amount,
        orderInfo,
        extraData = '',
        requestType = 'captureWallet',
        ipnUrl = this.notifyUrl
      } = data;

      // Validate
      if (!orderId || !amount || !orderInfo) {
        throw new Error('Missing required payment data');
      }

      if (!this.partnerCode || !this.accessKey || !this.secretKey) {
        throw new Error('MoMo credentials not configured. Please set MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY in .env');
      }

      const requestId = orderId + '_' + Date.now();
      const orderIdMomo = orderId;

      // Create raw signature
      const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderIdMomo}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${this.returnUrl}&requestId=${requestId}&requestType=${requestType}`;

      // Create signature
      const signature = crypto
        .createHmac('sha256', this.secretKey)
        .update(rawSignature)
        .digest('hex');

      // Request body
      const requestBody = {
        partnerCode: this.partnerCode,
        accessKey: this.accessKey,
        requestId: requestId,
        amount: amount.toString(),
        orderId: orderIdMomo,
        orderInfo: orderInfo,
        redirectUrl: this.returnUrl,
        ipnUrl: ipnUrl,
        extraData: extraData,
        requestType: requestType,
        signature: signature,
        lang: 'vi'
      };

      console.log('📤 MoMo request body:', JSON.stringify(requestBody, null, 2));

      // Call MoMo API
      const response = await this.makeRequest(this.endpoint, requestBody);

      console.log('📥 MoMo response:', JSON.stringify(response, null, 2));

      if (response.resultCode === 0) {
        return {
          success: true,
          payUrl: response.payUrl,
          deeplink: response.deeplink,
          qrCodeUrl: response.qrCodeUrl,
          message: 'Tạo thanh toán MoMo thành công',
          data: response
        };
      } else {
        return {
          success: false,
          message: response.message || 'Lỗi tạo thanh toán MoMo',
          resultCode: response.resultCode
        };
      }

    } catch (error) {
      console.error('❌ Error creating MoMo payment:', error);
      throw error;
    }
  }

  /**
   * Verify MoMo callback/IPN
   * @param {Object} data - Callback data từ MoMo
   * @returns {Object} - Verification result
   */
  verifyCallback(data) {
    try {
      const {
        partnerCode,
        orderId,
        requestId,
        amount,
        orderInfo,
        orderType,
        transId,
        resultCode,
        message,
        payType,
        responseTime,
        extraData,
        signature
      } = data;

      // Create raw signature để verify
      const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

      const generatedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(rawSignature)
        .digest('hex');

      const isValid = signature === generatedSignature;
      const isSuccess = resultCode === 0;

      return {
        isValid,
        isSuccess,
        resultCode,
        message: this.getResultMessage(resultCode),
        data: {
          orderId,
          amount: parseInt(amount),
          transId,
          payType,
          responseTime,
          extraData: extraData ? JSON.parse(Buffer.from(extraData, 'base64').toString()) : {}
        }
      };

    } catch (error) {
      console.error('❌ Error verifying MoMo callback:', error);
      return {
        isValid: false,
        isSuccess: false,
        message: 'Lỗi xác thực giao dịch MoMo'
      };
    }
  }

  /**
   * Query transaction status
   * @param {Object} data - Transaction data
   * @returns {Promise<Object>} - Transaction status
   */
  async queryTransaction(data) {
    try {
      const { orderId } = data;

      const requestId = orderId + '_query_' + Date.now();

      const rawSignature = `accessKey=${this.accessKey}&orderId=${orderId}&partnerCode=${this.partnerCode}&requestId=${requestId}`;

      const signature = crypto
        .createHmac('sha256', this.secretKey)
        .update(rawSignature)
        .digest('hex');

      const requestBody = {
        partnerCode: this.partnerCode,
        accessKey: this.accessKey,
        requestId: requestId,
        orderId: orderId,
        signature: signature,
        lang: 'vi'
      };

      const queryEndpoint = 'https://test-payment.momo.vn/v2/gateway/api/query';
      const response = await this.makeRequest(queryEndpoint, requestBody);

      console.log('✅ MoMo query transaction:', orderId, response);

      return {
        success: response.resultCode === 0,
        message: response.message,
        data: response
      };

    } catch (error) {
      console.error('❌ Error querying MoMo transaction:', error);
      throw error;
    }
  }

  /**
   * Create refund request
   * @param {Object} data - Refund data
   * @returns {Promise<Object>} - Refund result
   */
  async createRefund(data) {
    try {
      const {
        orderId,
        transId,
        amount,
        description = 'Hoàn tiền'
      } = data;

      const requestId = orderId + '_refund_' + Date.now();

      const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&description=${description}&orderId=${orderId}&partnerCode=${this.partnerCode}&requestId=${requestId}&transId=${transId}`;

      const signature = crypto
        .createHmac('sha256', this.secretKey)
        .update(rawSignature)
        .digest('hex');

      const requestBody = {
        partnerCode: this.partnerCode,
        accessKey: this.accessKey,
        requestId: requestId,
        orderId: orderId,
        amount: amount.toString(),
        transId: transId,
        description: description,
        signature: signature,
        lang: 'vi'
      };

      const refundEndpoint = 'https://test-payment.momo.vn/v2/gateway/api/refund';
      const response = await this.makeRequest(refundEndpoint, requestBody);

      console.log('✅ MoMo refund request:', orderId, response);

      return {
        success: response.resultCode === 0,
        message: response.message || 'Yêu cầu hoàn tiền đã được gửi',
        data: response
      };

    } catch (error) {
      console.error('❌ Error creating MoMo refund:', error);
      throw error;
    }
  }

  /**
   * Make HTTPS request to MoMo
   */
  makeRequest(url, body) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const postData = JSON.stringify(body);

      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid JSON response from MoMo'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Get result message from code
   */
  getResultMessage(code) {
    const messages = {
      0: 'Giao dịch thành công',
      9000: 'Giao dịch được xác nhận thành công',
      1000: 'Giao dịch đã được khởi tạo, chờ người dùng xác nhận thanh toán',
      1001: 'Giao dịch thất bại do lỗi',
      1002: 'Giao dịch bị từ chối',
      1003: 'Giao dịch bị hủy',
      1004: 'Giao dịch thất bại do số dư không đủ',
      1005: 'Giao dịch thất bại do url hoặc QR code đã hết hạn',
      1006: 'Giao dịch thất bại do người dùng đã từ chối xác nhận thanh toán',
      1007: 'Giao dịch bị từ chối do tài khoản người dùng bị đóng băng',
      2001: 'Giao dịch thất bại do sai định dạng dữ liệu',
      2007: 'Yêu cầu bị từ chối do partner không được cấp quyền',
      9999: 'Lỗi hệ thống'
    };
    return messages[code] || 'Lỗi không xác định';
  }
}

module.exports = new MoMoService();