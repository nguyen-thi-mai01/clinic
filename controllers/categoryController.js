// ============================================
// server/controllers/categoryController.js
// Controller quản lý danh mục và các trường quảng cáo động
// ============================================

const { models } = require('../config/db');
const { Op } = require('sequelize');
const slugify = require('slugify');

const CATEGORY_TYPES = {
  TIN_TUC: 'tin_tuc',
  THUOC: 'thuoc',
  BENH_LY: 'benh_ly'
};

const CATEGORY_TYPE_LABELS = {
  'tin_tuc': 'Tin tức',
  'thuoc': 'Thuốc',
  'benh_ly': 'Bệnh lý'
};

// 1. Lấy tất cả danh mục
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await models.Category.findAll({
      order: [
        ['category_type', 'ASC'],
        ['name', 'ASC']
      ],
      raw: true
    });

    const categoriesWithLabel = categories.map(cat => ({
      ...cat,
      category_type_label: CATEGORY_TYPE_LABELS[cat.category_type] || cat.category_type
    }));

    res.status(200).json({
      success: true,
      count: categories.length,
      categories: categoriesWithLabel
    });
  } catch (error) {
    console.error('ERROR trong getAllCategories:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách danh mục',
      error: error.message
    });
  }
};

// 2. Lấy danh mục theo loại (tin_tuc, thuoc, benh_ly)
exports.getCategoriesByType = async (req, res) => {
  try {
    const { type } = req.params;
    const categories = await models.Category.findAll({
      where: { category_type: type },
      order: [['name', 'ASC']]
    });

    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh mục theo loại',
      error: error.message
    });
  }
};

// 3. Lấy chi tiết một danh mục
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await models.Category.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy danh mục'
      });
    }

    res.status(200).json({
      success: true,
      category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết danh mục',
      error: error.message
    });
  }
};

// 4. Lấy danh sách các loại danh mục (ENUM)
exports.getCategoryTypes = async (req, res) => {
  try {
    const types = Object.entries(CATEGORY_TYPE_LABELS).map(([value, label]) => ({
      value,
      label
    }));

    res.status(200).json({
      success: true,
      types
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách loại danh mục'
    });
  }
};

// 5. Lấy danh mục theo Slug
exports.getCategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await models.Category.findOne({
      where: { slug }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy danh mục'
      });
    }

    res.status(200).json({
      success: true,
      category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tìm danh mục theo slug'
    });
  }
};

// 6. Tạo danh mục mới (Bao gồm các trường quảng cáo)
exports.createCategory = async (req, res) => {
  try {
    const { 
      name, 
      category_type, 
      description, 
      slug,
      banner_image_url,
      banner_target_link,
      sidebar_ad_image_url,
      sidebar_ad_target_link 
    } = req.body;

    if (!name || !category_type) {
      return res.status(400).json({
        success: false,
        message: 'Tên danh mục và loại là bắt buộc'
      });
    }

    const finalSlug = slug || slugify(name, { lower: true, strict: true });

    const existing = await models.Category.findOne({ where: { slug: finalSlug } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Slug đã tồn tại, vui lòng chọn tên khác'
      });
    }

    const category = await models.Category.create({
      name,
      category_type,
      description,
      slug: finalSlug,
      banner_image_url,
      banner_target_link,
      sidebar_ad_image_url,
      sidebar_ad_target_link
    });

    res.status(201).json({
      success: true,
      message: 'Tạo danh mục thành công',
      category
    });
  } catch (error) {
    console.error('ERROR trong createCategory:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo danh mục',
      error: error.message
    });
  }
};

// 7. Cập nhật danh mục (Bao gồm các trường quảng cáo)
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      category_type, 
      slug, 
      description,
      banner_image_url,
      banner_target_link,
      sidebar_ad_image_url,
      sidebar_ad_target_link 
    } = req.body;

    const category = await models.Category.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy danh mục'
      });
    }

    if (name) category.name = name;
    if (category_type) category.category_type = category_type;
    if (slug) category.slug = slug;
    if (description !== undefined) category.description = description;
    
    // Cập nhật các trường quảng cáo mới
    if (banner_image_url !== undefined) category.banner_image_url = banner_image_url;
    if (banner_target_link !== undefined) category.banner_target_link = banner_target_link;
    if (sidebar_ad_image_url !== undefined) category.sidebar_ad_image_url = sidebar_ad_image_url;
    if (sidebar_ad_target_link !== undefined) category.sidebar_ad_target_link = sidebar_ad_target_link;

    await category.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật danh mục thành công',
      category: {
        ...category.toJSON(),
        category_type_label: CATEGORY_TYPE_LABELS[category.category_type]
      }
    });
  } catch (error) {
    console.error('ERROR trong updateCategory:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật danh mục',
      error: error.message
    });
  }
};

// 8. Xóa danh mục (Có kiểm tra bài viết liên quan)
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await models.Category.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy danh mục'
      });
    }

    const articleCount = await models.Article.count({
      where: { category_id: id }
    });

    if (articleCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa. Có ${articleCount} bài viết trong danh mục này. Vui lòng chuyển hoặc xóa bài viết trước.`
      });
    }

    await category.destroy();

    res.status(200).json({
      success: true,
      message: 'Xóa danh mục thành công'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa danh mục',
      error: error.message
    });
  }
};

// Cập nhật hàng loạt quảng cáo cho các danh mục
exports.bulkUpdateAds = async (req, res) => {
  try {
    const { 
      banner_image_url, banner_target_link, 
      sidebar_ad_image_url, sidebar_ad_target_link, 
      overwrite_all 
    } = req.body;

    const categories = await models.Category.findAll();
    let updatedCount = 0;

    for (let cat of categories) {
      let needsUpdate = false;

      // Xử lý Banner ngang
      if (banner_image_url && (overwrite_all || !cat.banner_image_url)) {
        cat.banner_image_url = banner_image_url;
        cat.banner_target_link = banner_target_link;
        needsUpdate = true;
      }

      // Xử lý Sidebar Ad
      if (sidebar_ad_image_url && (overwrite_all || !cat.sidebar_ad_image_url)) {
        cat.sidebar_ad_image_url = sidebar_ad_image_url;
        cat.sidebar_ad_target_link = sidebar_ad_target_link;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await cat.save();
        updatedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Đã cập nhật hàng loạt quảng cáo cho ${updatedCount} danh mục.`
    });
  } catch (error) {
    console.error('ERROR trong bulkUpdateAds:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật hàng loạt',
      error: error.message
    });
  }
};