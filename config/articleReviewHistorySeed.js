// server/config/articleReviewHistorySeed.js
// Hàm seed dữ liệu cho bảng ArticleReviewHistory
module.exports = async function seedArticleReviewHistory(models, transaction, context = {}) {
  const articles = context.articles;
  const admins = context.admins;
  const staffs = context.staffs;
  if (!articles || !admins || !staffs) throw new Error('articleReviewHistorySeed requires articles, admins, staffs');

  await models.ArticleReviewHistory.bulkCreate([
    { article_id: articles[0].id, reviewer_id: admins[0].user_id, author_id: staffs[0].user_id, action: 'approve', comments: 'Bài viết tốt', new_status: 'approved', created_at: new Date() },
    { article_id: articles[1].id, reviewer_id: admins[1].user_id, author_id: staffs[1].user_id, action: 'approve', comments: 'Cần chỉnh sửa', new_status: 'approved', created_at: new Date() }
  ], { transaction });

  return true;
};