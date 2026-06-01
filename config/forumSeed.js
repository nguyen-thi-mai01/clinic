// server/config/forumSeed.js
// Seed data for forum: questions, answers, interactions (likes/comments), nested comments
module.exports = async function seedForum(models, transaction) {
  const Question = models.Question;
  const Answer = models.Answer;
  const Interaction = models.Interaction;
  const User = models.User;
  const Specialty = models.Specialty;
  const Topic = models.Topic;

  const users = await User.findAll({ transaction });
  if (!users.length) return [];

  const patients = users.filter(u => u.role === 'patient');
  const doctors = users.filter(u => u.role === 'doctor');
  const admins = users.filter(u => u.role === 'admin');
  const allAuthors = patients.concat(doctors).concat(admins).slice(0, 100);

  const specialties = await Specialty.findAll({ transaction });
  const topics = await Topic.findAll({ transaction });
  
  if (!topics.length) {
    console.warn('⚠️  No topics found! Please seed topics first.');
    return [];
  }

  const makeTitle = (i) => `Câu hỏi mẫu số ${i}: Hỏi về triệu chứng và điều trị`;
  const makeContent = (i) => `Nội dung chi tiết cho câu hỏi mẫu ${i}. Tôi có triệu chứng A, B, C và muốn hỏi bác sĩ nên làm gì. Thêm thông tin lâm sàng, tiền sử và điều trị đã thử.`;

  const createdQuestions = [];

  for (let i = 1; i <= 20; i++) {
    const author = allAuthors[Math.floor(Math.random() * allAuthors.length)];
    const specialty = specialties.length ? specialties[Math.floor(Math.random() * specialties.length)] : null;
    const topic = topics[Math.floor(Math.random() * topics.length)]; // Random topic

    const q = await Question.create({
      topicId: topic.id, // BẮT BUỘC!
      title: makeTitle(i),
      content: makeContent(i),
      authorId: author ? author.id : null,
      specialtyId: specialty ? specialty.id : null,
      tags: ['hỏi đáp','khẩn cấp','tư vấn'],
      images: [],
      status: 'approved', // Seed questions are pre-approved (đã duyệt, có câu trả lời)
      approvedAt: new Date(),
      approvedBy: admins.length ? admins[0].id : null
    }, { transaction });

    createdQuestions.push(q);

    // Create answers (2-4)
    const answerCount = 2 + Math.floor(Math.random() * 3);
    const answers = [];
    for (let a = 0; a < answerCount; a++) {
      const ansAuthor = doctors.length ? doctors[Math.floor(Math.random() * doctors.length)] : allAuthors[Math.floor(Math.random() * allAuthors.length)];
      const answer = await Answer.create({
        questionId: q.id,
        authorId: ansAuthor.id,
        content: `Trả lời mẫu ${a+1} cho câu hỏi ${i}. Gợi ý: kiểm tra thêm X, làm Y.`,
        isPinned: false,
        isVerified: ansAuthor.role === 'doctor'
      }, { transaction });
      answers.push(answer);
    }

    // Create interactions: likes and comments (5-10 total interactions)
    const interactionCount = 5 + Math.floor(Math.random() * 6); // 5..10
    const usedUserIds = new Set();
    const commentInteractionIds = [];

    for (let k = 0; k < interactionCount; k++) {
      const user = users[Math.floor(Math.random() * users.length)];
      if (!user) continue;
      // randomly decide like or comment
      const isLike = Math.random() < 0.6; // more likes
      if (isLike) {
        // avoid duplicate likes by same user for question (also check DB)
        if (usedUserIds.has(user.id)) continue;
        usedUserIds.add(user.id);
        try {
          const exists = await Interaction.findOne({ where: { user_id: user.id, entity_type: 'question', entity_id: q.id, interaction_type: 'like' }, transaction });
          if (exists) continue;
          await Interaction.create({
            user_id: user.id,
            entity_type: 'question',
            entity_id: q.id,
            interaction_type: 'like',
            metadata_json: null
          }, { transaction });
        } catch (err) {
          // ignore unique constraint errors and continue
          continue;
        }
      } else {
        // comment - ensure the same user hasn't already commented (unique index)
        try {
          const exists = await Interaction.findOne({ where: { user_id: user.id, entity_type: 'question', entity_id: q.id, interaction_type: 'comment' }, transaction });
          if (exists) continue;
          const comment = await Interaction.create({
            user_id: user.id,
            entity_type: 'question',
            entity_id: q.id,
            interaction_type: 'comment',
            metadata_json: { text: `Bình luận mẫu của user ${user.id} cho câu hỏi ${i}` }
          }, { transaction });
          commentInteractionIds.push(comment.id);

          // possibly add a nested reply to this comment
          if (Math.random() < 0.5) {
            const replier = users[Math.floor(Math.random() * users.length)];
            try {
              const existsReply = await Interaction.findOne({ where: { user_id: replier.id, entity_type: 'question', entity_id: q.id, interaction_type: 'comment' }, transaction });
              if (!existsReply) {
                await Interaction.create({
                  user_id: replier.id,
                  entity_type: 'question',
                  entity_id: q.id,
                  interaction_type: 'comment',
                  metadata_json: { text: `Reply cho comment ${comment.id}`, reply_to: comment.id }
                }, { transaction });
              }
            } catch (err) {
              // ignore
            }
          }
        } catch (err) {
          // ignore unique constraint errors and continue
          continue;
        }
      }
    }

    // Add likes to some answers as well
    for (const ans of answers) {
      const likeCount = 1 + Math.floor(Math.random() * 4);
      const picked = [];
      for (let L = 0; L < likeCount; L++) {
        const liker = users[Math.floor(Math.random() * users.length)];
        if (!liker) continue;
        if (picked.includes(liker.id)) continue;
        picked.push(liker.id);
        try {
          await Interaction.create({
            user_id: liker.id,
            entity_type: 'answer',
            entity_id: ans.id,
            interaction_type: 'like'
          }, { transaction });
        } catch (err) {
          // ignore
        }
      }
    }

    // Update counters on question (simple approach)
    const likes = await Interaction.count({ where: { entity_type: 'question', entity_id: q.id, interaction_type: 'like' }, transaction });
    const answersCount = await Answer.count({ where: { questionId: q.id }, transaction });
    await q.update({ likesCount: likes, answersCount }, { transaction });
  }

  console.log('Forum seed: created', createdQuestions.length, 'questions');
  return createdQuestions;
};
