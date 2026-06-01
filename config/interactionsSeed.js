// server/config/interactionsSeed.js
// Hàm seed dữ liệu cho bảng Interactions
module.exports = async function seedInteractions(models, transaction, context = {}) {
  const users = context.users;
  const articles = context.articles;
  if (!users || !articles) throw new Error('interactionsSeed requires users and articles');

  await models.Interaction.bulkCreate([
    { user_id: users[0].id, interaction_type: 'view', content_type: 'article', entity_id: articles[0].id, created_at: new Date() },
    { user_id: users[1].id, interaction_type: 'like', content_type: 'article', entity_id: articles[1].id, created_at: new Date() }
  ], { transaction });

  return true;
};