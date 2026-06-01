// server/config/articleCommentsSeed.js
// Hàm seed dữ liệu cho bảng ArticleComment
module.exports = async function seedArticleComments(models, transaction, context = {}) {
  const articles = context.articles;
  const users = context.users;
  if (!articles || !users) throw new Error('articleCommentsSeed requires articles and users');

  await models.ArticleComment.bulkCreate([
    { article_id: articles[0].id, user_id: users[0].id, comment_text: 'Bài viết hay', created_at: new Date(), updated_at: new Date() },
    { article_id: articles[1].id, user_id: users[1].id, comment_text: 'Cảm ơn tác giả', created_at: new Date(), updated_at: new Date() }
  ], { transaction });

  return true;
};