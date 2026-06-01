// server/utils/corporateWindowManager.js
// Quản lý Corporate Booking Windows

const crypto = require('crypto');

/**
 * Corporate Window Manager
 * Lưu trữ thông tin các cửa sổ đặt lịch doanh nghiệp
 * Format: { corp_code, company_name, service_id, window_id, start_date, end_date, time_slots, max_participants, registered_count, status }
 */

class CorporateWindowManager {
  constructor() {
    // Lưu windows tạm (trong production sử dụng database hoặc cache)
    this.windows = new Map();
    console.log('[CorporateWindowManager] 🟢 Khởi tạo');
  }

  /**
   * Tạo corporate window mới
   * @param {Object} data - { corp_code, company_name, service_id, start_date, end_date, time_slots, max_participants }
   * @returns {Object} window data với window_id
   */
  createWindow(data) {
    try {
      const windowId = `CW-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const window = {
        window_id: windowId,
        corp_code: data.corp_code || crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 8),
        company_name: data.company_name,
        service_id: data.service_id,
        start_date: data.start_date, // YYYY-MM-DD
        end_date: data.end_date, // YYYY-MM-DD
        time_slots: data.time_slots || ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'], // Mảng giờ có sẵn
        max_participants: data.max_participants || 50,
        registered_count: 0,
        status: 'active', // active, closed, paused
        created_at: new Date(),
        registrations: [] // Lưu danh sách đã đăng ký (user_id/email)
      };

      this.windows.set(windowId, window);
      console.log(`[CorporateWindowManager] ✅ Tạo window: ${windowId} cho ${company_name} (${data.service_id})`);
      return window;
    } catch (error) {
      console.error('[CorporateWindowManager] ❌ Lỗi createWindow:', error.message);
      throw error;
    }
  }

  /**
   * Lấy window bằng window_id hoặc corp_code
   */
  getWindow(identifier) {
    try {
      let window = this.windows.get(identifier);
      if (!window) {
        // Tìm bằng corp_code
        window = Array.from(this.windows.values()).find(w => w.corp_code === identifier);
      }
      if (window) console.log(`[CorporateWindowManager] 🔍 Tìm thấy window: ${identifier}`);
      return window || null;
    } catch (error) {
      console.error('[CorporateWindowManager] ❌ Lỗi getWindow:', error.message);
      return null;
    }
  }

  /**
   * Kiểm tra window còn slot trống
   */
  hasAvailableSlot(windowId) {
    const window = this.windows.get(windowId);
    if (!window) {
      console.warn(`[CorporateWindowManager] ⚠️ Window ${windowId} không tồn tại`);
      return false;
    }
    const available = window.registered_count < window.max_participants;
    console.log(`[CorporateWindowManager] 🎯 Window ${windowId}: ${window.registered_count}/${window.max_participants} (available: ${available})`);
    return available;
  }

  /**
   * Đăng ký nhân viên vào window
   */
  registerParticipant(windowId, participantInfo) {
    try {
      const window = this.windows.get(windowId);
      if (!window) throw new Error(`Window ${windowId} không tồn tại`);
      if (window.status !== 'active') throw new Error(`Window ${windowId} không hoạt động (status: ${window.status})`);
      if (!this.hasAvailableSlot(windowId)) throw new Error(`Window ${windowId} đã hết slot`);

      window.registrations.push({
        ...participantInfo,
        registered_at: new Date()
      });
      window.registered_count++;
      console.log(`[CorporateWindowManager] ✅ Đăng ký: ${participantInfo.email} vào window ${windowId}`);
      return { success: true, window_id: windowId };
    } catch (error) {
      console.error(`[CorporateWindowManager] ❌ Lỗi registerParticipant: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lấy danh sách windows (filter bằng status hoặc service_id)
   */
  listWindows(filter = {}) {
    try {
      let list = Array.from(this.windows.values());
      if (filter.service_id) list = list.filter(w => w.service_id === filter.service_id);
      if (filter.status) list = list.filter(w => w.status === filter.status);
      if (filter.corp_code) list = list.filter(w => w.corp_code === filter.corp_code);
      console.log(`[CorporateWindowManager] 📋 Danh sách windows (filter: ${JSON.stringify(filter)}): ${list.length} found`);
      return list;
    } catch (error) {
      console.error('[CorporateWindowManager] ❌ Lỗi listWindows:', error.message);
      return [];
    }
  }

  /**
   * Đóng window (sau khi hết ngày hoặc chủ động)
   */
  closeWindow(windowId, reason = 'manual') {
    try {
      const window = this.windows.get(windowId);
      if (!window) throw new Error(`Window ${windowId} không tồn tại`);
      window.status = 'closed';
      window.closed_at = new Date();
      window.close_reason = reason;
      console.log(`[CorporateWindowManager] 🔐 Đóng window ${windowId} (reason: ${reason})`);
      return window;
    } catch (error) {
      console.error('[CorporateWindowManager] ❌ Lỗi closeWindow:', error.message);
      throw error;
    }
  }

  /**
   * (Advanced) Lưu all windows ra JSON file để persist (hoặc load từ DB)
   */
  exportToJSON() {
    const data = Array.from(this.windows.values());
    console.log(`[CorporateWindowManager] 💾 Export ${data.length} windows`);
    return data;
  }

  loadFromJSON(data) {
    if (Array.isArray(data)) {
      data.forEach(w => {
        this.windows.set(w.window_id, w);
      });
      console.log(`[CorporateWindowManager] 📂 Load ${data.length} windows từ JSON`);
    }
  }
}

// Export singleton instance
module.exports = new CorporateWindowManager();
