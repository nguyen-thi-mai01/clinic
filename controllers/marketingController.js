const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');

const marketingController = {
  // === 1. LOGIC SỰ KIỆN ===
  
  // Lấy sự kiện Popup cho trang chủ
  getPopupEvent: async (req, res) => {
    try {
      const event = await models.Event.findOne({
        where: {
          is_active: true,
          is_popup: true,
          status: { [Op.in]: ['approved', 'scheduled', 'ongoing'] }, // Đảm bảo đã được duyệt
          end_date: { [Op.gte]: new Date() } // Chỉ cần chưa kết thúc là hiển thị
        },
        order: [['created_at', 'DESC']] // Lấy cái mới nhất
      });
      res.json({ success: true, event });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Lấy chi tiết sự kiện theo ID hoặc Slug
  // ✅ SAU KHI SỬA:
  getEventDetail: async (req, res) => {
    try {
      const { id } = req.params;
      
      let whereCondition = {};
      
      if (!isNaN(id)) {
        whereCondition = { id: id };
      } else {
        whereCondition = { slug: id };
      }

      const event = await models.Event.findOne({
        where: {
          ...whereCondition,
          is_active: true
        }
      });

      if (!event) {
        return res.status(404).json({ success: false, message: 'Sự kiện không tồn tại' });
      }

      // Tăng lượt xem
      await event.increment('views');
      
      // Reload để lấy giá trị views mới
      await event.reload();

      // Xử lý đường dẫn hình ảnh
      const eventData = event.toJSON();
      const eventWithImages = {
        ...eventData,
        thumbnail: eventData.thumbnail ? 
          (eventData.thumbnail.startsWith('http') ? eventData.thumbnail : `${process.env.BASE_URL || 'http://localhost:3001'}${eventData.thumbnail}`) 
          : null,
        banner_url: eventData.banner_url ? 
          (eventData.banner_url.startsWith('http') ? eventData.banner_url : `${process.env.BASE_URL || 'http://localhost:3001'}${eventData.banner_url}`) 
          : null,
        gallery: Array.isArray(eventData.gallery) ? 
          eventData.gallery.filter(img => img && typeof img === 'string').map(img => img.startsWith('http') ? img : `${process.env.BASE_URL || 'http://localhost:3001'}${img}`) 
          : []
      };

      res.json({ success: true, event: eventWithImages });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Lấy danh sách sự kiện (có phân trang)
  getEvents: async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        event_type, 
        status, 
        sort_by = 'start_date',
        order = 'DESC'
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};
      
      // Filter by search
      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      // Filter by event type
      if (event_type && event_type !== 'all') {
        where.event_type = event_type;
      }

      // Filter by status
      const now = new Date();
      if (status === 'upcoming') {
        where.start_date = { [Op.gt]: now };
        where.is_active = true;
      } else if (status === 'ongoing') {
        where.start_date = { [Op.lte]: now };
        where.end_date = { [Op.gte]: now };
        where.is_active = true;
      } else if (status === 'ended') {
        where.end_date = { [Op.lt]: now };
      } else if (status === 'active') {
        where.is_active = true;
      } else if (status === 'inactive') {
        where.is_active = false;
      }

      // Default: only show active events for public
      if (!status) {
        where.is_active = true;
      }

      // Filter by workflow status
      if (req.query.workflow_status) {
        where.status = req.query.workflow_status;
      }

      // Sorting options
      let orderClause = [];
      if (sort_by === 'views') {
        orderClause = [['views', order.toUpperCase()]];
      } else if (sort_by === 'clicks') {
        orderClause = [['clicks', order.toUpperCase()]];
      } else if (sort_by === 'created_at') {
        orderClause = [['created_at', order.toUpperCase()]];
      } else {
        orderClause = [['start_date', order.toUpperCase()]];
      }

      const { count, rows } = await models.Event.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: orderClause,
        attributes: {
          include: [
            [sequelize.literal('views'), 'views'],
            [sequelize.literal('clicks'), 'clicks']
          ]
        }
      });

      // Process image URLs
      const eventsWithImages = rows.map(event => {
        const eventData = event.toJSON();
        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        
        return {
          ...eventData,
          thumbnail: eventData.thumbnail ? 
            (eventData.thumbnail.startsWith('http') ? eventData.thumbnail : `${baseUrl}${eventData.thumbnail}`) 
            : null,
          banner_url: eventData.banner_url ? 
            (eventData.banner_url.startsWith('http') ? eventData.banner_url : `${baseUrl}${eventData.banner_url}`) 
            : null,
          gallery: Array.isArray(eventData.gallery) ? 
  eventData.gallery.filter(img => img && typeof img === 'string').map(img => img.startsWith('http') ? img : `${baseUrl}${img}`) 
  : []
        };
      });

      res.json({ 
        success: true, 
        events: eventsWithImages, 
        total: count, 
        page: parseInt(page),
        total_pages: Math.ceil(count / limit),
        limit: parseInt(limit)
      });
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // === 2. LOGIC GAME & VOUCHER ===

  // Lấy danh sách quà tặng cho vòng quay
  getGameRewards: async (req, res) => {
    try {
      const now = new Date();

      // Ưu tiên lấy WheelEvent đang active
      const wheelEvent = await models.WheelEvent.findOne({
        where: {
          is_active:  true,
          start_date: { [Op.lte]: now },
          end_date:   { [Op.gte]: now }
        },
        include: [{
          model: models.WheelPrize,
          as:    'prizes',
          include: [{
            model: models.Promotion,
            as:    'promotion',
            attributes: ['id','name','code','discount_type','discount_value','reward_type','external_code','reward_image_url']
          }],
          order: [['sort_order','ASC']]
        }],
        order: [['created_at','DESC']]
      });

      if (wheelEvent) {
        return res.json({
          success:      true,
          mode:         'wheel_event',
          wheel_event:  wheelEvent,
          rewards:      wheelEvent.prizes.map(p => ({
            id:          p.id,
            label:       p.label,
            probability: parseFloat(p.probability),
            color:       p.color,
            is_miss:     p.is_miss,
            promotion:   p.promotion || null
          }))
        });
      }

      // Fallback: lấy Promotion.is_game_reward nếu không có WheelEvent
      const rewards = await models.Promotion.findAll({
        where: {
          is_active:      true,
          is_game_reward: true,
          start_date:     { [Op.lte]: now },
          end_date:       { [Op.gte]: now }
        },
        attributes: ['id','name','code','discount_value','discount_type','game_probability','reward_type','external_code','reward_image_url']
      });

      res.json({ success: true, mode: 'legacy', rewards, wheel_event: null });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Chơi game: Vòng quay may mắn / Điểm danh
  playGame: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const userId      = req.user.id;
      const now         = new Date();
      const startOfDay  = new Date(); startOfDay.setHours(0,0,0,0);

      // 1. Lấy WheelEvent đang active (nếu có)
      const wheelEvent = await models.WheelEvent.findOne({
        where: {
          is_active:  true,
          start_date: { [Op.lte]: now },
          end_date:   { [Op.gte]: now }
        },
        include: [{
          model: models.WheelPrize,
          as:    'prizes',
          include: [{ model: models.Promotion, as: 'promotion' }]
        }],
        transaction
      });

      // ✅ LẤY CẤU HÌNH ĐIỂM TỪ DB LÀM MẶC ĐỊNH
      const setting = await models.SystemSetting.findOne({ where: { setting_key: 'LOYALTY_CONFIG' }, transaction });
      const globalConfig = setting ? setting.value_json : { wheel_cost_per_spin: 10, spins_per_day: 3 };

      // Ưu tiên lấy cấu hình riêng của Sự kiện, nếu không có thì lấy cấu hình chung toàn hệ thống
      const costPerSpin  = wheelEvent ? (wheelEvent.cost_per_spin || globalConfig.wheel_cost_per_spin || 10) : (globalConfig.wheel_cost_per_spin || 10);
      const spinsPerDay  = wheelEvent ? (wheelEvent.spins_per_day || globalConfig.spins_per_day || 3)  : (globalConfig.spins_per_day || 3);

      // 2. Kiểm tra điểm
      const user = await models.User.findByPk(userId, { transaction });
      if ((user.reward_points || 0) < costPerSpin) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Bạn cần ${costPerSpin} điểm để quay. Hãy điểm danh hằng ngày!`
        });
      }

      // 3. ✅ Check daily limit đúng — đếm game_plays thay vì UserVoucher
      const playedToday = await models.GamePlay.count({
        where: {
          user_id:    userId,
          created_at: { [Op.gte]: startOfDay },
          ...(wheelEvent ? { wheel_event_id: wheelEvent.id } : {})
        },
        transaction
      });

      if (playedToday >= spinsPerDay) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Bạn đã quay đủ ${spinsPerDay} lượt hôm nay! Quay lại ngày mai nhé.`
        });
      }

      // 4. Trừ điểm (dùng increment tránh race condition)
      await models.User.decrement('reward_points', { by: costPerSpin, where: { id: userId }, transaction });

      // 5. Lấy danh sách ô thưởng
      let prizes = [];
      if (wheelEvent && wheelEvent.prizes?.length > 0) {
        prizes = wheelEvent.prizes.filter(p =>
          p.is_miss || (p.quantity == null || parseInt(p.quantity) === -1 || (parseInt(p.quantity_won) || 0) < parseInt(p.quantity))
        );
      } else {
        // Fallback: dùng Promotion is_game_reward
        const legacyRewards = await models.Promotion.findAll({
          where: {
            is_active:      true,
            is_game_reward: true,
            usage_count:    { [Op.lt]: sequelize.col('usage_limit') },
            start_date:     { [Op.lte]: now },
            end_date:       { [Op.gte]: now }
          },
          transaction
        });
        prizes = legacyRewards.map(r => ({
          id:          r.id,
          label:       r.name,
          probability: r.game_probability,
          is_miss:     false,
          promotion:   r,
          promotion_id: r.id
        }));
      }

      if (prizes.length === 0) {
        // Không có ô thưởng nào → miss, vẫn lưu lịch sử
        await models.GamePlay.create({
          user_id:        userId,
          wheel_event_id: wheelEvent?.id || null,
          promotion_id:   null,
          result:         'miss',
          points_spent:   costPerSpin,
          reward_name:    null
        }, { transaction });
        await transaction.commit();
        return res.json({ success: true, result: 'miss', message: 'Chúc bạn may mắn lần sau!' });
      }

      // 6. ✅ Random theo tỷ lệ tích lũy (cumulative probability)
      const totalProb = prizes.reduce((s, p) => s + parseFloat(p.probability || 0), 0);
      const rand      = Math.random() * totalProb;
      let cumulative  = 0;
      let selectedPrize = null;

      for (const prize of prizes) {
        cumulative += parseFloat(prize.probability || 0);
        if (rand <= cumulative) { selectedPrize = prize; break; }
      }

      // 7. Xử lý kết quả
      if (!selectedPrize || selectedPrize.is_miss) {
        // ✅ Lưu lịch sử miss
        await models.GamePlay.create({
          user_id:        userId,
          wheel_event_id: wheelEvent?.id || null,
          promotion_id:   null,
          result:         'miss',
          points_spent:   costPerSpin,
          reward_name:    selectedPrize?.label || null
        }, { transaction });
        await transaction.commit();
        return res.json({ success: true, result: 'miss', message: 'Suýt trúng rồi! Thử lại nhé.' });
      }

      // WIN
      // Lấy promotion: ưu tiên từ WheelPrize.promotion, fallback query thẳng theo promotion_id
      let promo = selectedPrize.promotion || null;
      if (!promo && selectedPrize.promotion_id) {
        promo = await models.Promotion.findByPk(selectedPrize.promotion_id, { transaction });
      }

      // Tạo UserVoucher — luôn tạo mới mỗi lần trúng (cho phép trúng nhiều lần)
      if (promo && promo.id) {
        await models.UserVoucher.create({
          user_id:      userId,
          promotion_id: promo.id,
          is_used:      false
        }, { transaction });
        await models.Promotion.increment('usage_count', { where: { id: promo.id }, transaction });
      }

      // Lưu lịch sử win vào game_plays
      await models.GamePlay.create({
        user_id:        userId,
        wheel_event_id: wheelEvent?.id || null,
        promotion_id:   promo?.id || null,
        result:         'win',
        points_spent:   costPerSpin,
        reward_name:    selectedPrize.label
      }, { transaction });

      // Tăng quantity_won của WheelPrize
      if (selectedPrize.id) {
        await models.WheelPrize.increment('quantity_won', { by: 1, where: { id: selectedPrize.id }, transaction });
      }

      await transaction.commit();

      // Build reward object trả về cho frontend
      const rewardData = promo
        ? { ...promo.dataValues, name: selectedPrize.label }
        : { id: null, name: selectedPrize.label, reward_type: 'item', code: null };

      return res.json({
        success: true,
        result:  'win',
        reward:  rewardData,
        message: `🎉 Chúc mừng! Bạn trúng: ${selectedPrize.label}`
      });
    } catch (error) {
      await transaction.rollback();
      console.error('playGame error:', error);
      res.status(500).json({ success: false, message: 'Lỗi hệ thống game' });
    }
  },

  // Lấy danh sách Voucher của tôi
  getMyVouchers: async (req, res) => {
    try {
      const vouchers = await models.UserVoucher.findAll({
        where: { user_id: req.user.id, is_used: false },
        include: [{
          model: models.Promotion,
          required: false,
          attributes: ['id','name','code','description','discount_type','discount_value',
                       'min_order_value','max_discount_amount','apply_for','end_date',
                       'usage_limit','usage_count',
                       'reward_type','external_code','reward_image_url',
                       'is_game_reward','is_exchange_reward']
        }],
        order: [['created_at', 'DESC']]
      });
      // Normalize để frontend đọc được dù Sequelize trả camelCase hay snake_case
      const normalized = vouchers.map(v => {
        const json = v.toJSON();
        return {
          ...json,
          Promotion: json.Promotion || json.promotion || null
        };
      });
      res.json({ success: true, vouchers: normalized });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ THÊM MỚI 1: Lấy danh sách Voucher đang phát hành (Kho chung)
  getPublicPromotions: async (req, res) => {
    try {
      const promotions = await models.Promotion.findAll({
        where: {
          is_active: true,
          is_game_reward: false,
          end_date: { [Op.gte]: new Date() },
          usage_count: { [Op.lt]: sequelize.col('usage_limit') }
        },
        attributes: ['id','name','code','description','discount_type','discount_value',
                     'min_order_value','max_discount_amount','apply_for',
                     'usage_limit','usage_count','start_date','end_date',
                     'is_exchange_reward','exchange_points','exchange_limit','image_url',
                     'reward_type','reward_image_url'],
        order: [['created_at', 'DESC']]
      });
      res.json({
        success: true,
        promotions: computedPromotions,
        statistics,
        topPromotions
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ THÊM MỚI 2: Xử lý hành động "Lưu mã" của người dùng
  claimVoucher: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const userId = req.user.id;
      const { promotion_id } = req.body;

      // Kiểm tra Promotion có tồn tại và còn hạn không
      const promotion = await models.Promotion.findOne({
        where: { id: promotion_id, is_active: true, is_game_reward: false },
        transaction
      });

      if (!promotion) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Voucher không tồn tại hoặc đã hết hạn.' });
      }

      // Kiểm tra còn lượt không
      if (promotion.usage_count >= promotion.usage_limit) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Rất tiếc, voucher này đã được thu thập hết.' });
      }

      // Kiểm tra user đã lưu chưa
      const existing = await models.UserVoucher.findOne({
        where: { user_id: userId, promotion_id },
        transaction
      });

      if (existing) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Bạn đã lưu voucher này trong ví rồi.' });
      }

      // Cấp voucher cho user & trừ đi 1 lượt phát hành
      await models.UserVoucher.create({ user_id: userId, promotion_id }, { transaction });
      await promotion.increment('usage_count', { transaction });

      await transaction.commit();
      res.json({ success: true, message: 'Lưu mã thành công! Đã thêm vào Ví của bạn.' });
    } catch (error) {
      await transaction.rollback();
      res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lưu mã' });
    }
  },

  // ✅ THÊM MỚI: Logic lấy điểm hiện tại
  getMyPoints: async (req, res) => {
    try {
      const user = await models.User.findByPk(req.user.id);
      // Tính streak: số ngày checkin liên tiếp tính từ hôm nay lùi về
      const today     = new Date().toISOString().slice(0,10);
      const lastDate  = user.last_checkin_date
        ? new Date(user.last_checkin_date).toISOString().slice(0,10)
        : null;
      const streak = user.checkin_streak || 0;
      res.json({
        success:           true,
        points:            user.reward_points    || 0,
        streak:            streak,
        last_checkin_date: user.last_checkin_date || null,
        checked_in_today:  lastDate === today
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ THÊM MỚI: Logic điểm danh hằng ngày
  dailyCheckin: async (req, res) => {
    try {
      const user = await models.User.findByPk(req.user.id);

      // Kiểm tra hôm nay đã điểm danh chưa bằng last_checkin_date trong User
      const today = new Date().toISOString().slice(0, 10); // "2026-02-25"
      const lastCheckin = user.last_checkin_date 
        ? new Date(user.last_checkin_date).toISOString().slice(0, 10) 
        : null;

      if (lastCheckin === today) {
        return res.status(400).json({ 
          success: false, 
          message: 'Bạn đã điểm danh hôm nay rồi! Quay lại vào ngày mai nhé.' 
        });
      }

      // Dùng increment để tránh race condition khi nhiều request cùng lúc
      await models.User.update(
        { last_checkin_date: new Date() },
        { where: { id: req.user.id } }
      );

      // ✅ LẤY CẤU HÌNH ĐIỂM TỪ DB
      const setting = await models.SystemSetting.findOne({ where: { setting_key: 'LOYALTY_CONFIG' } });
      const config = setting ? setting.value_json : { daily_checkin_points: 10 };
      const pointsToAdd = Number(config.daily_checkin_points || 10);

      // Cộng điểm bằng số điểm động vừa lấy
      await models.User.increment('reward_points', { by: pointsToAdd, where: { id: req.user.id } });
      const updatedUser = await models.User.findByPk(req.user.id, { attributes: ['reward_points', 'last_checkin_date'] });
      res.json({ success: true, points: updatedUser.reward_points, message: `Điểm danh thành công! Bạn nhận được ${pointsToAdd} điểm.` });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi điểm danh' });
    }
  },

  // ✅ THÊM MỚI: Logic đổi điểm lấy voucher
  // SAU KHI SỬA
  // ✅ LOGIC MỚI: Đổi voucher CỤ THỂ theo ID do khách hàng chọn
  exchangePoints: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const user = await models.User.findByPk(req.user.id);
      const promoId = req.params.promoId; // Lấy ID Voucher từ URL

      // Tìm voucher khách hàng muốn đổi
      const reward = await models.Promotion.findOne({
        where: { 
          id: promoId, 
          is_active: true, 
          is_exchange_reward: true,  // ✅ Đúng: phải là hàng đổi điểm
          start_date: { [Op.lte]: new Date() },
          end_date:   { [Op.gte]: new Date() }
        },
        transaction
      });

      if (!reward) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Voucher không tồn tại hoặc đã hết hạn!' });
      }

      if (reward.usage_count >= reward.usage_limit) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Rất tiếc, voucher này đã được đổi hết!' });
      }

      // Kiểm tra user đã có mã này trong ví chưa
      const existing = await models.UserVoucher.findOne({ where: { user_id: user.id, promotion_id: reward.id } });
      if (existing) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Bạn đã có mã này trong ví rồi!' });
      }

      // SAU KHI SỬA
      // ✅ Lấy chính xác số điểm do Admin cấu hình từ Database
      const pointsNeeded = reward.exchange_points || 50;

      if ((user.reward_points || 0) < pointsNeeded) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Bạn cần ${pointsNeeded} điểm để đổi quà này!` });
      }

      // Trừ điểm và cấp voucher vào ví
      user.reward_points -= pointsNeeded;
      await user.save({ transaction });

      await models.UserVoucher.create({ user_id: user.id, promotion_id: reward.id }, { transaction });
      await reward.increment('usage_count', { transaction });

      await transaction.commit();
      res.json({ success: true, points: user.reward_points, message: `Thành công! Bạn vừa dùng ${pointsNeeded} điểm để đổi: ${reward.name}` });
    } catch (error) {
      await transaction.rollback();
      res.status(500).json({ success: false, message: 'Lỗi đổi quà' });
    }
  },
  // === 3. ADMIN FUNCTIONS (Thêm vào marketingController) ===

  // Tạo sự kiện mới
   createEvent: async (req, res) => {
    try {
      const { 
        title, content, start_date, end_date, is_popup, is_banner_ad,
        thumbnail, banner_url, description, 
        event_type, popup_config, cta_config, banner_ad_config,
        gallery, location,
        status, event_category, format, online_config,
        registration_limit, registration_open_at, registration_close_at,
        priority, tags
      } = req.body;

      // Validation
      if (!title || !start_date || !end_date) {
        return res.status(400).json({ 
          success: false, 
          message: 'Vui lòng điền đầy đủ tiêu đề, ngày bắt đầu và kết thúc' 
        });
      }

      // Tạo slug từ title
      const slug = title.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
        + '-' + Date.now();

      // Hàm hỗ trợ parse JSON an toàn
      const safeParse = (value, fallback, isArray = false) => {
        if (value === undefined || value === null || value === '') return isArray ? [] : fallback;
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch (e) { return isArray ? [] : fallback; }
      };

      const newEvent = await models.Event.create({
        title, 
        slug, 
        content, 
        start_date, 
        end_date, 
        is_popup: is_popup || false,
        is_banner_ad: is_banner_ad || false,
        banner_ad_config: safeParse(banner_ad_config, { label: 'Sự kiện nổi bật', cta_text: 'Tìm hiểu ngay', badge: '' }),
        thumbnail, 
        banner_url, 
        description,
        event_type: event_type || 'event',
        popup_config: safeParse(popup_config, { delay: 0, frequency: 'once_per_day', display_pages: ['home'] }),
        cta_config: safeParse(cta_config, { text: 'Xem chi tiết', type: 'internal', link: '' }),
        gallery: safeParse(gallery, [], true),
        location: location || '',
        status: status || 'draft',
        event_category: event_category || 'workshop',
        format: format || 'offline',
        online_config: safeParse(online_config, null),
        registration_limit: registration_limit || null,
        registration_open_at: registration_open_at || null,
        registration_close_at: registration_close_at || null,
        priority: priority || 'normal',
        tags: safeParse(tags, [], true)
      });

      res.json({ success: true, event: newEvent });
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // Xóa sự kiện
  deleteEvent: async (req, res) => {
    try {
      await models.Event.destroy({ where: { id: req.params.id } });
      res.json({ success: true, message: 'Đã xóa sự kiện' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // khuyếnmãi tạo mã mới

  createPromotion: async (req, res) => {
    try {
      const { 
        code, name, discount_value, usage_limit, 
        start_date, end_date, // <--- Quan trọng: Phải nhận đủ ngày
        is_game_reward, game_probability,
        // Các trường mới:
        min_order_value, max_discount_amount, apply_for, game_type, discount_type,
        reward_type, external_code, reward_image_url,
        is_exchange_reward, exchange_points, // ✅ THÊM 2 TRƯỜNG ĐỔI ĐIỂM VÀO ĐÂY
        image_url, exchange_limit
      } = req.body;

      // Validate ngày tháng để tránh lỗi 500
      if (!start_date || !end_date) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày bắt đầu và kết thúc!' });
      }

      // Validate tỷ lệ trúng thưởng
      if (is_game_reward && (game_probability < 0 || game_probability > 100)) {
        return res.status(400).json({ success: false, message: 'Tỷ lệ trúng thưởng phải từ 0 đến 100%' });
      }

      const newPromo = await models.Promotion.create({
        code: code.toUpperCase(), 
        name, 
        discount_value, 
        discount_type: discount_type || 'percentage',
        usage_limit, 
        start_date,
        end_date,
        min_order_value: min_order_value || 0,
        max_discount_amount: max_discount_amount || null,
        apply_for: apply_for || 'all',
        is_game_reward: is_game_reward || false,
        game_type: is_game_reward ? (game_type || 'lucky_wheel') : 'none',
        game_probability: game_probability || 0,
        description: req.body.description || null, 
        applicable_ids: req.body.applicable_ids ? req.body.applicable_ids.join(',') : null,
        // ✅ BỔ SUNG LƯU DATABASE
        reward_type: is_game_reward ? (reward_type || 'voucher') : 'voucher',
        external_code: external_code || null,
        reward_image_url: reward_image_url || null,
        
        // ✅ LƯU TRƯỜNG CỦA CỬA HÀNG ĐỔI ĐIỂM VÀO DATABASE
        is_exchange_reward: is_exchange_reward || false,
        exchange_points: exchange_points || 0,
        exchange_limit: exchange_limit !== undefined ? exchange_limit : -1,
        image_url: image_url || null
      });
      res.json({ success: true, promotion: newPromo });
    } catch (error) {
      console.error('Error creating promotion:', error);
      res.status(500).json({ success: false, message: error.message || 'Lỗi tạo mã khuyến mãi' });
    }
  },

  // Lấy danh sách Voucher (Admin)
  getAllPromotions: async (req, res) => {
    try {
      const promotions = await models.Promotion.findAll({ 
        order: [['created_at', 'DESC']],
        attributes: { 
          include: [
            // Tính tự động trạng thái running/expired/upcoming
            [sequelize.literal(`CASE 
              WHEN end_date < NOW() THEN 'expired'
              WHEN start_date > NOW() THEN 'upcoming'
              WHEN usage_count >= usage_limit THEN 'exhausted'
              ELSE 'running' END`), 'status']
          ]
        }
      });

      const now = new Date();
      const inSevenDays = new Date();
      inSevenDays.setDate(now.getDate() + 7);

      const computedPromotions = promotions.map((promotion) => {
        const startDate = promotion.start_date ? new Date(promotion.start_date) : null;
        const endDate = promotion.end_date ? new Date(promotion.end_date) : null;
        let lifecycleStatus = promotion.status || 'unknown';

        if (endDate && endDate < now) {
          lifecycleStatus = 'expired';
        } else if (startDate && startDate > now) {
          lifecycleStatus = 'upcoming';
        } else if (Number(promotion.usage_count || 0) >= Number(promotion.usage_limit || 0) && Number(promotion.usage_limit || 0) > 0) {
          lifecycleStatus = 'exhausted';
        } else {
          lifecycleStatus = 'running';
        }

        return {
          ...promotion.toJSON(),
          status: lifecycleStatus,
        };
      });

      const statistics = computedPromotions.reduce((accumulator, promotion) => {
        accumulator.totalPromotions += 1;
        if (promotion.status === 'running') accumulator.activePromotions += 1;
        if (promotion.status === 'expired' || promotion.status === 'disabled') accumulator.inactivePromotions += 1;
        if (promotion.status === 'upcoming') accumulator.upcomingPromotions += 1;
        if (promotion.status === 'exhausted') accumulator.exhaustedPromotions += 1;
        if (promotion.apply_for && promotion.apply_for !== 'all') accumulator.voucherPromotions += 1;

        if (promotion.end_date) {
          const endDate = new Date(promotion.end_date);
          if (endDate >= now && endDate <= inSevenDays) accumulator.expiringSoon += 1;
        }

        accumulator.statusCounts[promotion.status] = (accumulator.statusCounts[promotion.status] || 0) + 1;
        return accumulator;
      }, {
        totalPromotions: 0,
        activePromotions: 0,
        inactivePromotions: 0,
        upcomingPromotions: 0,
        exhaustedPromotions: 0,
        expiringSoon: 0,
        voucherPromotions: 0,
        statusCounts: {}
      });

      const topPromotions = [...computedPromotions]
        .sort((left, right) => Number(right.usage_count || 0) - Number(left.usage_count || 0))
        .slice(0, 5)
        .map((promotion) => ({
          id: promotion.id,
          name: promotion.name,
          code: promotion.code,
          status: promotion.status,
          apply_for: promotion.apply_for,
          usage_count: Number(promotion.usage_count || 0),
          usage_limit: Number(promotion.usage_limit || 0),
          end_date: promotion.end_date
        }));

      res.json({ success: true, promotions });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Xóa Voucher
  deletePromotion: async (req, res) => {
    try {
      await models.Promotion.destroy({ where: { id: req.params.id } });
      res.json({ success: true, message: 'Đã xóa khuyến mãi' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // Toggle trạng thái nhanh (Active/Inactive)
  toggleEventStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const event = await models.Event.findByPk(id);
      if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

      // Đảo ngược trạng thái
      event.is_active = !event.is_active;
      await event.save();

      res.json({ success: true, is_active: event.is_active, message: 'Đã cập nhật trạng thái' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Tracking thống kê (Click/View)
  trackEventStats: async (req, res) => {
    try {
      const { id } = req.params;
      const { type } = req.body; // 'view' hoặc 'click'
      
      if (type === 'click') {
        await models.Event.increment('clicks', { where: { id } });
      } else {
        await models.Event.increment('views', { where: { id } });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  },

  // === 4. CÁC HÀM CẬP NHẬT & TIỆN ÍCH (THÊM MỚI) ===

  // Cập nhật sự kiện (Update)
  updateEvent: async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        title, content, start_date, end_date, is_popup, is_banner_ad,
        thumbnail, banner_url, description, 
        event_type, popup_config, cta_config, banner_ad_config,
        gallery, location,
        status, event_category, format, online_config,
        registration_limit, registration_open_at, registration_close_at,
        priority, tags
      } = req.body;
      
      const event = await models.Event.findByPk(id);
      if (!event) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
      }

      // Generate new slug if title changed
      let slug = event.slug;
      if (title && title !== event.title) {
        slug = title.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
          + '-' + Date.now();
      }

      // Hàm hỗ trợ parse JSON an toàn tránh lỗi "Unexpected end of JSON input"
      const safeParse = (value, fallback, isArray = false) => {
        if (value === undefined) return fallback;
        if (value === null || value === '') return isArray ? [] : null;
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch (e) { return fallback; }
      };

      // Update event an toàn
      await event.update({
        title: title || event.title,
        slug,
        content: content !== undefined ? content : event.content,
        start_date: start_date || event.start_date,
        end_date: end_date || event.end_date,
        is_popup: is_popup !== undefined ? is_popup : event.is_popup,
        is_banner_ad: is_banner_ad !== undefined ? is_banner_ad : event.is_banner_ad,
        banner_ad_config: safeParse(banner_ad_config, event.banner_ad_config),
        thumbnail: thumbnail !== undefined ? thumbnail : event.thumbnail,
        banner_url: banner_url !== undefined ? banner_url : event.banner_url,
        description: description !== undefined ? description : event.description,
        event_type: event_type || event.event_type,
        popup_config: safeParse(popup_config, event.popup_config),
        cta_config: safeParse(cta_config, event.cta_config),
        gallery: safeParse(gallery, event.gallery, true),
        location: location !== undefined ? location : event.location,
        status: status || event.status,
        event_category: event_category || event.event_category,
        format: format || event.format,
        online_config: safeParse(online_config, event.online_config),
        registration_limit: registration_limit !== undefined ? registration_limit : event.registration_limit,
        registration_open_at: registration_open_at !== undefined ? registration_open_at : event.registration_open_at,
        registration_close_at: registration_close_at !== undefined ? registration_close_at : event.registration_close_at,
        priority: priority || event.priority,
        tags: safeParse(tags, event.tags, true)
      });

      res.json({ success: true, event });
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Cập nhật khuyến mãi (Update)
  updatePromotion: async (req, res) => {
    try {
      const { id } = req.params;
      const promo = await models.Promotion.findByPk(id);
      if (!promo) return res.status(404).json({ success: false, message: 'Không tìm thấy khuyến mãi' });
      
      const updateData = { ...req.body };
      // Xử lý mảng thành chuỗi để lưu vào DB (Fix lỗi 500)
      if (Array.isArray(updateData.applicable_ids)) {
          updateData.applicable_ids = updateData.applicable_ids.join(',');
      } else if (updateData.applicable_ids === null || updateData.applicable_ids === '') {
          updateData.applicable_ids = null;
      }

      await promo.update(updateData);
      res.json({ success: true, promotion: promo });
    } catch (error) {
      console.error('Lỗi update voucher:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Bật/Tắt nhanh trạng thái (Toggle)
  toggleEventStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const event = await models.Event.findByPk(id);
      if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

      event.is_active = !event.is_active;
      await event.save();

      res.json({ success: true, is_active: event.is_active });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Tracking thống kê (Click/View)
  trackEventStats: async (req, res) => {
    try {
      const { id } = req.params;
      const { type } = req.body; // 'view' hoặc 'click'
      
      if (type === 'click') {
        await models.Event.increment('clicks', { where: { id } });
      } else {
        await models.Event.increment('views', { where: { id } });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false });
    }
  },
  // ✅ THÊM MỚI (trước dòng module.exports):
  // Thống kê sự kiện
  getEventStats: async (req, res) => {
    try {
      const { event_id, start_date, end_date } = req.query;

      if (event_id) {
        // Stats for specific event
        const event = await models.Event.findByPk(event_id);
        if (!event) {
          return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
        }

        const stats = {
          id: event.id,
          title: event.title,
          views: event.views || 0,
          clicks: event.clicks || 0,
          ctr: event.views > 0 ? ((event.clicks / event.views) * 100).toFixed(2) + '%' : '0%',
          status: new Date(event.end_date) < new Date() ? 'ended' : 
                  new Date(event.start_date) > new Date() ? 'upcoming' : 'ongoing'
        };

        return res.json({ success: true, stats });
      }

      // Overall stats
      const where = {};
      if (start_date && end_date) {
        where.created_at = {
          [Op.between]: [new Date(start_date), new Date(end_date)]
        };
      }

      const totalEvents = await models.Event.count({ where });
      const activeEvents = await models.Event.count({ 
        where: { ...where, is_active: true } 
      });
      
      const totalViews = await models.Event.sum('views', { where }) || 0;
      const totalClicks = await models.Event.sum('clicks', { where }) || 0;

      const topEvents = await models.Event.findAll({
        where,
        order: [['views', 'DESC']],
        limit: 5,
        attributes: ['id', 'title', 'views', 'clicks', 'event_type']
      });

      const stats = {
        total_events: totalEvents,
        active_events: activeEvents,
        total_views: totalViews,
        total_clicks: totalClicks,
        avg_ctr: totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) + '%' : '0%',
        top_events: topEvents
      };

      res.json({ success: true, stats });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Duplicate event
  duplicateEvent: async (req, res) => {
    try {
      const { id } = req.params;
      const originalEvent = await models.Event.findByPk(id);
      
      if (!originalEvent) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
      }

      const eventData = originalEvent.toJSON();
      delete eventData.id;
      delete eventData.created_at;
      delete eventData.updated_at;

      // Reset stats
      eventData.views = 0;
      eventData.clicks = 0;
      eventData.is_active = false;

      // New title and slug
      eventData.title = `${eventData.title} (Copy)`;
      eventData.slug = eventData.slug + '-copy-' + Date.now();

      const duplicatedEvent = await models.Event.create(eventData);

      res.json({ success: true, event: duplicatedEvent });
    } catch (error) {
      console.error('Error duplicating event:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Export events to CSV
  exportEvents: async (req, res) => {
    try {
      const events = await models.Event.findAll({
        order: [['created_at', 'DESC']],
        raw: true
      });

      // Create CSV
      const csv = [
        ['ID', 'Tiêu đề', 'Loại', 'Ngày bắt đầu', 'Ngày kết thúc', 'Lượt xem', 'Lượt click', 'Trạng thái'].join(','),
        ...events.map(e => [
          e.id,
          `"${e.title}"`,
          e.event_type,
          new Date(e.start_date).toLocaleDateString('vi-VN'),
          new Date(e.end_date).toLocaleDateString('vi-VN'),
          e.views || 0,
          e.clicks || 0,
          e.is_active ? 'Active' : 'Inactive'
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=events-${Date.now()}.csv`);
      res.send('\uFEFF' + csv); // UTF-8 BOM for Excel
    } catch (error) {
      console.error('Error exporting events:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
   // ✅ MỚI: Validate voucher khi thanh toán (dùng cho PaymentPage)
  validateVoucher: async (req, res) => {
  try {
    const userId = req.user.id;
    // ✅ Đồng bộ tên field với FE: apply_for + order_value
    const { code, apply_for, order_value, item_id } = req.body;
    const total_amount = parseFloat(order_value || 0);

    if (!code) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã voucher' });
    }

    // 1. Tìm promotion còn hạn, còn active
    const promotion = await models.Promotion.findOne({
      where: {
        code:       code.toUpperCase(),
        is_active:  true,
        start_date: { [Op.lte]: new Date() },
        end_date:   { [Op.gte]: new Date() }
      }
    });

    if (!promotion) {
      return res.status(404).json({ success: false, message: 'Mã không tồn tại hoặc đã hết hạn' });
    }

    // 2. Còn lượt dùng không
    if (promotion.usage_count >= promotion.usage_limit) {
      return res.status(400).json({ success: false, message: 'Mã voucher đã hết lượt sử dụng' });
    }

    // 3. ✅ Đúng loại apply_for không (dùng apply_for thay order_type)
    if (promotion.apply_for !== 'all' && apply_for && promotion.apply_for !== apply_for) {
      const typeMap = {
        service:      'dịch vụ khám bệnh',
        medicine:     'đơn thuốc',
        consultation: 'gói tư vấn',
        shipping:     'phí vận chuyển'
      };
      return res.status(400).json({
        success: false,
        message: `Mã này chỉ áp dụng cho ${typeMap[promotion.apply_for] || promotion.apply_for}`
      });
    }

    // 4. Đơn hàng tối thiểu
    const minOrder = parseFloat(promotion.min_order_value || 0);
    if (total_amount > 0 && minOrder > 0 && total_amount < minOrder) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng tối thiểu ${minOrder.toLocaleString('vi-VN')}đ để dùng mã này`
      });
    }

    // 5. Kiểm tra applicable_ids nếu admin chọn đích danh ID
    if (promotion.apply_for !== 'all' && promotion.applicable_ids) {
      const ids = promotion.applicable_ids.split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length > 0 && item_id && !ids.includes(String(item_id))) {
        return res.status(400).json({
          success: false,
          message: 'Mã này không áp dụng cho dịch vụ/gói bạn đang chọn'
        });
      }
    }

    // 6. User đã lưu mã chưa (userVoucher) và đã dùng chưa
    const userVoucher = await models.UserVoucher.findOne({
      where: { user_id: userId, promotion_id: promotion.id }
    });

    if (!userVoucher) {
      return res.status(400).json({
        success: false,
        message: 'Bạn chưa lưu mã này. Hãy vào Kho Ưu Đãi → Lưu mã trước nhé!'
      });
    }
    if (userVoucher.is_used) {
      return res.status(400).json({ success: false, message: 'Bạn đã sử dụng mã voucher này rồi' });
    }

    // 7. Tính discount amount
    let discountAmount = 0;
    if (promotion.discount_type === 'percentage') {
      discountAmount = (total_amount * parseFloat(promotion.discount_value)) / 100;
      const maxDisc = parseFloat(promotion.max_discount_amount || 0);
      if (maxDisc > 0) discountAmount = Math.min(discountAmount, maxDisc);
    } else {
      discountAmount = parseFloat(promotion.discount_value);
    }
    if (total_amount > 0) discountAmount = Math.min(discountAmount, total_amount);
    discountAmount = Math.round(discountAmount);

    // ✅ Response trả về `promotion` object — đồng bộ với FE đọc res.promotion
    // ✅ Mark voucher là đã dùng ngay khi áp mã thành công
    await userVoucher.update({ is_used: true, used_at: new Date() });
    await models.Promotion.increment('usage_count', { where: { id: promotion.id } });

    // ✅ Response trả về `promotion` object — đồng bộ với FE đọc res.promotion
    res.json({
      success: true,
      message: `Áp dụng mã thành công! Giảm ${discountAmount.toLocaleString('vi-VN')}đ`,
      promotion: {
        id:                  promotion.id,
        code:                promotion.code,
        name:                promotion.name,
        discount_type:       promotion.discount_type,
        discount_value:      promotion.discount_value,
        max_discount_amount: promotion.max_discount_amount || 0,
        apply_for:           promotion.apply_for,
      },
      discount_amount: discountAmount,
      final_amount:    total_amount > 0 ? total_amount - discountAmount : null
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
},

  // Cập nhật workflow status (draft → pending → approved → ...)
  updateEventWorkflowStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ['draft','pending','approved','scheduled','ongoing','ended','cancelled','postponed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
      }
      const event = await models.Event.findByPk(id);
      if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
      await event.update({ status });
      res.json({ success: true, status: event.status, message: `Đã chuyển sang: ${status}` });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // === 5. EVENT REGISTRATION & QR CHECK-IN ===

  // Đăng ký tham gia sự kiện
  registerEvent: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { event_id, guest_name, guest_email, guest_phone, attendee_count, notes } = req.body;
      const user_id = req.user?.id || null;

      // Kiểm tra sự kiện tồn tại và còn mở đăng ký
      const event = await models.Event.findByPk(event_id, { transaction });
      if (!event) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Sự kiện không tồn tại' });
      }

      const now = new Date();
      if (event.registration_close_at && new Date(event.registration_close_at) < now) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Đã hết thời hạn đăng ký' });
      }
      if (event.registration_open_at && new Date(event.registration_open_at) > now) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Chưa đến thời gian mở đăng ký' });
      }

      // Kiểm tra còn slot không
      if (event.registration_limit) {
        if (event.registration_count >= event.registration_limit) {
          // Cho vào hàng chờ
          const waitlist = await models.EventRegistration.create({
            event_id, user_id,
            guest_name, guest_email, guest_phone,
            attendee_count: attendee_count || 1,
            qr_code: 'WAIT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
            status: 'waitlist',
            notes
          }, { transaction });
          await transaction.commit();
          return res.json({ success: true, status: 'waitlist', registration: waitlist, message: 'Đã thêm vào danh sách chờ' });
        }
      }

      // Kiểm tra đã đăng ký chưa (nếu là user đăng nhập)
      if (user_id) {
        const existing = await models.EventRegistration.findOne({
          where: { event_id, user_id, status: { [Op.notIn]: ['cancelled'] } },
          transaction
        });
        if (existing) {
          await transaction.rollback();
          return res.status(400).json({ success: false, message: 'Bạn đã đăng ký sự kiện này rồi' });
        }
      }

      // Tạo QR code duy nhất
      const qr_code = 'EVT-' + event_id + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();

      const registration = await models.EventRegistration.create({
        event_id, user_id,
        guest_name:  user_id ? null : guest_name,
        guest_email: user_id ? null : guest_email,
        guest_phone: user_id ? null : guest_phone,
        attendee_count: attendee_count || 1,
        qr_code,
        status: 'registered',
        notes
      }, { transaction });

      // Tăng registration_count
      await event.increment('registration_count', { transaction });

      await transaction.commit();
      res.json({
        success: true,
        registration,
        qr_code,
        message: 'Đăng ký thành công! Giữ mã QR để check-in khi đến sự kiện.'
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error registering event:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Hủy đăng ký
  cancelRegistration: async (req, res) => {
    try {
      const { registration_id } = req.params;
      const user_id = req.user?.id;

      const registration = await models.EventRegistration.findOne({
        where: { id: registration_id, user_id }
      });
      if (!registration) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký' });
      }
      if (registration.status === 'cancelled') {
        return res.status(400).json({ success: false, message: 'Đăng ký này đã bị hủy' });
      }

      await registration.update({ status: 'cancelled' });

      // Giảm registration_count
      await models.Event.decrement('registration_count', { where: { id: registration.event_id } });

      res.json({ success: true, message: 'Đã hủy đăng ký' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // QR Check-in (Nâng cấp cho Màn hình Lễ Tân Full-screen)
  checkInByQR: async (req, res) => {
    try {
      const { qr_code } = req.body;
      if (!qr_code) {
        return res.status(400).json({ success: false, message: 'Thiếu mã QR' });
      }

      const registration = await models.EventRegistration.findOne({
        where: { qr_code },
        include: [{ 
          model: models.Event, 
          as: 'event', 
          attributes: ['id', 'title', 'start_date', 'end_date', 'gift_config', 'is_fee_required'] 
        }]
      });

      if (!registration) {
        return res.status(404).json({ success: false, message: 'Mã QR không hợp lệ hoặc không tồn tại!' });
      }
      if (registration.status === 'cancelled') {
        return res.status(400).json({ success: false, message: '⚠ Đăng ký này đã bị hủy trước đó!' });
      }

      // Nếu sự kiện có cấu hình quà tặng, và chưa có trạng thái quà -> set là pending
      let newGiftStatus = registration.gift_status;
      if (registration.event.gift_config && registration.gift_status === 'none') {
        newGiftStatus = 'pending';
      }

      if (registration.checked_in) {
        return res.status(400).json({
          success: false,
          is_already_checked_in: true, // Cờ báo cho Frontend hiện UI vàng/cam cảnh báo
          message: `Khách hàng này đã check-in lúc ${new Date(registration.checked_in_at).toLocaleTimeString('vi-VN')}`,
          registration: {
            id: registration.id,
            guest_name: registration.guest_name || 'Khách vãng lai',
            attendee_count: registration.attendee_count,
            event: registration.event,
            checked_in_at: registration.checked_in_at,
            gift_status: registration.gift_status
          }
        });
      }

      // Tiến hành check-in
      await registration.update({
        checked_in: true,
        checked_in_at: new Date(),
        status: 'attended',
        gift_status: newGiftStatus
      });

      res.json({
        success: true,
        message: '✅ Check-in thành công!',
        registration: {
          id: registration.id,
          guest_name: registration.guest_name || 'Khách vãng lai',
          guest_phone: registration.guest_phone,
          attendee_count: registration.attendee_count,
          event: registration.event,
          checked_in_at: registration.checked_in_at,
          gift_status: newGiftStatus
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ THÊM MỚI: API Phát quà
  distributeGift: async (req, res) => {
    try {
      const { registration_id, digital_signature } = req.body;

      const registration = await models.EventRegistration.findByPk(registration_id, {
        include: [{ model: models.Event, as: 'event' }]
      });

      if (!registration) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đăng ký' });
      }

      if (!registration.checked_in) {
        return res.status(400).json({ success: false, message: 'Khách hàng chưa check-in, không thể phát quà!' });
      }

      if (registration.gift_status === 'distributed') {
        return res.status(400).json({ success: false, message: 'Khách hàng này đã nhận quà rồi!' });
      }

      await registration.update({
        gift_status: 'distributed',
        gift_received_at: new Date(),
        digital_signature: digital_signature || null
      });

      res.json({ success: true, message: '🎁 Phát quà thành công!' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ THÊM MỚI: API Thống kê cho Command Center Realtime
  getCommandCenterStats: async (req, res) => {
    try {
      const { event_id } = req.params;

      const event = await models.Event.findByPk(event_id);
      if (!event) return res.status(404).json({ success: false, message: 'Sự kiện không tồn tại' });

      // Lấy toàn bộ đăng ký
      const registrations = await models.EventRegistration.findAll({
        where: { event_id }
      });

      const total_registered = registrations.length;
      const total_checked_in = registrations.filter(r => r.checked_in).length;
      const total_waiting = total_registered - total_checked_in;
      const gifts_distributed = registrations.filter(r => r.gift_status === 'distributed').length;
      
      const participation_rate = total_registered > 0 
        ? Math.round((total_checked_in / total_registered) * 100) 
        : 0;

      res.json({
        success: true,
        stats: {
          status: event.status,
          total_registered,
          total_checked_in,
          total_waiting,
          gifts_distributed,
          participation_rate: `${participation_rate}%`,
          registration_limit: event.registration_limit || 'Không giới hạn'
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Lấy danh sách đăng ký của 1 sự kiện (admin)
  getEventRegistrations: async (req, res) => {
    try {
      const { event_id } = req.params;
      const { status, page = 1, limit = 20 } = req.query;
      const where = { event_id };
      if (status) where.status = status;

      const { count, rows } = await models.EventRegistration.findAndCountAll({
        where,
        include: [{ model: models.User, as: 'user', attributes: ['id', 'full_name', 'email', 'phone'], required: false }],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: (page - 1) * parseInt(limit)
      });

      res.json({ 
        success: true, 
        events: eventsWithImages, 
        total: count || 0, // Đảm bảo luôn có số
        totalCount: count || 0, // Trả thêm cả tên này cho chắc chắn tương thích
        page: parseInt(page),
        total_pages: Math.ceil((count || 0) / limit),
        limit: parseInt(limit)
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Lấy đăng ký của user hiện tại
  getMyRegistrations: async (req, res) => {
    try {
      const registrations = await models.EventRegistration.findAll({
        where: { user_id: req.user.id },
        include: [{ model: models.Event, as: 'event', attributes: ['id', 'title', 'start_date', 'end_date', 'location', 'thumbnail', 'format'] }],
        order: [['created_at', 'DESC']]
      });
      res.json({ success: true, registrations });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ THÊM MỚI: API Lấy danh sách Dịch vụ / Thuốc / Tư vấn để chọn
  getSelectionData: async (req, res) => {
    try {
      const type = req.query.type; // 'service', 'medicine', 'consultation'
      let data = [];

      if (type === 'service') {
        data = await models.Service.findAll({
          where: { status: 'active' },
          attributes: ['id', 'name', 'price']
        });
      } else if (type === 'medicine') {
        data = await models.Medicine.findAll({
          where: { hidden: false },
          attributes: ['id', 'name', 'price']
        });
      } else if (type === 'consultation') {
        data = await models.ConsultationPricing.findAll({
          where: { is_active: true },
          attributes: ['id', ['package_name', 'name'], 'price'] // map tên trường cho đồng nhất Frontend
        });
      }

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // Toggle trạng thái Promotion (Admin bật/tắt nhanh)
  togglePromotion: async (req, res) => {
    try {
      const promo = await models.Promotion.findByPk(req.params.id);
      if (!promo) return res.status(404).json({ success: false, message: 'Không tìm thấy khuyến mãi' });
      promo.is_active = !promo.is_active;
      await promo.save();
      res.json({ success: true, is_active: promo.is_active, message: `Đã ${promo.is_active ? 'bật' : 'tắt'} khuyến mãi` });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Lấy lịch sử quay của user hiện tại (dùng cho tab Lịch sử)
 getMyGameHistory: async (req, res) => {
    try {
      const history = await models.GamePlay.findAll({
        where:   { user_id: req.user.id },
        attributes: ['id','user_id','wheel_event_id','promotion_id','result','points_spent','reward_name','created_at'],
        include: [
          { model: models.Promotion,  as: 'promotion',  attributes: ['id','name','code','reward_type','external_code','reward_image_url'] },
          { model: models.WheelEvent, as: 'wheelEvent', attributes: ['id','name'] }
        ],
        order: [['created_at','DESC']],
        limit: 30
      });
      // Normalize created_at để frontend dùng được
      const normalized = history.map(h => ({
        ...h.toJSON(),
        created_at: h.created_at || h.createdAt
      }));
      res.json({ success: true, history: normalized });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  },

  // ── WHEEL EVENT CRUD (Admin) ──────────────────────────────
  getWheelEvents: async (req, res) => {
    try {
      const events = await models.WheelEvent.findAll({
        include: [{
          model: models.WheelPrize,
          as: 'prizes',
          include: [{ model: models.Promotion, as: 'promotion', attributes: ['id','name','code'] }],
          order: [['sort_order','ASC']]
        }],
        order: [['created_at','DESC']]
      });
      // Đính kèm số liệu thực: tổng lượt quay, tổng trúng thưởng
      const eventsWithStats = await Promise.all(events.map(async (ev) => {
        const totalPlays = await models.GamePlay.count({ where: { wheel_event_id: ev.id } });
        const totalWins  = await models.GamePlay.count({ where: { wheel_event_id: ev.id, result: 'win' } });
        return { ...ev.toJSON(), stats: { totalPlays, totalWins, winRate: totalPlays > 0 ? ((totalWins/totalPlays)*100).toFixed(1) : 0 } };
      }));
      res.json({ success: true, wheel_events: eventsWithStats });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  },

  createWheelEvent: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { name, description, banner_url, start_date, end_date, spins_per_day, cost_per_spin, prizes } = req.body;
      if (!name || !start_date || !end_date)
        return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });

      const totalProb = (prizes || []).reduce((s, p) => s + parseFloat(p.probability || 0), 0);
      if (prizes?.length > 0 && (totalProb < 99 || totalProb > 100))
        return res.status(400).json({ success: false, message: `Tổng tỷ lệ các ô = ${totalProb.toFixed(1)}% (phải = 100%)` });

      const ev = await models.WheelEvent.create(
        { name, description, banner_url, start_date, end_date, spins_per_day: spins_per_day||3, cost_per_spin: cost_per_spin||10 },
        { transaction }
      );

      if (prizes?.length > 0) {
        // Tự động tạo Promotion cho ô thưởng loại voucher không có promotion_id
        const resolvedPrizes = await Promise.all(prizes.map(async (p, i) => {
          let promotionId = p.promotion_id ? parseInt(p.promotion_id) : null;

          // Nếu là ô thưởng voucher nhưng chưa chọn promotion → tự tạo
          if (!p.is_miss && p.reward_type === 'voucher' && !promotionId) {
            const autoCode = `WHEEL_${ev.id}_${i}_${Date.now()}`.toUpperCase().slice(0, 50);
            
            // Tự động phân tích tên giải thưởng (label) để lấy giá trị giảm giá
            let parsedType = 'percentage';
            let parsedValue = 0;
            const labelStr = (p.label || '').toLowerCase();
            
            if (labelStr.includes('%')) {
              parsedType = 'percentage';
              const match = labelStr.match(/(\d+)\s*%/);
              if (match) parsedValue = parseInt(match[1]);
            } else if (labelStr.includes('k')) {
              parsedType = 'fixed_amount';
              const match = labelStr.match(/(\d+)\s*k/);
              if (match) parsedValue = parseInt(match[1]) * 1000;
            }

            // Xử lý logic số lượng không giới hạn (-1)
            const parsedQuantity = parseInt(p.quantity);
            const finalUsageLimit = (!isNaN(parsedQuantity) && parsedQuantity > 0) ? parsedQuantity : 9999999;

            const newPromo = await models.Promotion.create({
              code:           autoCode,
              name:           p.label,
              description:    `Phần thưởng vòng quay: ${name}`,
              discount_type:  p.discount_type || parsedType,
              discount_value: p.discount_value || parsedValue,
              apply_for:      p.apply_for || 'all',
              usage_limit:    finalUsageLimit,
              usage_count:    0,
              start_date:     start_date,
              end_date:       end_date,
              is_active:      true,
              is_game_reward: true,
              reward_type:    'voucher',
              image_url:      p.reward_image_url || null,
            }, { transaction });
            promotionId = newPromo.id;
          }

          return {
            wheel_event_id:   ev.id,
            promotion_id:     promotionId,
            label:            p.label,
            probability:      p.probability,
            quantity:         p.quantity ?? -1,
            color:            p.color || null,
            is_miss:          p.is_miss || false,
            reward_type:      p.reward_type || 'voucher',
            external_code:    p.external_code || null,
            reward_image_url: p.reward_image_url || null,
            sort_order:       i
          };
        }));

        await models.WheelPrize.bulkCreate(resolvedPrizes, { transaction });
      }

      await transaction.commit();
      const full = await models.WheelEvent.findByPk(ev.id, {
        include: [{ model: models.WheelPrize, as: 'prizes', include: [{ model: models.Promotion, as: 'promotion' }] }]
      });
      res.status(201).json({ success: true, message: 'Tạo vòng quay thành công!', wheel_event: full });
    } catch (e) { await transaction.rollback(); res.status(500).json({ success: false, message: e.message }); }
  },

  updateWheelEvent: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const ev = await models.WheelEvent.findByPk(req.params.id, { transaction });
      if (!ev) return res.status(404).json({ success: false, message: 'Không tìm thấy' });

      const { prizes, ...eventData } = req.body;

      if (prizes?.length > 0) {
        const totalProb = prizes.reduce((s,p) => s + parseFloat(p.probability||0), 0);
        if (totalProb < 99 || totalProb > 100)
          return res.status(400).json({ success: false, message: `Tổng tỷ lệ = ${totalProb.toFixed(1)}% (phải = 100%)` });
      }

      await ev.update(eventData, { transaction });

      if (prizes) {
        await models.WheelPrize.destroy({ where: { wheel_event_id: ev.id }, transaction });
        if (prizes.length > 0) {
          const resolvedPrizes = await Promise.all(prizes.map(async (p, i) => {
            let promotionId = p.promotion_id ? parseInt(p.promotion_id) : null;

            // Nếu là ô voucher chưa có promotion → tự tạo
            if (!p.is_miss && p.reward_type === 'voucher' && !promotionId) {
              const autoCode = `WHEEL_${ev.id}_${i}_${Date.now()}`.toUpperCase().slice(0, 50);
              
              // Tự động phân tích tên giải thưởng (label) để lấy giá trị giảm giá
              let parsedType = 'percentage';
              let parsedValue = 0;
              const labelStr = (p.label || '').toLowerCase();
              
              if (labelStr.includes('%')) {
                parsedType = 'percentage';
                const match = labelStr.match(/(\d+)\s*%/);
                if (match) parsedValue = parseInt(match[1]);
              } else if (labelStr.includes('k')) {
                parsedType = 'fixed_amount';
                const match = labelStr.match(/(\d+)\s*k/);
                if (match) parsedValue = parseInt(match[1]) * 1000;
              }

              // Xử lý logic số lượng không giới hạn (-1)
              const parsedQuantity = parseInt(p.quantity);
              const finalUsageLimit = (!isNaN(parsedQuantity) && parsedQuantity > 0) ? parsedQuantity : 9999999;

              const newPromo = await models.Promotion.create({
                code:           autoCode,
                name:           p.label,
                description:    `Phần thưởng vòng quay: ${ev.name}`,
                discount_type:  p.discount_type || parsedType,
                discount_value: p.discount_value || parsedValue,
                apply_for:      p.apply_for || 'all',
                usage_limit:    finalUsageLimit,
                usage_count:    0,
                start_date:     req.body.start_date || ev.start_date,
                end_date:       req.body.end_date   || ev.end_date,
                is_active:      true,
                is_game_reward: true,
                reward_type:    'voucher',
                image_url:      p.reward_image_url || null,
              }, { transaction });
              promotionId = newPromo.id;
            }
            return {
              wheel_event_id:   ev.id,
              promotion_id:     promotionId,
              label:            p.label,
              probability:      p.probability,
              quantity:         p.quantity ?? -1,
              color:            p.color || null,
              is_miss:          p.is_miss || false,
              reward_type:      p.reward_type || 'voucher',
              external_code:    p.external_code || null,
              reward_image_url: p.reward_image_url || null,
              sort_order:       i
            };
          }));

          await models.WheelPrize.bulkCreate(resolvedPrizes, { transaction });
        }
      }

      await transaction.commit();
      res.json({ success: true, message: 'Cập nhật thành công' });
    } catch (e) { await transaction.rollback(); res.status(500).json({ success: false, message: e.message }); }
  },

  toggleWheelEvent: async (req, res) => {
    try {
      const ev = await models.WheelEvent.findByPk(req.params.id);
      if (!ev) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
      ev.is_active = !ev.is_active;
      await ev.save();
      res.json({ success: true, is_active: ev.is_active, message: `Đã ${ev.is_active ? 'bật' : 'tắt'} vòng quay` });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  },

  deleteWheelEvent: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      await models.WheelPrize.destroy({ where: { wheel_event_id: req.params.id }, transaction });
      await models.WheelEvent.destroy({ where: { id: req.params.id }, transaction });
      await transaction.commit();
      res.json({ success: true, message: 'Đã xóa vòng quay' });
    } catch (e) { await transaction.rollback(); res.status(500).json({ success: false, message: e.message }); }
  },

  // Danh sách người trúng thưởng — số liệu thực từ game_plays
  getWinners: async (req, res) => {
    try {
      const { wheel_event_id, page = 1, limit = 20 } = req.query;
      const where = { result: 'win' };
      if (wheel_event_id) where.wheel_event_id = wheel_event_id;

      const { count, rows } = await models.GamePlay.findAndCountAll({
        where,
        include: [
          { model: models.User,      as: 'user',       attributes: ['id','full_name','email','phone'] },
          { model: models.Promotion, as: 'promotion',  attributes: ['id','name','code'] },
          { model: models.WheelEvent,as: 'wheelEvent', attributes: ['id','name'] }
        ],
        order:  [['created_at','DESC']],
        limit:  parseInt(limit),
        offset: (parseInt(page)-1) * parseInt(limit)
      });

      res.json({ success: true, total: count, page: parseInt(page), winners: rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  },

  

  // ✅ LẤY CẤU HÌNH ĐIỂM THƯỞNG
  getLoyaltyConfig: async (req, res) => {
    try {
      const setting = await models.SystemSetting.findOne({ where: { setting_key: 'LOYALTY_CONFIG' } });
      const config = setting ? setting.value_json : { daily_checkin_points: 10, wheel_cost_per_spin: 10 };
      res.json({ success: true, config });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  },

  // ✅ CẬP NHẬT CẤU HÌNH ĐIỂM THƯỞNG
  updateLoyaltyConfig: async (req, res) => {
    try {
      const { daily_checkin_points } = req.body;
      let setting = await models.SystemSetting.findOne({ where: { setting_key: 'LOYALTY_CONFIG' } });
      const newValue = { 
        daily_checkin_points: Number(daily_checkin_points) || 10
      };

      if (setting) {
        setting.value_json = newValue;
        setting.updated_by = req.user.id;
        await setting.save();
      } else {
        await models.SystemSetting.create({
          setting_key: 'LOYALTY_CONFIG',
          value_json: newValue,
          updated_by: req.user.id
        });
      }
      res.json({ success: true, message: 'Cập nhật cấu hình thành công', config: newValue });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }

  },

  getBannerAdEvent: async (req, res) => {
    try {
      const now = new Date();
      const event = await models.Event.findOne({
        where: {
          is_banner_ad: true,
          is_active: true,
          status: { [Op.in]: ['approved', 'scheduled', 'ongoing'] },
          end_date: { [Op.gte]: now } // Xóa ràng buộc start_date để luôn quảng cáo sự kiện sắp tới
        },
        order: [['priority', 'DESC'], ['created_at', 'DESC']] // Sửa createdAt thành created_at
      });

      if (event) {
        const eventData = event.toJSON();
        // Gắn thêm Base URL cho ảnh banner để Frontend không bị lỗi 404
        eventData.banner_url = eventData.banner_url ? 
          (eventData.banner_url.startsWith('http') ? eventData.banner_url : `${process.env.BASE_URL || 'http://localhost:3001'}${eventData.banner_url}`) 
          : null;
        return res.json({ success: true, event: eventData });
      }

      return res.json({ success: true, event: null });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};



module.exports = marketingController;