// server/controllers/serviceCategoryController.js
const { models } = require('../config/db');

/**
 * @desc    Lấy tất cả danh mục dịch vụ (cho trang quản trị)
 * @route   GET /api/service-categories/admin/all
 * @access  Private/Admin
 */
exports.getServiceCategoriesForAdmin = async (req, res) => {
  try {
    const categories = await models.ServiceCategory.findAll({
      order: [['created_at', 'DESC']],
      include: [{
        model: models.Service,
        as: 'services',
        attributes: ['id'] // Chỉ cần lấy ID để đếm số lượng
      }]
    });

    // Định dạng lại dữ liệu trả về, thêm thuộc tính serviceCount
    const formattedCategories = categories.map(cat => ({
        ...cat.toJSON(),
        serviceCount: cat.services?.length || 0,
        services: undefined // Xóa mảng services thừa
    }));

    res.status(200).json({ success: true, data: formattedCategories });
  } catch (error) {
    console.error('ERROR in getServiceCategoriesForAdmin:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh mục dịch vụ.' });
  }
};

/**
 * @desc    Lấy tất cả danh mục dịch vụ đang hoạt động (cho trang public)
 * @route   GET /api/service-categories
 * @access  Public
 */
exports.getPublicServiceCategories = async (req, res) => {
    try {
      const categories = await models.ServiceCategory.findAll({
        where: { is_active: true },
        attributes: ['id', 'name', 'slug', 'description', 'image_url'],
        order: [['name', 'ASC']],
      });
      res.status(200).json({ success: true, data: categories });
    } catch (error)
 {
      console.error('Error in getPublicServiceCategories:', error);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh mục công khai.' });
    }
  };

/**
 * @desc    Lấy chi tiết một danh mục theo slug và các dịch vụ con (cho trang public)
 * @route   GET /api/service-categories/slug/:slug
 * @access  Public
 */
exports.getPublicCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await models.ServiceCategory.findOne({
      where: { slug: slug, is_active: true },
      include: [{
        model: models.Service,
        as: 'services',
        where: { status: 'active' },
        required: false // Lấy danh mục ngay cả khi không có dịch vụ nào
      }]
    });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục dịch vụ.' });
    }

    res.status(200).json({ success: true, data: category });
  } catch (error) {
    console.error('ERROR in getPublicCategoryBySlug:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy chi tiết danh mục.' });
  }
};

/**
 * @desc    ✅ Lấy chi tiết một danh mục theo ID (cho trang admin, ví dụ: edit form)
 * @route   GET /api/service-categories/:id
 * @access  Private/Admin
 */
exports.getServiceCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await models.ServiceCategory.findByPk(id);

        if (!category) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục dịch vụ.' });
        }
        res.status(200).json({ success: true, data: category });
    } catch (error) {
        console.error('ERROR in getServiceCategoryById:', error);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
    }
};

/**
 * @desc    Tạo danh mục dịch vụ mới
 * @route   POST /api/service-categories
 * @access  Private/Admin
 */
exports.createServiceCategory = async (req, res) => {
  const { name, description, image_url, is_active } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Tên danh mục là bắt buộc.' });
  }
  try {
    const newCategory = await models.ServiceCategory.create({ name, description, image_url, is_active });
    res.status(201).json({ success: true, data: newCategory, message: 'Tạo danh mục thành công!' });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ success: false, message: 'Tên hoặc slug của danh mục đã tồn tại.' });
    }
    console.error('ERROR in createServiceCategory:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo danh mục.' });
  }
};

/**
 * @desc    Cập nhật danh mục dịch vụ
 * @route   PUT /api/service-categories/:id
 * @access  Private/Admin
 */
exports.updateServiceCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await models.ServiceCategory.findByPk(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
    }
    await category.update(req.body);
    res.status(200).json({ success: true, data: category, message: 'Cập nhật danh mục thành công!' });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ success: false, message: 'Tên hoặc slug của danh mục đã tồn tại.' });
    }
    console.error('ERROR in updateServiceCategory:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật danh mục.' });
  }
};

/**
 * @desc    Xóa danh mục dịch vụ
 * @route   DELETE /api/service-categories/:id
 * @access  Private/Admin
 */
exports.deleteServiceCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await models.ServiceCategory.findByPk(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
    }

    // Kiểm tra ràng buộc logic theo bản thiết kế
    const serviceCount = await models.Service.count({ where: { category_id: id } });
    if (serviceCount > 0) {
        return res.status(400).json({
            success: false,
            message: `Không thể xóa. Vui lòng di chuyển hoặc xóa ${serviceCount} dịch vụ khỏi danh mục này trước.`
        });
    }

    await category.destroy();
    res.status(200).json({ success: true, message: 'Xóa danh mục thành công.' });
  } catch (error) {
    console.error('ERROR in deleteServiceCategory:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa danh mục.' });
  }
};