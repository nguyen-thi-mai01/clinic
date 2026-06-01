// server/controllers/pharmacyController.js
const { sequelize, models } = require('../config/db');
const { Op } = require('sequelize');

// ================================================================
// HELPER: Lấy model an toàn (các model mới có thể chưa sync ngay)
// ================================================================
const getModels = () => {
  const Medicine        = models.Medicine;
  const MedicineBatch   = models.MedicineBatch;
  const StockTransaction = models.StockTransaction;
  const Supplier        = models.Supplier;
  const User            = models.User;

  if (!Medicine) throw new Error('Model Medicine chưa được load');
  return { Medicine, MedicineBatch, StockTransaction, Supplier, User };
};

// ================================================================
// HELPER: Gửi notification cho tất cả admin (không throw nếu lỗi)
// ================================================================
const notifyAdmins = async (type, title, message) => {
  try {
    if (!models.User || !models.Notification) return;
    const admins = await models.User.findAll({ where: { role: 'admin' } });
    for (const admin of admins) {
      await models.Notification.create({
        user_id: admin.id,
        type,
        title,
        message,
        is_read: false
      });
    }
  } catch (err) {
    console.error('notifyAdmins error (non-fatal):', err.message);
  }
};


// ================================================================
// HELPER: Ghi audit log kho (non-fatal)
// ================================================================
const writeAuditLog = async (action, target_type, target_id, changes, userId) => {
  try {
    if (!models.AuditLog) return;
    await models.AuditLog.create({
      user_id: userId,
      action,
      target_type,
      target_id: String(target_id),
      changes: JSON.stringify(changes),
      created_at: new Date()
    });
  } catch (err) {
    console.error('writeAuditLog error (non-fatal):', err.message);
  }
};

// ================================================================
// NHÓM 1: POS — Lấy thuốc cho quầy bán
// ================================================================

/**
 * GET /api/pharmacy/medicines
 * Trả về danh sách thuốc kèm stock_total để hiển thị trên POS
 * Thay thế cho /api/articles/medicines trong FrontDeskPage
 */
exports.getMedicinesForPOS = async (req, res) => {
  try {
    const { Medicine } = getModels();
    const { search = '', limit = 100, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereCondition = { hidden: false };

    if (search && search.trim()) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${search.trim()}%` } },
        { composition: { [Op.like]: `%${search.trim()}%` } },
        { manufacturer: { [Op.like]: `%${search.trim()}%` } }
      ];
    }

    // Kiểm tra role: staff/admin thấy thêm stock_total và min_stock_threshold
    // Guest/public chỉ thấy thông tin cơ bản, không thấy tồn kho thực tế
    const isAuthenticated = !!req.user;
    const baseAttributes = ['id', 'name', 'unit', 'price', 'manufacturer', 'image_url', 'category_id', 'is_prescription_drug'];
    const staffAttributes = [...baseAttributes, 'stock_total', 'min_stock_threshold'];

    const { count, rows } = await Medicine.findAndCountAll({
      where: whereCondition,
      attributes: isAuthenticated ? staffAttributes : baseAttributes,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      medicines: rows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page),
        pageSize: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('getMedicinesForPOS error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách thuốc', error: error.message });
  }
};

/**
 * GET /api/pharmacy/medicines/:id
 * Chi tiết 1 thuốc + các lô còn hàng (sắp xếp FEFO)
 */
exports.getMedicineDetail = async (req, res) => {
  try {
    const { Medicine, MedicineBatch } = getModels();
    const { id } = req.params;

    const medicine = await Medicine.findByPk(id, {
      attributes: ['id', 'name', 'unit', 'price', 'stock_total', 'is_prescription_drug', 'min_stock_threshold', 'manufacturer']
    });

    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thuốc' });
    }

    // Lấy các lô còn hàng, sắp xếp hạn dùng gần nhất lên trước (FEFO)
    let activeBatches = [];
    if (MedicineBatch) {
      activeBatches = await MedicineBatch.findAll({
        where: {
          medicine_id: id,
          quantity_remaining: { [Op.gt]: 0 },
          status: 'active'
        },
        order: [['expiry_date', 'ASC']]
      });
    }

    res.json({
      success: true,
      medicine,
      batches: activeBatches
    });
  } catch (error) {
    console.error('getMedicineDetail error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy chi tiết thuốc', error: error.message });
  }
};


// ================================================================
// NHÓM 2: BÁN THUỐC — Trừ kho theo FEFO
// ================================================================

/**
 * HELPER nội bộ: Trừ kho theo FEFO (First Expired First Out)
 * Tự động trừ qua nhiều lô nếu 1 lô không đủ
 * @param {number} medicineId
 * @param {number} quantityNeeded - Số lượng cần trừ
 * @param {string} refType - 'retail' | 'prescription'
 * @param {string} refId - Mã đơn hàng tham chiếu
 * @param {number} unitPrice - Giá bán tại thời điểm giao dịch
 * @param {number} createdBy - ID người thực hiện
 * @param {object} transaction - Sequelize transaction
 * @returns {boolean} true nếu trừ thành công
 */
const deductStockFEFO = async (medicineId, quantityNeeded, refType, refId, unitPrice, createdBy, transaction) => {
  const { MedicineBatch, StockTransaction } = getModels();

  if (!MedicineBatch || !StockTransaction) {
    // Nếu chưa có bảng kho, bỏ qua việc trừ kho (tương thích ngược)
    console.warn('MedicineBatch/StockTransaction chưa tồn tại, bỏ qua trừ kho');
    return true;
  }

  // Lấy các lô còn hàng, sắp xếp hạn dùng gần nhất (FEFO)
  const batches = await MedicineBatch.findAll({
    where: {
      medicine_id: medicineId,
      quantity_remaining: { [Op.gt]: 0 },
      status: 'active'
    },
    order: [['expiry_date', 'ASC']],
    lock: true, // Lock để tránh race condition khi nhiều giao dịch đồng thời
    transaction
  });

  let remaining = quantityNeeded;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const deduct = Math.min(batch.quantity_remaining, remaining);
    const newQty = batch.quantity_remaining - deduct;

    // Cập nhật lô
    await batch.update({
      quantity_remaining: newQty,
      status: newQty === 0 ? 'used_up' : 'active'
    }, { transaction });

    // Ghi lịch sử giao dịch
    await StockTransaction.create({
      batch_id: batch.id,
      medicine_id: medicineId,
      type: refType === 'prescription' ? 'export_prescription' : 'export_retail',
      quantity: -deduct, // Âm = xuất kho
      reference_id: refId,
      reference_type: refType,
      unit_price: unitPrice,
      created_by: createdBy
    }, { transaction });

    remaining -= deduct;
  }

  if (remaining > 0) {
    // Không đủ hàng trong kho — rollback sẽ do caller xử lý
    throw new Error(`Không đủ tồn kho. Còn thiếu ${remaining} ${quantityNeeded > 0 ? 'đơn vị' : ''}`);
  }

  // Cập nhật stock_total trên bảng medicines
  await models.Medicine.decrement('stock_total', {
    by: quantityNeeded,
    where: { id: medicineId },
    transaction
  });

  return true;
};

/**
 * POST /api/pharmacy/retail
 * Tạo đơn bán lẻ (không theo đơn bác sĩ) → tự động trừ kho FEFO
 * Body: { items: [{id, name, qty, price, unit}], customer: {name, phone}, payment_method, final_amount, code }
 */
exports.createRetailOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { items, customer, payment_method = 'cash', final_amount, total_amount, code } = req.body;

    if (!items || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Đơn hàng không có sản phẩm' });
    }

    const createdBy = req.user?.id;
    const orderCode = code || `REL${Date.now()}`;

    // Trừ kho từng mặt hàng
    for (const item of items) {
      await deductStockFEFO(
        item.id,
        parseInt(item.qty),
        'retail',
        orderCode,
        item.price,
        createdBy,
        transaction
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      message: 'Xuất hóa đơn thành công',
      invoice: {
        code: orderCode,
        items,
        customer,
        total_amount: total_amount || final_amount,
        final_amount: final_amount || total_amount,
        payment_method,
        created_at: new Date()
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('createRetailOrder error:', error.message);
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi tạo đơn bán lẻ' });
  }
};

/**
 * POST /api/pharmacy/sell-prescription
 * Bán theo đơn thuốc bác sĩ → trừ kho
 * Body: { medical_record_id, items: [{medicine_id, name, qty, price}] }
 */
exports.sellPrescription = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { medical_record_id, items } = req.body;
    const createdBy = req.user?.id;

    if (!items || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Đơn thuốc không có sản phẩm' });
    }

    const refId = `PRESC-${medical_record_id}`;

    for (const item of items) {
      if (!item.medicine_id) continue; // Bỏ qua thuốc chưa match với kho
      await deductStockFEFO(
        item.medicine_id,
        parseInt(item.qty || item.quantity || 1),
        'prescription',
        refId,
        item.price || 0,
        createdBy,
        transaction
      );
    }

    await transaction.commit();

    res.json({
      success: true,
      message: 'Xuất kho theo đơn thuốc thành công',
      reference: refId
    });
  } catch (error) {
    await transaction.rollback();
    console.error('sellPrescription error:', error.message);
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi xuất kho theo đơn thuốc' });
  }
};


// ================================================================
// NHÓM 3: QUẢN LÝ KHO
// ================================================================

/**
 * GET /api/pharmacy/stock
 * Tổng quan tồn kho: tất cả thuốc + tổng tồn + lô gần hết hạn nhất
 * Query: search, status (all|low|out|expiring), page, limit
 */
exports.getStock = async (req, res) => {
  try {
    const { Medicine, MedicineBatch } = getModels();
    const { search = '', status = 'all', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereCondition = {};

    if (search.trim()) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${search.trim()}%` } },
        { manufacturer: { [Op.like]: `%${search.trim()}%` } }
      ];
    }

    // Lọc theo trạng thái tồn kho
    if (status === 'out') {
      whereCondition.stock_total = 0;
    } else if (status === 'low') {
      whereCondition[Op.and] = [
        { stock_total: { [Op.gt]: 0 } },
        sequelize.where(sequelize.col('stock_total'), Op.lt, sequelize.col('min_stock_threshold'))
      ];
    }

    const today = new Date();
    const in60days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

    const { count, rows } = await Medicine.findAndCountAll({
      where: whereCondition,
      attributes: [
        'id', 'name', 'unit', 'price', 'manufacturer', 'image_url',
        'stock_total', 'min_stock_threshold', 'is_prescription_drug', 'hidden'
      ],
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    // Lấy nearest expiry bằng subquery riêng (Sequelize không hỗ trợ limit trong include)
    let nearestExpiryMap = {};
    if (MedicineBatch && rows.length > 0) {
      const medicineIds = rows.map(r => r.id);
      const nearestBatches = await MedicineBatch.findAll({
        where: {
          medicine_id: { [Op.in]: medicineIds },
          quantity_remaining: { [Op.gt]: 0 },
          status: 'active'
        },
        attributes: [
          'medicine_id',
          'batch_code',
          'expiry_date'
        ],
        order: [['expiry_date', 'ASC']],
        raw: true
      });
      // Chỉ giữ lô hạn gần nhất cho mỗi thuốc
      nearestBatches.forEach(b => {
        if (!nearestExpiryMap[b.medicine_id]) {
          nearestExpiryMap[b.medicine_id] = {
            expiry_date: b.expiry_date,
            batch_code: b.batch_code
          };
        }
      });
    }

    // Gắn cờ cảnh báo cho từng thuốc
    const enriched = rows.map(med => {
      const m = med.toJSON();
      const nearest = nearestExpiryMap[m.id];
      const isExpiringSoon = nearest && new Date(nearest.expiry_date) <= in60days;

      return {
        ...m,
        alert: m.stock_total === 0 ? 'out_of_stock'
          : (m.stock_total < m.min_stock_threshold) ? 'low_stock'
          : isExpiringSoon ? 'expiring_soon'
          : 'ok',
        nearest_expiry: nearest?.expiry_date || null,
        nearest_batch_code: nearest?.batch_code || null
      };
    });

    // Lọc thêm expiring nếu cần (không thể làm ở WHERE do cần join)
    const finalRows = status === 'expiring'
      ? enriched.filter(m => m.alert === 'expiring_soon')
      : enriched;

    res.json({
      success: true,
      stock: finalRows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page),
        pageSize: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('getStock error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy tồn kho', error: error.message });
  }
};

/**
 * GET /api/pharmacy/stock/alerts
 * Tổng hợp cảnh báo: hết hàng, sắp hết hạn 30/60 ngày, tồn thấp
 */
exports.getStockAlerts = async (req, res) => {
  try {
    const { Medicine, MedicineBatch } = getModels();
    const today = new Date();
    const in30days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

    // 1. Hết hàng
    const outOfStock = await Medicine.findAll({
      where: { stock_total: 0, hidden: false },
      attributes: ['id', 'name', 'unit', 'stock_total', 'min_stock_threshold']
    });

    // 2. Tồn thấp (> 0 nhưng < ngưỡng)
    const allMeds = await Medicine.findAll({
      where: { stock_total: { [Op.gt]: 0 }, hidden: false },
      attributes: ['id', 'name', 'unit', 'stock_total', 'min_stock_threshold']
    });
    const lowStock = allMeds.filter(m => m.stock_total < m.min_stock_threshold);

    // 3. Sắp hết hạn
    let expiring30 = [];
    let expiring60 = [];
    if (MedicineBatch) {
      const expiringBatches = await MedicineBatch.findAll({
        where: {
          expiry_date: { [Op.between]: [today, in60days] },
          quantity_remaining: { [Op.gt]: 0 },
          status: 'active'
        },
        include: [{
          model: Medicine,
          as: 'Medicine',
          attributes: ['id', 'name', 'unit']
        }],
        order: [['expiry_date', 'ASC']]
      });

      expiring30 = expiringBatches.filter(b => new Date(b.expiry_date) <= in30days);
      expiring60 = expiringBatches.filter(b => new Date(b.expiry_date) > in30days);
    }

    // 4. Lô đã hết hạn còn tồn
    let expiredWithStock = [];
    if (MedicineBatch) {
      expiredWithStock = await MedicineBatch.findAll({
        where: {
          expiry_date: { [Op.lt]: today },
          quantity_remaining: { [Op.gt]: 0 }
        },
        include: [{ model: Medicine, as: 'Medicine', attributes: ['id', 'name', 'unit'] }]
      });
    }

    // Auto-fix: cập nhật status=expired cho các lô đã quá hạn nhưng vẫn còn active
    if (MedicineBatch && expiredWithStock.length > 0) {
      const expiredIds = expiredWithStock.map(b => b.id);
      await MedicineBatch.update(
        { status: 'expired' },
        { where: { id: { [Op.in]: expiredIds } } }
      );
    }

    res.json({
      success: true,
      alerts: {
        out_of_stock: { count: outOfStock.length, items: outOfStock },
        low_stock: { count: lowStock.length, items: lowStock },
        expiring_30_days: { count: expiring30.length, items: expiring30 },
        expiring_60_days: { count: expiring60.length, items: expiring60 },
        expired_with_stock: { count: expiredWithStock.length, items: expiredWithStock }
      },
      total_alerts: outOfStock.length + lowStock.length + expiring30.length + expiredWithStock.length
    });
  } catch (error) {
    console.error('getStockAlerts error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy cảnh báo kho', error: error.message });
  }
};

/**
 * GET /api/pharmacy/stock/:medicineId/batches
 * Lấy tất cả lô của 1 thuốc (kể cả đã hết/hạn)
 */
exports.getBatchesByMedicine = async (req, res) => {
  try {
    const { Medicine, MedicineBatch, Supplier } = getModels();
    const { medicineId } = req.params;

    const medicine = await Medicine.findByPk(medicineId, {
      attributes: ['id', 'name', 'unit', 'stock_total', 'min_stock_threshold']
    });
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thuốc' });
    }

    if (!MedicineBatch) {
      return res.json({ success: true, medicine, batches: [] });
    }

    const includeSupplier = Supplier ? [{
      model: Supplier,
      as: 'Supplier',
      attributes: ['id', 'name', 'phone']
    }] : [];

    const batches = await MedicineBatch.findAll({
      where: { medicine_id: medicineId },
      include: includeSupplier,
      order: [['expiry_date', 'ASC'], ['created_at', 'DESC']]
    });

    res.json({ success: true, medicine, batches });
  } catch (error) {
    console.error('getBatchesByMedicine error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách lô', error: error.message });
  }
};

/**
 * POST /api/pharmacy/stock/import
 * Nhập lô thuốc mới vào kho
 * Body: { medicine_id, batch_code, expiry_date, quantity_import, import_price, supplier_id, import_date, note }
 */
exports.importStock = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { MedicineBatch, StockTransaction } = getModels();

    if (!MedicineBatch || !StockTransaction) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Module kho chưa được khởi tạo. Hãy chạy sync database.' });
    }

    const {
      medicine_id,
      batch_code,
      expiry_date,
      quantity_import,
      import_price = 0,
      supplier_id,
      import_date,
      note
    } = req.body;

    // Validate
    if (!medicine_id || !expiry_date || !quantity_import) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: medicine_id, expiry_date, quantity_import' });
    }

    const qty = parseInt(quantity_import);
    if (qty <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Số lượng nhập phải lớn hơn 0' });
    }

    const expiryDateObj = new Date(expiry_date);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (expiryDateObj <= todayStart) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Hạn dùng phải sau ngày hôm nay' });
    }

    // Kiểm tra thuốc tồn tại
    const medicine = await models.Medicine.findByPk(medicine_id, { transaction });
    if (!medicine) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy thuốc' });
    }

    // Tạo mã lô tự động nếu không nhập
    const auto_batch_code = batch_code || `LOT-${Date.now()}`;

    // Tạo lô nhập kho
    const batch = await MedicineBatch.create({
      medicine_id,
      batch_code: auto_batch_code,
      expiry_date,
      quantity_import: qty,
      quantity_remaining: qty,
      import_price: parseFloat(import_price) || 0,
      supplier_id: supplier_id || null,
      import_date: import_date || new Date(),
      import_by: req.user?.id,
      note: note || null,
      status: 'active'
    }, { transaction });

    // Ghi lịch sử giao dịch
    await StockTransaction.create({
      batch_id: batch.id,
      medicine_id,
      type: 'import',
      quantity: qty, // Dương = nhập vào
      reference_id: auto_batch_code,
      reference_type: 'import',
      unit_price: parseFloat(import_price) || 0,
      note: note || null,
      created_by: req.user?.id
    }, { transaction });

    // Cập nhật tổng tồn kho
    await models.Medicine.increment('stock_total', {
      by: qty,
      where: { id: medicine_id },
      transaction
    });

    await transaction.commit();

    // Reload để lấy stock_total mới
    await medicine.reload();

    await writeAuditLog(
      'IMPORT_STOCK', 'medicine_batch', batch.id,
      { medicine_id, batch_code: auto_batch_code, qty, import_price, supplier_id: supplier_id || null },
      req.user?.id
    );

    res.status(201).json({
      success: true,
      message: `Nhập kho thành công: ${qty} ${medicine.unit} ${medicine.name}`,
      batch,
      new_stock_total: medicine.stock_total
    });
  } catch (error) {
    await transaction.rollback();
    console.error('importStock error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi nhập kho', error: error.message });
  }
};

/**
 * POST /api/pharmacy/stock/adjust
 * Điều chỉnh tồn kho (kiểm kê): so sánh thực tế và ghi chênh lệch
 * Body: { medicine_id, batch_id, actual_quantity, note }
 */
exports.adjustStock = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { MedicineBatch, StockTransaction } = getModels();
    const { medicine_id, batch_id, actual_quantity, note } = req.body;

    if (!medicine_id || actual_quantity === undefined) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Thiếu medicine_id hoặc actual_quantity' });
    }

    const actualQty = parseInt(actual_quantity);

    if (MedicineBatch && batch_id) {
      // Điều chỉnh theo lô cụ thể
      const batch = await MedicineBatch.findByPk(batch_id, { transaction });
      if (!batch) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Không tìm thấy lô thuốc' });
      }

      const diff = actualQty - batch.quantity_remaining;

      await batch.update({
        quantity_remaining: actualQty,
        status: actualQty === 0 ? 'used_up' : 'active'
      }, { transaction });

      if (StockTransaction && diff !== 0) {
        await StockTransaction.create({
          batch_id: batch.id,
          medicine_id,
          type: 'adjust',
          quantity: diff,
          reference_id: `ADJ-${Date.now()}`,
          reference_type: 'adjustment',
          note: note || `Kiểm kê: thực tế ${actualQty}, hệ thống ${batch.quantity_remaining + diff}`,
          created_by: req.user?.id
        }, { transaction });
      }

      // Cập nhật lại stock_total bằng cách tính lại từ tất cả lô active
      const allBatches = await MedicineBatch.findAll({
        where: { medicine_id, status: { [Op.in]: ['active', 'used_up'] } },
        transaction
      });
      const newTotal = allBatches.reduce((sum, b) => sum + b.quantity_remaining, 0);
      await models.Medicine.update({ stock_total: newTotal }, { where: { id: medicine_id }, transaction });
    } else {
      // Điều chỉnh trực tiếp stock_total (không theo lô)
      const medicine = await models.Medicine.findByPk(medicine_id, { transaction });
      if (!medicine) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Không tìm thấy thuốc' });
      }

      const diff = actualQty - medicine.stock_total;
      await medicine.update({ stock_total: actualQty }, { transaction });

      if (StockTransaction && diff !== 0) {
        await StockTransaction.create({
          medicine_id,
          type: 'adjust',
          quantity: diff,
          reference_id: `ADJ-${Date.now()}`,
          reference_type: 'adjustment',
          note: note || `Điều chỉnh tồn: ${medicine.stock_total + diff} → ${actualQty}`,
          created_by: req.user?.id
        }, { transaction });
      }
    }

    await transaction.commit();

    await notifyAdmins(
      'stock_adjust',
      '📋 Kiểm kê kho thuốc',
      `Nhân viên ${req.user?.username || req.user?.id} đã điều chỉnh tồn kho thuốc ID ${medicine_id}`
    );

    await writeAuditLog(
      'ADJUST_STOCK', 'medicine_batch', batch_id || medicine_id,
      { medicine_id, batch_id: batch_id || null, actual_quantity: actualQty },
      req.user?.id
    );

    res.json({ success: true, message: 'Điều chỉnh tồn kho thành công' });
  } catch (error) {
    await transaction.rollback();
    console.error('adjustStock error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi điều chỉnh kho', error: error.message });
  }
};

/**
 * GET /api/pharmacy/stock/transactions
 * Lịch sử giao dịch kho
 * Query: medicine_id, type, from_date, to_date, page, limit
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const { StockTransaction } = getModels();

    if (!StockTransaction) {
      return res.json({ success: true, transactions: [], pagination: {} });
    }

    const {
      medicine_id,
      type,
      from_date,
      to_date,
      page = 1,
      limit = 30
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereCondition = {};

    if (medicine_id) whereCondition.medicine_id = medicine_id;
    if (type) whereCondition.type = type;
    if (from_date || to_date) {
      whereCondition.created_at = {};
      if (from_date) whereCondition.created_at[Op.gte] = new Date(from_date);
      if (to_date) {
        const end = new Date(to_date);
        end.setHours(23, 59, 59, 999);
        whereCondition.created_at[Op.lte] = end;
      }
    }

    const includeOptions = [];
    if (models.Medicine) {
      includeOptions.push({
        model: models.Medicine,
        as: 'Medicine',
        attributes: ['id', 'name', 'unit']
      });
    }
    if (models.MedicineBatch) {
      includeOptions.push({
        model: models.MedicineBatch,
        as: 'Batch',
        attributes: ['id', 'batch_code', 'expiry_date'],
        required: false
      });
    }
    if (models.User) {
      includeOptions.push({
        model: models.User,
        as: 'CreatedBy',
        attributes: ['id', 'full_name', 'username'],
        required: false
      });
    }

    const { count, rows } = await StockTransaction.findAndCountAll({
      where: whereCondition,
      include: includeOptions,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    res.json({
      success: true,
      transactions: rows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / parseInt(limit)),
        currentPage: parseInt(page),
        pageSize: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('getTransactionHistory error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy lịch sử giao dịch', error: error.message });
  }
};


// ================================================================
// NHÓM 3C: BÁO CÁO DOANH THU KHO
// ================================================================

/**
 * GET /api/pharmacy/stock/revenue
 * Báo cáo doanh thu thuốc
 * Query: from_date, to_date, group_by (medicine|day|month)
 */
exports.getRevenueReport = async (req, res) => {
  try {
    const { StockTransaction } = getModels();
    if (!StockTransaction) {
      return res.json({ success: true, report: [], summary: {} });
    }

    const { from_date, to_date, group_by = 'medicine' } = req.query;

    // Điều kiện thời gian
    const dateCondition = {};
    if (from_date || to_date) {
      dateCondition.created_at = {};
      if (from_date) dateCondition.created_at[Op.gte] = new Date(from_date);
      if (to_date) {
        const end = new Date(to_date);
        end.setHours(23, 59, 59, 999);
        dateCondition.created_at[Op.lte] = end;
      }
    }

    // Lấy tất cả giao dịch XUẤT (bán lẻ + theo đơn) trong khoảng thời gian
    const exportTxs = await StockTransaction.findAll({
      where: {
        type: { [Op.in]: ['export_retail', 'export_prescription'] },
        ...dateCondition
      },
      include: [
        {
          model: models.Medicine,
          as: 'Medicine',
          attributes: ['id', 'name', 'unit', 'price']
        },
        {
          model: models.MedicineBatch,
          as: 'Batch',
          attributes: ['id', 'batch_code', 'import_price'],
          required: false
        }
      ],
      order: [['created_at', 'ASC']],
      raw: false
    });

    // Lấy tất cả giao dịch NHẬP trong khoảng thời gian
    const importTxs = await StockTransaction.findAll({
      where: {
        type: 'import',
        ...dateCondition
      },
      raw: true
    });

    // Tính tổng nhập kho (chi phí)
    const totalImportCost = importTxs.reduce((sum, tx) => {
      return sum + (parseFloat(tx.unit_price) || 0) * (parseInt(tx.quantity) || 0);
    }, 0);

    if (group_by === 'medicine') {
      // Nhóm theo từng thuốc
      const medicineMap = {};

      for (const tx of exportTxs) {
        const medId = tx.medicine_id;
        if (!medicineMap[medId]) {
          medicineMap[medId] = {
            medicine_id: medId,
            medicine_name: tx.Medicine?.name || '—',
            unit: tx.Medicine?.unit || '',
            sell_price: parseFloat(tx.Medicine?.price) || 0,
            qty_sold: 0,
            revenue: 0,       // Doanh thu = qty * sell_price (giá niêm yết)
            cogs: 0,          // Cost of Goods Sold = qty * import_price (giá nhập)
            gross_profit: 0,
            tx_count: 0
          };
        }

        const qty = Math.abs(parseInt(tx.quantity) || 0);
        const sellPrice = parseFloat(tx.unit_price) || parseFloat(tx.Medicine?.price) || 0;
        const importPrice = parseFloat(tx.Batch?.import_price) || 0;

        medicineMap[medId].qty_sold += qty;
        medicineMap[medId].revenue += qty * sellPrice;
        medicineMap[medId].cogs += qty * importPrice;
        medicineMap[medId].tx_count += 1;
      }

      // Tính gross profit
      const report = Object.values(medicineMap).map(item => ({
        ...item,
        gross_profit: item.revenue - item.cogs,
        profit_margin: item.revenue > 0
          ? Math.round((item.gross_profit / item.revenue) * 100 * 10) / 10
          : 0
      })).sort((a, b) => b.revenue - a.revenue);

      const summary = {
        total_revenue: report.reduce((s, r) => s + r.revenue, 0),
        total_cogs: report.reduce((s, r) => s + r.cogs, 0),
        total_gross_profit: report.reduce((s, r) => s + r.gross_profit, 0),
        total_import_cost: totalImportCost,
        total_qty_sold: report.reduce((s, r) => s + r.qty_sold, 0),
        total_tx: report.reduce((s, r) => s + r.tx_count, 0),
        medicine_count: report.length
      };
      summary.overall_margin = summary.total_revenue > 0
        ? Math.round((summary.total_gross_profit / summary.total_revenue) * 100 * 10) / 10
        : 0;

      return res.json({ success: true, group_by, report, summary });
    }

    if (group_by === 'day' || group_by === 'month') {
      // Nhóm theo ngày hoặc tháng
      const timeMap = {};

      for (const tx of exportTxs) {
        const date = new Date(tx.created_at);
        const key = group_by === 'day'
          ? date.toISOString().split('T')[0]                        // YYYY-MM-DD
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

        if (!timeMap[key]) {
          timeMap[key] = { period: key, revenue: 0, cogs: 0, qty_sold: 0, tx_count: 0 };
        }

        const qty = Math.abs(parseInt(tx.quantity) || 0);
        const sellPrice = parseFloat(tx.unit_price) || parseFloat(tx.Medicine?.price) || 0;
        const importPrice = parseFloat(tx.Batch?.import_price) || 0;

        timeMap[key].revenue += qty * sellPrice;
        timeMap[key].cogs += qty * importPrice;
        timeMap[key].qty_sold += qty;
        timeMap[key].tx_count += 1;
      }

      const report = Object.values(timeMap)
        .map(item => ({
          ...item,
          gross_profit: item.revenue - item.cogs,
          profit_margin: item.revenue > 0
            ? Math.round(((item.revenue - item.cogs) / item.revenue) * 100 * 10) / 10
            : 0
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      const summary = {
        total_revenue: report.reduce((s, r) => s + r.revenue, 0),
        total_cogs: report.reduce((s, r) => s + r.cogs, 0),
        total_gross_profit: report.reduce((s, r) => s + r.gross_profit, 0),
        total_qty_sold: report.reduce((s, r) => s + r.qty_sold, 0),
        total_tx: report.reduce((s, r) => s + r.tx_count, 0)
      };
      summary.overall_margin = summary.total_revenue > 0
        ? Math.round((summary.total_gross_profit / summary.total_revenue) * 100 * 10) / 10
        : 0;

      return res.json({ success: true, group_by, report, summary });
    }

    res.status(400).json({ success: false, message: 'group_by phải là medicine | day | month' });
  } catch (error) {
    console.error('getRevenueReport error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy báo cáo doanh thu', error: error.message });
  }
};

// ================================================================
// NHÓM 3B: HỦY LÔ THUỐC HẾT HẠN
// ================================================================

/**
 * POST /api/pharmacy/stock/destroy
 * Hủy lô thuốc hết hạn hoặc bị lỗi
 * Body: { batch_id, reason }
 */
exports.destroyBatch = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { MedicineBatch, StockTransaction } = getModels();
    if (!MedicineBatch || !StockTransaction) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Module kho chưa khởi tạo' });
    }

    const { batch_id, reason } = req.body;
    if (!batch_id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Thiếu batch_id' });
    }

    const batch = await MedicineBatch.findByPk(batch_id, {
      include: [{ model: models.Medicine, as: 'Medicine', attributes: ['id', 'name', 'unit'] }],
      transaction
    });
    if (!batch) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy lô thuốc' });
    }
    if (batch.quantity_remaining <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Lô này đã hết hàng, không cần hủy' });
    }

    const destroyQty = batch.quantity_remaining;

    // Ghi giao dịch hủy
    await StockTransaction.create({
      batch_id: batch.id,
      medicine_id: batch.medicine_id,
      type: 'destroy',
      quantity: -destroyQty,
      reference_id: `DESTROY-${Date.now()}`,
      reference_type: 'destroy',
      unit_price: batch.import_price || 0,
      note: reason || `Hủy lô hết hạn: ${batch.batch_code}`,
      created_by: req.user?.id
    }, { transaction });

    // Cập nhật lô về 0, status = expired
    await batch.update({
      quantity_remaining: 0,
      status: 'expired'
    }, { transaction });

    // Trừ stock_total trên medicine
    await models.Medicine.decrement('stock_total', {
      by: destroyQty,
      where: { id: batch.medicine_id },
      transaction
    });

    await transaction.commit();

    await notifyAdmins(
      'stock_destroy',
      '🗑️ Hủy lô thuốc',
      `Nhân viên ${req.user?.username || req.user?.id} đã hủy lô ${batch.batch_code} (${batch.Medicine?.name}) — SL: ${destroyQty}`
    );

    await writeAuditLog(
      'DESTROY_BATCH', 'medicine_batch', batch.id,
      { batch_code: batch.batch_code, medicine_id: batch.medicine_id, qty_destroyed: destroyQty, reason: reason || null },
      req.user?.id
    );

    res.json({
      success: true,
      message: `Đã hủy ${destroyQty} ${batch.Medicine?.unit || ''} lô ${batch.batch_code}`,
      destroyed_qty: destroyQty
    });
  } catch (error) {
    await transaction.rollback();
    console.error('destroyBatch error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi hủy lô thuốc', error: error.message });
  }
};

/**
 * POST /api/pharmacy/stock/bulk-adjust
 * Kiểm kê hàng loạt trong 1 transaction
 * Body: { items: [{medicine_id, batch_id, actual_quantity, note}], session_note }
 */
exports.bulkAdjustStock = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { MedicineBatch, StockTransaction } = getModels();
    const { items, session_note } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Danh sách kiểm kê trống' });
    }

    const results = [];
    const affectedMedicineIds = new Set();

    for (const item of items) {
      const { medicine_id, batch_id, actual_quantity, note } = item;

      if (!medicine_id || actual_quantity === undefined || actual_quantity < 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Item không hợp lệ: medicine_id=${medicine_id}, actual_quantity=${actual_quantity}`
        });
      }

      const actualQty = parseInt(actual_quantity);

      if (MedicineBatch && batch_id) {
        const batch = await MedicineBatch.findByPk(batch_id, { transaction });
        if (!batch) {
          await transaction.rollback();
          return res.status(404).json({ success: false, message: `Không tìm thấy lô ID ${batch_id}` });
        }

        const diff = actualQty - batch.quantity_remaining;
        if (diff === 0) continue; // Không có sai lệch, bỏ qua

        await batch.update({
          quantity_remaining: actualQty,
          status: actualQty === 0 ? 'used_up' : 'active'
        }, { transaction });

        if (StockTransaction) {
          await StockTransaction.create({
            batch_id: batch.id,
            medicine_id,
            type: 'adjust',
            quantity: diff,
            reference_id: `BULK-ADJ-${Date.now()}`,
            reference_type: 'adjustment',
            note: note || `Kiểm kê hàng loạt: thực tế ${actualQty}, hệ thống ${batch.quantity_remaining + diff}`,
            created_by: req.user?.id
          }, { transaction });
        }

        affectedMedicineIds.add(medicine_id);
        results.push({ medicine_id, batch_id, diff, old_qty: batch.quantity_remaining + diff, new_qty: actualQty });
      }
    }

    // Recalculate stock_total cho tất cả medicine bị ảnh hưởng
    for (const medicine_id of affectedMedicineIds) {
      const allBatches = await MedicineBatch.findAll({
        where: { medicine_id, status: { [Op.in]: ['active', 'used_up'] } },
        transaction
      });
      const newTotal = allBatches.reduce((sum, b) => sum + b.quantity_remaining, 0);
      await models.Medicine.update({ stock_total: newTotal }, { where: { id: medicine_id }, transaction });
    }

    await transaction.commit();

    await writeAuditLog(
      'BULK_ADJUST_STOCK', 'stock_transaction', 0,
      { total_items: items.length, adjusted_items: results.length, session_note: session_note || null },
      req.user?.id
    );

    await notifyAdmins(
      'stock_adjust',
      '📋 Kiểm kê kho hàng loạt',
      `Nhân viên ${req.user?.username || req.user?.id} đã kiểm kê ${results.length}/${items.length} mục có sai lệch`
    );

    res.json({
      success: true,
      message: `Kiểm kê hoàn tất: ${results.length}/${items.length} mục có điều chỉnh`,
      adjusted: results,
      skipped: items.length - results.length
    });
  } catch (error) {
    await transaction.rollback();
    console.error('bulkAdjustStock error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi kiểm kê hàng loạt', error: error.message });
  }
};

// ================================================================
// NHÓM 3D: EXPORT CSV
// ================================================================

/**
 * HELPER: chuyển array of objects thành chuỗi CSV
 */
const toCSV = (headers, rows) => {
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerRow = headers.map(h => escape(h.label)).join(',');
  const dataRows = rows.map(row =>
    headers.map(h => escape(row[h.key])).join(',')
  );
  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n'); // \uFEFF = BOM UTF-8 cho Excel
};

/**
 * GET /api/pharmacy/stock/export-csv
 * Xuất lịch sử giao dịch kho ra CSV
 */
exports.exportTransactionsCSV = async (req, res) => {
  try {
    const { StockTransaction } = getModels();
    if (!StockTransaction) {
      return res.status(400).json({ success: false, message: 'Module kho chưa khởi tạo' });
    }

    const { from_date, to_date, type } = req.query;

    const whereCondition = {};
    if (type) whereCondition.type = type;
    if (from_date || to_date) {
      whereCondition.created_at = {};
      if (from_date) whereCondition.created_at[Op.gte] = new Date(from_date);
      if (to_date) {
        const end = new Date(to_date);
        end.setHours(23, 59, 59, 999);
        whereCondition.created_at[Op.lte] = end;
      }
    }

    const transactions = await StockTransaction.findAll({
      where: whereCondition,
      include: [
        {
          model: models.Medicine,
          as: 'Medicine',
          attributes: ['id', 'name', 'unit'],
          required: false
        },
        {
          model: models.MedicineBatch,
          as: 'Batch',
          attributes: ['batch_code', 'expiry_date'],
          required: false
        },
        {
          model: models.User,
          as: 'CreatedBy',
          attributes: ['full_name', 'username'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 10000 // giới hạn 10k dòng để tránh quá tải
    });

    const TYPE_LABEL = {
      import: 'Nhập kho',
      export_retail: 'Bán lẻ',
      export_prescription: 'Theo đơn BS',
      adjust: 'Điều chỉnh',
      destroy: 'Hủy thuốc'
    };

    const headers = [
      { key: 'time',       label: 'Thời gian' },
      { key: 'medicine',   label: 'Tên thuốc' },
      { key: 'unit',       label: 'Đơn vị' },
      { key: 'batch_code', label: 'Số lô' },
      { key: 'expiry',     label: 'Hạn dùng' },
      { key: 'type',       label: 'Loại GD' },
      { key: 'quantity',   label: 'Số lượng' },
      { key: 'unit_price', label: 'Đơn giá' },
      { key: 'total',      label: 'Thành tiền' },
      { key: 'reference',  label: 'Mã tham chiếu' },
      { key: 'created_by', label: 'Người thực hiện' },
      { key: 'note',       label: 'Ghi chú' }
    ];

    const rows = transactions.map(tx => ({
      time:       new Date(tx.created_at).toLocaleString('vi-VN'),
      medicine:   tx.Medicine?.name || '',
      unit:       tx.Medicine?.unit || '',
      batch_code: tx.Batch?.batch_code || '',
      expiry:     tx.Batch?.expiry_date
                    ? new Date(tx.Batch.expiry_date).toLocaleDateString('vi-VN')
                    : '',
      type:       TYPE_LABEL[tx.type] || tx.type,
      quantity:   tx.quantity,
      unit_price: tx.unit_price || 0,
      total:      Math.abs(tx.quantity) * (parseFloat(tx.unit_price) || 0),
      reference:  tx.reference_id || '',
      created_by: tx.CreatedBy?.full_name || tx.CreatedBy?.username || '',
      note:       tx.note || ''
    }));

    const csv = toCSV(headers, rows);
    const filename = `lich-su-giao-dich-kho_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('exportTransactionsCSV error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi xuất CSV', error: error.message });
  }
};

/**
 * GET /api/pharmacy/stock/export-revenue-csv
 * Xuất báo cáo doanh thu ra CSV
 */
exports.exportRevenueCSV = async (req, res) => {
  try {
    // Tái sử dụng logic getRevenueReport nhưng trả về CSV
    const mockRes = {
      _data: null,
      json(data) { this._data = data; },
      status() { return this; }
    };

    // Gọi lại hàm getRevenueReport với res giả để lấy data
    await exports.getRevenueReport(req, mockRes);

    if (!mockRes._data?.success) {
      return res.status(500).json({ success: false, message: 'Lỗi khi lấy dữ liệu doanh thu' });
    }

    const { report, group_by, summary } = mockRes._data;

    let headers, rows;

    if (group_by === 'medicine') {
      headers = [
        { key: 'medicine_name',  label: 'Tên thuốc' },
        { key: 'unit',           label: 'Đơn vị' },
        { key: 'qty_sold',       label: 'Số lượng bán' },
        { key: 'revenue',        label: 'Doanh thu (đ)' },
        { key: 'cogs',           label: 'Giá vốn (đ)' },
        { key: 'gross_profit',   label: 'Lợi nhuận gộp (đ)' },
        { key: 'profit_margin',  label: 'Biên LN (%)' },
        { key: 'tx_count',       label: 'Số GD' }
      ];
      rows = [
        ...report,
        // Dòng tổng cộng
        {
          medicine_name: 'TỔNG CỘNG',
          unit: '',
          qty_sold: summary.total_qty_sold,
          revenue: summary.total_revenue,
          cogs: summary.total_cogs,
          gross_profit: summary.total_gross_profit,
          profit_margin: summary.overall_margin,
          tx_count: summary.total_tx
        }
      ];
    } else {
      headers = [
        { key: 'period',        label: group_by === 'day' ? 'Ngày' : 'Tháng' },
        { key: 'qty_sold',      label: 'Số lượng bán' },
        { key: 'revenue',       label: 'Doanh thu (đ)' },
        { key: 'cogs',          label: 'Giá vốn (đ)' },
        { key: 'gross_profit',  label: 'Lợi nhuận gộp (đ)' },
        { key: 'profit_margin', label: 'Biên LN (%)' },
        { key: 'tx_count',      label: 'Số GD' }
      ];
      rows = [
        ...report,
        {
          period: 'TỔNG CỘNG',
          qty_sold: summary.total_qty_sold,
          revenue: summary.total_revenue,
          cogs: summary.total_cogs,
          gross_profit: summary.total_gross_profit,
          profit_margin: summary.overall_margin,
          tx_count: summary.total_tx
        }
      ];
    }

    const csv = toCSV(headers, rows);
    const filename = `doanh-thu-thuoc_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('exportRevenueCSV error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi xuất CSV doanh thu', error: error.message });
  }
};

// ================================================================
// NHÓM 4: NHÀ CUNG CẤP
// ================================================================

/**
 * GET /api/pharmacy/suppliers
 */
exports.getSuppliers = async (req, res) => {
  try {
    const { Supplier } = getModels();
    if (!Supplier) return res.json({ success: true, suppliers: [] });

    const { search = '', status = 'active' } = req.query;
    const whereCondition = {};
    if (status !== 'all') whereCondition.status = status;
    if (search.trim()) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${search.trim()}%` } },
        { phone: { [Op.like]: `%${search.trim()}%` } }
      ];
    }

    const suppliers = await Supplier.findAll({
      where: whereCondition,
      order: [['name', 'ASC']]
    });

    res.json({ success: true, suppliers });
  } catch (error) {
    console.error('getSuppliers error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách nhà cung cấp', error: error.message });
  }
};

/**
 * POST /api/pharmacy/suppliers
 * Body: { name, phone, email, address, tax_code, contact_person }
 */
exports.createSupplier = async (req, res) => {
  try {
    const { Supplier } = getModels();
    if (!Supplier) return res.status(400).json({ success: false, message: 'Module nhà cung cấp chưa được khởi tạo' });

    const { name, phone, email, address, tax_code, contact_person } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Tên nhà cung cấp là bắt buộc' });

    const supplier = await Supplier.create({ name, phone, email, address, tax_code, contact_person, status: 'active' });

    res.status(201).json({ success: true, message: 'Thêm nhà cung cấp thành công', supplier });
  } catch (error) {
    console.error('createSupplier error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi thêm nhà cung cấp', error: error.message });
  }
};

/**
 * PUT /api/pharmacy/suppliers/:id
 */
exports.updateSupplier = async (req, res) => {
  try {
    const { Supplier } = getModels();
    if (!Supplier) return res.status(400).json({ success: false, message: 'Module nhà cung cấp chưa được khởi tạo' });

    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Không tìm thấy nhà cung cấp' });

    const { name, phone, email, address, tax_code, contact_person, status } = req.body;
    await supplier.update({ name, phone, email, address, tax_code, contact_person, status });

    res.json({ success: true, message: 'Cập nhật nhà cung cấp thành công', supplier });
  } catch (error) {
    console.error('updateSupplier error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật nhà cung cấp', error: error.message });
  }
};

/**
 * DELETE /api/pharmacy/suppliers/:id
 * Chỉ cho phép xóa nếu chưa có lô thuốc nào liên kết
 */
exports.deleteSupplier = async (req, res) => {
  try {
    const { Supplier, MedicineBatch } = getModels();
    if (!Supplier) return res.status(400).json({ success: false, message: 'Module nhà cung cấp chưa được khởi tạo' });

    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Không tìm thấy nhà cung cấp' });

    // Kiểm tra còn lô thuốc liên kết không
    if (MedicineBatch) {
      const linkedBatches = await MedicineBatch.count({ where: { supplier_id: req.params.id } });
      if (linkedBatches > 0) {
        return res.status(400).json({
          success: false,
          message: `Không thể xóa. Nhà cung cấp này đang liên kết với ${linkedBatches} lô thuốc. Hãy đổi sang trạng thái "Ngừng hoạt động" thay vì xóa.`
        });
      }
    }

    await supplier.destroy();
    res.json({ success: true, message: 'Đã xóa nhà cung cấp' });
  } catch (error) {
    console.error('deleteSupplier error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa nhà cung cấp', error: error.message });
  }
};