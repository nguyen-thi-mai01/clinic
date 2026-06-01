// server/controllers/forumController.js
// Minimal placeholder controller to ensure route handlers are functions.
// Replace these with real implementations as you develop the forum features.
const { models, sequelize } = require('../config/db');
const { Op } = require('sequelize');

// KHÔNG destructure Staff ở đây - sẽ gây lỗi timing
// const { Staff } = models; // ❌ XÓA DÒNG NÀY

// Helper: simple 501 placeholder for unimplemented endpoints
const notImplemented = (name) => async (req, res, next) => {
	try {
		res.status(501).json({ success: false, message: `${name} not implemented yet` });
	} catch (err) {
		next(err);
	}
};

// Implemented: getPublicQuestions (used by frontend)
const getPublicQuestions = async (req, res, next) => {
	try {
		const page = Math.max(1, parseInt(req.query.page) || 1);
		const limit = Math.min(100, parseInt(req.query.limit) || 10);
		const offset = (page - 1) * limit;
		const search = (req.query.search || '').trim();
		const specialty = req.query.specialty; // numeric id or empty
		const tags = (req.query.tags || '').split(',').map(t => t.trim()).filter(Boolean);

		// ✅ FIX: Lọc câu hỏi đã duyệt (approved) thay vì closed
		const where = { status: 'approved' };

		if (search) {
			where[Op.or] = [
				{ title: { [Op.like]: `%${search}%` } },
				{ content: { [Op.like]: `%${search}%` } }
			];
		}

		if (specialty) {
			const spId = parseInt(specialty);
			if (!isNaN(spId)) where.specialtyId = spId;
		}

		if (tags.length > 0) {
			// tags stored as JSON array; do a simple string match for now
			where.tags = { [Op.like]: `%${tags[0]}%` };
		}

		const result = await models.Question.findAndCountAll({
			where,
			include: [
				{ model: models.User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] },
				{ model: models.Specialty, as: 'specialty', attributes: ['id', 'name', 'slug'] },
				{ model: models.Topic, as: 'topic', attributes: ['id', 'title'] } // ✅ Thêm Topic
			],
			order: [['created_at', 'DESC']],
			limit,
			offset
		});

		const questions = result.rows.map(q => ({
			id: q.id,
			title: q.title,
			content: q.content,
			topicId: q.topicId, // ✅ Thêm topicId để client-side filter
			topic: q.topic ? { id: q.topic.id, title: q.topic.title } : null, // ✅ Thêm topic info
			author: q.author ? { id: q.author.id, full_name: q.author.full_name, avatar_url: q.author.avatar_url } : null,
			specialty: q.specialty ? { id: q.specialty.id, name: q.specialty.name, slug: q.specialty.slug } : null,
			tags: q.tags || [],
			images: q.images || [],
			viewsCount: q.viewsCount,
			views: q.viewsCount,
			answersCount: q.answersCount,
			answerCount: q.answersCount,
			likesCount: q.likesCount,
			created_at: q.created_at,
			createdAt: q.created_at // ✅ Thêm alias cho frontend
		}));

		res.json({
			success: true,
			data: {
				questions,
				total: result.count,
				page,
				limit
			}
		});
	} catch (error) {
		next(error);
	}
};

// ✅ Lấy danh sách câu hỏi đã lưu của user
const getSavedQuestions = async (req, res, next) => {
	try {
		if (!req.user || !req.user.id) {
			return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
		}

		// Lấy tất cả interactions type=save của user
		const interactions = await models.Interaction.findAll({
			where: {
				user_id: req.user.id,
				entity_type: 'question',
				interaction_type: 'save'
			},
			order: [['created_at', 'DESC']]
		});

		const questionIds = interactions.map(i => i.entity_id);

		if (questionIds.length === 0) {
			return res.json({
				success: true,
				data: {
					questions: [],
					total: 0
				}
			});
		}

		// Lấy thông tin chi tiết câu hỏi
		const questions = await models.Question.findAll({
			where: {
				id: { [Op.in]: questionIds },
				status: { [Op.in]: ['pending', 'approved'] } // Không lấy rejected/hidden
			},
			include: [
				{ model: models.User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] },
				{ model: models.Specialty, as: 'specialty', attributes: ['id', 'name'] },
				{ model: models.Topic, as: 'topic', attributes: ['id', 'title'] }
			],
			order: [['created_at', 'DESC']]
		});

		res.json({
			success: true,
			data: {
				questions,
				total: questions.length
			}
		});
	} catch (error) {
		next(error);
	}
};

// ✅ Lấy danh sách câu hỏi đã thích của user
const getLikedQuestions = async (req, res, next) => {
	try {
		if (!req.user || !req.user.id) {
			return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
		}

		const interactions = await models.Interaction.findAll({
			where: {
				user_id: req.user.id,
				entity_type: 'question',
				interaction_type: 'like'
			},
			order: [['created_at', 'DESC']]
		});

		const questionIds = interactions.map(i => i.entity_id);

		if (questionIds.length === 0) {
			return res.json({
				success: true,
				data: {
					questions: [],
					total: 0
				}
			});
		}

		const questions = await models.Question.findAll({
			where: {
				id: { [Op.in]: questionIds },
				status: { [Op.in]: ['pending', 'approved'] }
			},
			include: [
				{ model: models.User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] },
				{ model: models.Specialty, as: 'specialty', attributes: ['id', 'name'] },
				{ model: models.Topic, as: 'topic', attributes: ['id', 'title'] }
			],
			order: [['created_at', 'DESC']]
		});

		res.json({
			success: true,
			data: {
				questions,
				total: questions.length
			}
		});
	} catch (error) {
		next(error);
	}
};

// ✅ Lấy danh sách câu hỏi mà user đã trả lời
const getMyAnsweredQuestions = async (req, res, next) => {
	try {
		if (!req.user || !req.user.id) {
			return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
		}

		// Lấy tất cả câu trả lời của user
		const answers = await models.Answer.findAll({
			where: {
				authorId: req.user.id,
				isDeleted: false
			},
			attributes: ['questionId'],
			raw: true
		});

		// Lấy unique questionIds
		const questionIds = [...new Set(answers.map(a => a.questionId))];

		if (questionIds.length === 0) {
			return res.json({
				success: true,
				data: {
					questions: [],
					total: 0
				}
			});
		}

		// Lấy thông tin chi tiết câu hỏi
		const questions = await models.Question.findAll({
			where: {
				id: { [Op.in]: questionIds },
				status: { [Op.in]: ['pending', 'approved'] }
			},
			include: [
				{ model: models.User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] },
				{ model: models.Specialty, as: 'specialty', attributes: ['id', 'name'] },
				{ model: models.Topic, as: 'topic', attributes: ['id', 'title'] }
			],
			order: [['created_at', 'DESC']]
		});

		res.json({
			success: true,
			data: {
				questions,
				total: questions.length
			}
		});
	} catch (error) {
		next(error);
	}
};

// ✅ Get Forum Overview Stats
const getForumOverview = async (req, res, next) => {
	try {
		const [
			totalQuestions,
			pendingQuestions,
			rejectedQuestions,
			totalAnswers,
			topicCount,
			statusRows,
			topTopics,
			recentQuestions,
			unansweredQuestions
		] = await Promise.all([
			models.Question.count(),
			models.Question.count({ where: { status: 'pending' } }),
			models.Question.count({ where: { status: 'rejected' } }),
			models.Answer.count({ where: { isDeleted: false } }),
			models.Question.count({
				where: {
					status: 'approved',
					topicId: { [Op.ne]: null }
				},
				distinct: true,
				col: 'topicId'
			}),
			models.Question.findAll({
				attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
				group: ['status'],
				raw: true
			}),
			models.Question.findAll({
				where: { status: 'approved', topicId: { [Op.ne]: null } },
				attributes: ['topicId', [sequelize.fn('COUNT', sequelize.col('Question.id')), 'count']],
				include: [{ model: models.Topic, as: 'topic', attributes: ['id', 'title', 'slug'] }],
				group: ['topicId', 'topic.id'],
				order: [[sequelize.literal('count'), 'DESC']],
				limit: 5
			}),
			models.Question.findAll({
				where: { status: 'approved' },
				include: [
					{ model: models.User, as: 'author', attributes: ['id', 'full_name'] },
					{ model: models.Topic, as: 'topic', attributes: ['id', 'title', 'slug'] }
				],
				order: [['created_at', 'DESC']],
				limit: 5
			}),
			models.Question.count({ where: { status: 'approved', [Op.or]: [{ answersCount: 0 }, { answersCount: null }] } })
		]);

		const statusCounts = statusRows.reduce((accumulator, row) => {
			accumulator[row.status] = Number(row.count || 0);
			return accumulator;
		}, {});

		const safeTopTopics = topTopics.map((item) => ({
			id: item.topic?.id || item.topicId,
			title: item.topic?.title || 'Chủ đề chưa đặt tên',
			slug: item.topic?.slug || null,
			count: Number(item.get?.('count') || item.dataValues?.count || 0)
		}));

		res.json({
			success: true,
			data: {
				totalQuestions,
				pendingQuestions,
				rejectedQuestions,
				totalAnswers,
				topicCount,
				statusCounts,
				topTopics: safeTopTopics,
				recentQuestions,
				unansweredQuestions
			}
		});
	} catch (error) {
		next(error);
	}
};

module.exports = {
	getPublicQuestions,
	getSavedQuestions,
	getLikedQuestions,
	getMyAnsweredQuestions,
		getForumOverview,
		getQuestionDetail: async (req, res, next) => {
			try {
				const id = parseInt(req.params.id);
				if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid question id' });

			const question = await models.Question.findByPk(id, {
				include: [
					{ model: models.User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] },
					{ model: models.Specialty, as: 'specialty', attributes: ['id', 'name', 'slug'] },
					{ model: models.Topic, as: 'topic', attributes: ['id', 'title', 'slug'] }
				]
			});				if (!question) return res.status(404).json({ success: false, message: 'Question not found' });

				// Load answers separately to control ordering and include authors
				const answers = await models.Answer.findAll({
					where: { questionId: id, isDeleted: false },
					include: [{ model: models.User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] }],
					order: [['created_at', 'ASC']]
				});

				// Track a unique view using Interaction model (count one per user or per IP)
				try {
					const whereView = { entity_type: 'question', entity_id: id, interaction_type: 'view' };
					if (req.user && req.user.id) {
						whereView.user_id = req.user.id;
					} else {
						// anonymous: track by ip address
						whereView.ip_address = req.ip || req.headers['x-forwarded-for'] || null;
					}

					const existingView = await models.Interaction.findOne({ where: whereView });
					if (!existingView) {
						await models.Interaction.create({
							user_id: req.user?.id || null,
							entity_type: 'question',
							entity_id: id,
							interaction_type: 'view',
							ip_address: req.ip || req.headers['x-forwarded-for'] || null,
							user_agent: req.headers['user-agent'] || null
						});
					}

					// Recalculate unique view count and save to question.viewsCount
					const uniqueViews = await models.Interaction.count({
						where: { entity_type: 'question', entity_id: id, interaction_type: 'view' }
					});
					question.viewsCount = uniqueViews;
					await question.save();

					// Broadcast view update to connected WS clients
					try {
						if (global.wsConnections) {
							const msg = JSON.stringify({
								type: 'forum_interaction',
								payload: {
									entity_type: 'question',
									entity_id: id,
									interaction_type: 'view',
									viewsCount: uniqueViews
								}
							});
							for (const [, ws] of global.wsConnections) {
								try {
									if (ws && ws.readyState === 1) ws.send(msg);
								} catch (e) {
									// ignore
								}
							}
						}
					} catch (e) {
						// ignore broadcast errors
					}
				} catch (err) {
					// ignore view tracking errors
				}

				// ✅ Check if user liked/saved this question
				let userLiked = false;
				let userSaved = false;
				if (req.user && req.user.id) {
					const likeInteraction = await models.Interaction.findOne({
						where: {
							user_id: req.user.id,
							entity_type: 'question',
							entity_id: id,
							interaction_type: 'like'
						}
					});
					userLiked = !!likeInteraction;

					const saveInteraction = await models.Interaction.findOne({
						where: {
							user_id: req.user.id,
							entity_type: 'question',
							entity_id: id,
							interaction_type: 'save'
						}
					});
					userSaved = !!saveInteraction;
				}

				// ✅ Check which answers user liked
				const userLikedAnswerIds = new Set();
				if (req.user && req.user.id && answers.length > 0) {
					const answerLikes = await models.Interaction.findAll({
						where: {
							user_id: req.user.id,
							entity_type: 'answer',
							entity_id: { [Op.in]: answers.map(a => a.id) },
							interaction_type: 'like'
						}
					});
					answerLikes.forEach(like => userLikedAnswerIds.add(like.entity_id));
				}

			// ✅ Xác định xem user có quyền xem tên thật không (admin, manager topic)
			let canSeeRealName = false;
			if (req.user && req.user.id) {
				// Admin luôn thấy
				if (req.user.role === 'admin') {
					canSeeRealName = true;
				}
				// Manager/Moderator của topic
				else if (question.topic && question.topic.moderatorIds && question.topic.moderatorIds.includes(req.user.id)) {
					canSeeRealName = true;
				}
				// Chính author
				else if (question.authorId === req.user.id) {
					canSeeRealName = true;
				}
			}

			// ✅ Format author data với anonymous handling
			let authorData = null;
			if (question.isAnonymous && !canSeeRealName) {
				authorData = {
					id: null,
					full_name: `Người dùng ẩn danh ${question.anonymousCode}`,
					avatar_url: null,
					isAnonymous: true
				};
			} else if (question.author) {
				authorData = {
					id: question.author.id,
					full_name: question.author.full_name,
					avatar_url: question.author.avatar_url,
					isAnonymous: question.isAnonymous,
					anonymousCode: question.isAnonymous ? question.anonymousCode : null
				};
			}

			const result = {
				id: question.id,
				title: question.title,
				content: question.content,
				author: authorData,
				specialty: question.specialty ? { id: question.specialty.id, name: question.specialty.name, slug: question.specialty.slug } : null,
				specialtyIds: question.specialtyIds || [],
				topic: question.topic ? { id: question.topic.id, title: question.topic.title, slug: question.topic.slug } : null,
				tags: question.tags || [],
				images: question.images || [],
				attachments: question.attachments || [],
				status: question.status,
				viewsCount: question.viewsCount,
				answerCount: answers.length,
				createdAt: question.created_at,
				liked: userLiked,
				saved: userSaved,
				likesCount: question.likesCount || 0,
				isAnonymous: question.isAnonymous,
				answers: answers.map(a => ({
					id: a.id,
					content: a.content,
					author: a.author ? { id: a.author.id, full_name: a.author.full_name, avatar_url: a.author.avatar_url } : null,
					isPinned: a.isPinned,
					isVerified: a.isVerified,
					likesCount: a.likesCount || 0,
					liked: userLikedAnswerIds.has(a.id),
					createdAt: a.created_at
				}))
			};				res.json({ success: true, data: result });
			} catch (error) {
				next(error);
			}
		},
		// Create a new question (authenticated or semi-authenticated via authenticateTokenBasic)
		createQuestion: async (req, res, next) => {
			try {
				// Require authenticated user (authenticateTokenBasic should set req.user)
				if (!req.user || !req.user.id) {
					return res.status(401).json({ success: false, message: 'Unauthorized' });
				}

			const { 
				title, 
				content, 
				topicId,
				specialtyIds = [], // Array of specialty IDs
				tags = [], 
				images = [], 
				attachments = [], // Array of file URLs
				isAnonymous = false 
			} = req.body;

			// Validate required fields
			if (!title || !content) {
				return res.status(400).json({ success: false, message: 'Title and content are required' });
			}

			if (!topicId) {
				return res.status(400).json({ success: false, message: 'Topic is required' });
			}

			// ✅ Lấy topic config để xác định status ban đầu
			const topic = await models.Topic.findByPk(topicId);
			if (!topic) {
				return res.status(404).json({ success: false, message: 'Topic not found' });
			}

			// ✅ Kiểm tra anonymous: Chỉ cho phép nếu topic requires approval
			if (isAnonymous && !topic.requiresApproval) {
				return res.status(400).json({ 
					success: false, 
					message: 'Anonymous questions are only allowed in topics that require approval' 
				});
			}

			// ✅ Tạo anonymous code nếu cần (5 ký tự random)
			let anonymousCode = null;
			if (isAnonymous) {
				const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
				anonymousCode = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
				
				// Đảm bảo unique
				let isUnique = false;
				let attempts = 0;
				while (!isUnique && attempts < 10) {
					const existing = await models.Question.findOne({ where: { anonymousCode } });
					if (!existing) {
						isUnique = true;
					} else {
						anonymousCode = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
						attempts++;
					}
				}
			}

			// ✅ Xác định initial status
			let initialStatus = 'pending'; // Mặc định chờ duyệt
			if (topic.autoApprove || !topic.requiresApproval) {
				initialStatus = 'approved';
			}

			// Validate attachments limit
			if (Array.isArray(attachments) && attachments.length > 5) {
				return res.status(400).json({ success: false, message: 'Maximum 5 attachments allowed' });
			}

			// ✅ Create question
			const question = await models.Question.create({
				title: title.trim(),
				content: content.trim(),
				topicId: topicId,
				authorId: req.user.id,
				specialtyIds: Array.isArray(specialtyIds) ? specialtyIds : [],
				tags: Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()).filter(Boolean),
				images: Array.isArray(images) ? images : [],
				attachments: Array.isArray(attachments) ? attachments : [],
				isAnonymous: isAnonymous,
				anonymousCode: anonymousCode,
				status: initialStatus,
				approvedAt: initialStatus === 'approved' ? new Date() : null
			});

			// 🔔 Nếu status = pending → Gửi thông báo cho moderators
			if (initialStatus === 'pending' && topic && topic.moderatorIds && topic.moderatorIds.length > 0) {
				// Tạo notification cho các moderator
				const notificationPromises = topic.moderatorIds.map(staffId => 
					models.Notification.create({
						userId: staffId,
						type: 'forum_approval_needed',
						title: 'Câu hỏi mới cần phê duyệt',
						message: `Câu hỏi "${question.title}" đang chờ duyệt${isAnonymous ? ' (Ẩn danh: ' + anonymousCode + ')' : ''}`,
						entityType: 'question',
						entityId: question.id,
						link: `/forum/questions/${question.id}`
					}).catch(err => console.error('Notification error for user', staffId, err))
				);
				await Promise.all(notificationPromises);
			}				res.status(201).json({ 
					success: true, 
					data: { 
						id: question.id,
						status: initialStatus,
						message: initialStatus === 'pending' ? 'Câu hỏi đang chờ duyệt' : 'Câu hỏi đã được đăng'
					} 
				});
			} catch (error) {
				next(error);
			}
		},
	createAnswer: notImplemented('createAnswer'),
	createAnswer: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Unauthorized' });
			const questionId = parseInt(req.params.id);
			if (isNaN(questionId)) return res.status(400).json({ success: false, message: 'Invalid question id' });
			const { content, isAnonymous = false } = req.body;
			if (!content || !content.trim()) return res.status(400).json({ success: false, message: 'Content is required' });

			const question = await models.Question.findByPk(questionId);
			if (!question) return res.status(404).json({ success: false, message: 'Question not found' });

			const answer = await models.Answer.create({
				questionId,
				authorId: req.user.id,
				content: content.trim(),
				isDeleted: false
			});

			// increment answers count on question
			try {
				await question.increment('answersCount');
			} catch (err) {
				// ignore
			}

			const created = await models.Answer.findByPk(answer.id, {
				include: [{ model: models.User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] }]
			});

			// Record comment interaction for history
			try {
				await models.Interaction.create({
					user_id: req.user.id,
					entity_type: 'answer',
					entity_id: created.id,
					interaction_type: 'comment',
					metadata_json: { preview: created.content.substring(0, 200) }
				});
			} catch (err) {
				// ignore interaction recording errors
			}

			// Broadcast new answer so list/detail UIs can update in real-time
			try {
				if (global.wsConnections) {
					const msg = JSON.stringify({
						type: 'forum_interaction',
						payload: {
							entity_type: 'question',
							entity_id: questionId,
							interaction_type: 'comment',
							answersCount: question.answersCount + 1,
							answer: {
								id: created.id,
								content: created.content,
								author: created.author ? { id: created.author.id, full_name: created.author.full_name, avatar_url: created.author.avatar_url } : null,
								created_at: created.created_at
							}
						}
					});
					for (const [, ws] of global.wsConnections) {
						try { if (ws && ws.readyState === 1) ws.send(msg); } catch (e) {}
					}
				}
			} catch (e) {}

			res.status(201).json({ success: true, data: created });
		} catch (error) {
			next(error);
		}
	},
		toggleLikeQuestion: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Unauthorized' });
			const id = parseInt(req.params.id);
			if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid question id' });

			const question = await models.Question.findByPk(id);
			if (!question) return res.status(404).json({ success: false, message: 'Question not found' });

			// Use Interaction to record likes per user (unique)
			const existing = await models.Interaction.findOne({
				where: { entity_type: 'question', entity_id: id, interaction_type: 'like', user_id: req.user.id }
			});
			let liked = false;
			if (existing) {
				await existing.destroy();
				liked = false;
			} else {
				await models.Interaction.create({
					user_id: req.user.id,
					entity_type: 'question',
					entity_id: id,
					interaction_type: 'like'
				});
				liked = true;
			}

			// Recalculate likesCount from interactions
			const likesCount = await models.Interaction.count({ where: { entity_type: 'question', entity_id: id, interaction_type: 'like' } });
			question.likesCount = likesCount;
			await question.save();

			// Broadcast like update
			try {
				if (global.wsConnections) {
					const msg = JSON.stringify({
						type: 'forum_interaction',
						payload: {
							entity_type: 'question',
							entity_id: id,
							interaction_type: 'like',
							likesCount
						}
					});
					for (const [, ws] of global.wsConnections) {
						try { if (ws && ws.readyState === 1) ws.send(msg); } catch (e) {}
					}
				}
			} catch (e) {}

			res.json({ success: true, data: { id: question.id, likesCount, liked } });
		} catch (error) {
			next(error);
		}
	},
		toggleLikeAnswer: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) return res.status(401).json({ success: false, message: 'Unauthorized' });
			const id = parseInt(req.params.id);
			if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid answer id' });

			const answer = await models.Answer.findByPk(id);
			if (!answer) return res.status(404).json({ success: false, message: 'Answer not found' });

			const existing = await models.Interaction.findOne({
				where: { entity_type: 'answer', entity_id: id, interaction_type: 'like', user_id: req.user.id }
			});
			let liked = false;
			if (existing) {
				await existing.destroy();
				liked = false;
			} else {
				await models.Interaction.create({
					user_id: req.user.id,
					entity_type: 'answer',
					entity_id: id,
					interaction_type: 'like'
				});
				liked = true;
			}

			const likesCount = await models.Interaction.count({ where: { entity_type: 'answer', entity_id: id, interaction_type: 'like' } });
			answer.likesCount = likesCount;
			await answer.save();

			// Broadcast answer like update
			try {
				if (global.wsConnections) {
					const msg = JSON.stringify({
						type: 'forum_interaction',
						payload: {
							entity_type: 'answer',
							entity_id: id,
							interaction_type: 'like',
							likesCount
						}
					});
					for (const [, ws] of global.wsConnections) {
						try { if (ws && ws.readyState === 1) ws.send(msg); } catch (e) {}
					}
				}
			} catch (e) {}

			res.json({ success: true, data: { id: answer.id, likesCount, liked } });
		} catch (error) {
			next(error);
		}
	},

	// ✅ Toggle Save Question (Bookmark)
	toggleSaveQuestion: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để lưu câu hỏi' });
			}

			const id = parseInt(req.params.id);
			if (isNaN(id)) {
				return res.status(400).json({ success: false, message: 'ID câu hỏi không hợp lệ' });
			}

			const question = await models.Question.findByPk(id);
			if (!question) {
				return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi' });
			}

			// Check if already saved
			const existing = await models.Interaction.findOne({
				where: { 
					entity_type: 'question', 
					entity_id: id, 
					interaction_type: 'save', 
					user_id: req.user.id 
				}
			});

			let saved = false;
			if (existing) {
				// Unsave
				await existing.destroy();
				saved = false;
			} else {
				// Save
				await models.Interaction.create({
					user_id: req.user.id,
					entity_type: 'question',
					entity_id: id,
					interaction_type: 'save'
				});
				saved = true;
			}

			// Update savesCount
			const savesCount = await models.Interaction.count({ 
				where: { entity_type: 'question', entity_id: id, interaction_type: 'save' } 
			});
			question.savesCount = savesCount;
			await question.save();

			res.json({ 
				success: true, 
				data: { 
					id: question.id, 
					savesCount, 
					saved 
				},
				message: saved ? 'Đã lưu câu hỏi' : 'Đã bỏ lưu câu hỏi'
			});
		} catch (error) {
			next(error);
		}
	},
	
	// ✅ Tạo báo cáo (User báo cáo câu hỏi/câu trả lời vi phạm)
	createReport: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để báo cáo' });
			}

			const { entityType, entityId, reason, description } = req.body;

			// Validate input
			if (!entityType || !entityId || !reason) {
				return res.status(400).json({ 
					success: false, 
					message: 'Thiếu thông tin: entityType, entityId, reason là bắt buộc' 
				});
			}

			const allowedEntityTypes = ['question', 'answer'];
			if (!allowedEntityTypes.includes(entityType)) {
				return res.status(400).json({ 
					success: false, 
					message: 'entityType phải là "question" hoặc "answer"' 
				});
			}

			const allowedReasons = ['spam', 'inappropriate', 'misleading', 'offensive', 'other'];
			if (!allowedReasons.includes(reason)) {
				return res.status(400).json({ 
					success: false, 
					message: 'Lý do không hợp lệ' 
				});
			}

			// Validate entity tồn tại
			if (entityType === 'question') {
				const question = await models.Question.findByPk(entityId);
				if (!question) {
					return res.status(404).json({ success: false, message: 'Câu hỏi không tồn tại' });
				}
			} else if (entityType === 'answer') {
				const answer = await models.Answer.findByPk(entityId);
				if (!answer) {
					return res.status(404).json({ success: false, message: 'Câu trả lời không tồn tại' });
				}
			}

			// Check xem user đã báo cáo entity này chưa
			const existingReport = await models.Report.findOne({
				where: {
					reporterId: req.user.id,
					entityType,
					entityId
				}
			});

			if (existingReport) {
				return res.status(400).json({ 
					success: false, 
					message: 'Bạn đã báo cáo nội dung này rồi' 
				});
			}

			// Tạo báo cáo mới
			const report = await models.Report.create({
				reporterId: req.user.id,
				entityType,
				entityId,
				reason,
				description: description || null,
				status: 'pending'
			});

			// TODO: Gửi notification cho moderators
			// Lấy topic của câu hỏi để thông báo cho moderators
			if (entityType === 'question') {
				const question = await models.Question.findByPk(entityId, {
					include: [{ model: models.Topic, as: 'topic' }]
				});
				
				if (question && question.topic && question.topic.moderatorIds) {
					const notificationPromises = question.topic.moderatorIds.map(modId =>
						models.Notification.create({
							userId: modId,
							type: 'forum_report',
							title: 'Báo cáo mới',
							message: `Có báo cáo mới về câu hỏi "${question.title}"`,
							entityType: 'report',
							entityId: report.id,
							link: `/forum/management?tab=reports`
						}).catch(err => console.error('Notification error:', err))
					);
					await Promise.all(notificationPromises);
				}
			}

			res.status(201).json({ 
				success: true, 
				message: 'Báo cáo đã được gửi. Chúng tôi sẽ xem xét trong thời gian sớm nhất.',
				data: report 
			});
		} catch (error) {
			next(error);
		}
	},
	
	// Admin: list all questions with filters (status, search, specialty)
	getAllQuestions: async (req, res, next) => {
						// Đảm bảo luôn có role_info cho staff
						if (req.user.role === 'staff' && !req.user.role_info) {
							const staffProfile = await models.Staff.findOne({ where: { user_id: req.user.id } });
							if (staffProfile) {
								req.user.role_info = {
									rank: staffProfile.rank,
									department: staffProfile.department,
									permissions: staffProfile.permissions
								};
							}
						}
			console.log('[Forum] getAllQuestions user:', req.user);
		try {
			const page = Math.max(1, parseInt(req.query.page) || 1);
			const limit = Math.min(200, parseInt(req.query.limit) || 50);
			const offset = (page - 1) * limit;
			const status = req.query.status; // 'open' | 'closed' | 'hidden'
			const search = (req.query.search || '').trim();
			const specialty = req.query.specialty;
			const authorId = req.query.authorId; // ✅ THÊM: Lọc theo authorId
			
			const where = {};
			// ✅ FIX: Chỉ filter khi status có giá trị thực sự
			if (status && status.trim() !== '') where.status = status;
			if (search) {
				where[Op.or] = [
					{ title: { [Op.like]: `%${search}%` } },
					{ content: { [Op.like]: `%${search}%` } }
				];
			}
			if (specialty) {
				const spId = parseInt(specialty);
				if (!isNaN(spId)) where.specialtyId = spId;
			}
			
			// ✅ THÊM: Lọc theo authorId nếu có
			if (authorId) {
				const aId = parseInt(authorId);
				if (!isNaN(aId)) where.authorId = aId;
			}
			
			// ✅ THÊM: Nếu là staff →
			if (req.user && req.user.role === 'staff') {
				const { rank, department, permissions } = req.user.role_info || {};
				
				// Kiểm tra xem có phải Manager hoặc Staff đã được cấp quyền quản lý diễn đàn không
				const isManager = rank === 'manager' && (department === 'support' || department === 'content');
				const hasForumPerms = permissions && permissions.forum && Array.isArray(permissions.forum) && permissions.forum.length > 0;

				if (isManager || hasForumPerms) {
					// Có quyền tổng -> Không filter topicId, xem mọi câu hỏi như Admin
				} else {
					// Lấy tất cả topics mà staff này là moderator (dành cho nhân viên không có quyền tổng)
					const allTopics = await models.Topic.findAll({
						attributes: ['id', 'moderatorIds']
					});
					const assignedTopicIds = allTopics
						.filter(topic => {
							const moderatorIds = topic.moderatorIds || [];
							return moderatorIds.includes(req.user.id);
						})
						.map(t => t.id);
					if (assignedTopicIds.length > 0) {
						where.topicId = { [Op.in]: assignedTopicIds };
					} else {
						// Staff không được phân công topic nào → Không thấy câu hỏi nào
						where.id = -1;
					}
				}
			}
			// Admin/Manager/Staff có quyền sẽ thấy tất cả
			
		const result = await models.Question.findAndCountAll({
			where,
			include: [
				{ model: models.User, as: 'author', attributes: ['id', 'username', 'full_name', 'email'] },
				{ model: models.Specialty, as: 'specialty', attributes: ['id', 'name'] },
				{ model: models.Topic, as: 'topic', attributes: ['id', 'title'] }
			],
			order: [['created_at', 'DESC']],
			limit,
			offset
		});
		
		const questions = result.rows.map(q => ({
			id: q.id,
			title: q.title,
			content: q.content,
			status: q.status,
			topicId: q.topicId,
			topic: q.topic ? { id: q.topic.id, title: q.topic.title } : null,
			author: q.author ? { id: q.author.id, username: q.author.username, full_name: q.author.full_name, email: q.author.email } : null,
			specialty: q.specialty ? { id: q.specialty.id, name: q.specialty.name } : null,
			created_at: q.created_at,
			answersCount: q.answersCount,
			likesCount: q.likesCount,
			images: q.images || []
		}));			res.json({ success: true, data: { questions, total: result.count, page, limit } });
		} catch (error) {
			next(error);
		}
	},
	updateQuestionStatus: notImplemented('updateQuestionStatus'),
	
	// ✅ Delete Question - Admin, Manager, hoặc Moderator của topic
	deleteQuestion: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Unauthorized' });
			}

			const id = parseInt(req.params.id);
			if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid question id' });

			const question = await models.Question.findByPk(id, {
				include: [{ model: models.Topic, as: 'topic' }]
			});
			if (!question) return res.status(404).json({ success: false, message: 'Question not found' });

			// ✅ Check permission: Admin, Manager, hoặc Staff được phân công
			let canDelete = req.user.role === 'admin';
			
			// Manager có full quyền
			if (!canDelete && req.user.role === 'staff' && req.user.role_info?.rank === 'manager') {
				canDelete = true;
			}
			
			if (!canDelete && req.user.role === 'staff') {
				// ✅ Staff chỉ được xóa nếu là moderator của topic này
				const topic = question.topic || await models.Topic.findByPk(question.topicId);
				if (topic && topic.moderatorIds && topic.moderatorIds.includes(req.user.id)) {
					canDelete = true;
				}
			}

			if (!canDelete) {
				return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa câu hỏi này' });
			}

			// Xóa question
			await question.destroy();

			res.json({ success: true, message: 'Câu hỏi đã được xóa' });
		} catch (error) {
			next(error);
		}
	},
	
	deleteAnswer: notImplemented('deleteAnswer'),
	togglePinAnswer: notImplemented('togglePinAnswer'),
	toggleVerifyAnswer: notImplemented('toggleVerifyAnswer'),
	getReports: notImplemented('getReports'),
	updateReport: notImplemented('updateReport'),

	// Admin & Content Staff: update question status (approve/reject)
	updateQuestionStatus: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Unauthorized' });
			}

			const id = parseInt(req.params.id);
			if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid question id' });

			const { status, reason } = req.body;
			const allowed = ['pending', 'approved', 'rejected', 'hidden'];
			if (!status || !allowed.includes(status)) {
				return res.status(400).json({ success: false, message: 'Invalid status value' });
			}

			const question = await models.Question.findByPk(id, {
				include: [{ model: models.Topic, as: 'topic' }]
			});
			if (!question) return res.status(404).json({ success: false, message: 'Question not found' });

			// ✅ Check permission: Admin, Manager, hoặc Staff được phân công
			let isAuthorized = req.user.role === 'admin';
			
			// Manager có full quyền
			if (!isAuthorized && req.user.role === 'staff' && req.user.role_info?.rank === 'manager') {
				isAuthorized = true;
			}
			
			if (!isAuthorized && req.user.role === 'staff') {
				// ✅ Staff chỉ được update status nếu là moderator của topic này
				const topic = question.topic || await models.Topic.findByPk(question.topicId);
				if (topic && topic.moderatorIds && topic.moderatorIds.includes(req.user.id)) {
					isAuthorized = true;
				}
			}

			if (!isAuthorized) {
				return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật câu hỏi này' });
			}

			// Update status based on value
			if (status === 'approved') {
				question.status = 'approved';
				question.approvedAt = new Date();
				question.approvedBy = req.user.id;
				question.rejectionReason = null;
			} else if (status === 'rejected') {
				question.status = 'rejected';
				question.rejectionReason = reason || 'Không phù hợp';
				question.approvedAt = null;
				question.approvedBy = null;
			} else if (status === 'hidden') {
				question.status = 'hidden';
				question.rejectionReason = reason || null;
			} else if (status === 'pending') {
				question.status = 'pending';
				question.rejectionReason = null;
				question.approvedAt = null;
				question.approvedBy = null;
			}

			await question.save();

			res.json({ success: true, data: { id: question.id, status: question.status } });
		} catch (error) {
			next(error);
		}
	},

	// Admin & Content Staff: bulk update question status by filter
	bulkUpdateQuestionStatus: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Unauthorized' });
			}

			//  Check authorization: Admin or Content Staff
			let isAuthorized = req.user.role === 'admin';
			if (!isAuthorized && req.user.role === 'staff') {
				const staffInfo = await models.Staff.findOne({ where: { user_id: req.user.id } });
				if (staffInfo && staffInfo.department === 'content') {
					isAuthorized = true;
				}
			}
			if (!isAuthorized) {
				return res.status(403).json({ success: false, message: 'Bạn không có quyền quản lý diễn đàn' });
			}

			const { status, reason, filterStatus, filterSpecialty, filterIds } = req.body;
			
			// status = target status to set
			const allowed = ['open', 'closed', 'hidden'];
			if (!status || !allowed.includes(status)) {
				return res.status(400).json({ success: false, message: 'Invalid target status value' });
			}

			// Build WHERE clause: either filterIds, or filter by filterStatus and filterSpecialty
			let where = {};
			if (filterIds && Array.isArray(filterIds) && filterIds.length > 0) {
				where.id = { [Op.in]: filterIds };
			} else {
				if (filterStatus) where.status = filterStatus;
				if (filterSpecialty) {
					const spId = parseInt(filterSpecialty);
					if (!isNaN(spId)) where.specialtyId = spId;
				}
			}

			// Find all matching questions
			const questions = await models.Question.findAll({ where });
			if (!questions.length) {
				return res.json({ success: true, message: 'No questions matched filters', updated: 0 });
			}

			// Update each question
			let updated = 0;
			for (const question of questions) {
				if (status === 'closed') {
					question.status = 'closed';
					question.approvedAt = new Date();
					question.approvedBy = req.user.id;
					question.rejectionReason = null;
				} else if (status === 'hidden') {
					question.status = 'hidden';
					question.rejectionReason = reason || null;
					question.approvedAt = null;
					question.approvedBy = null;
				} else if (status === 'open') {
					question.status = 'open';
					question.rejectionReason = null;
					question.approvedAt = null;
					question.approvedBy = null;
				}
				await question.save();
				updated++;
			}

			res.json({ success: true, message: `Updated ${updated} questions`, updated });
		} catch (error) {
			next(error);
		}
	},

	//  NEW: Approve question (Staff được phân công)
	approveQuestion: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Unauthorized' });
			}

			const questionId = parseInt(req.params.id);
			if (isNaN(questionId)) {
				return res.status(400).json({ success: false, message: 'Invalid question ID' });
			}

			const question = await models.Question.findByPk(questionId, {
				include: [{ model: models.Topic, as: 'topic' }]
			});
			if (!question) {
				return res.status(404).json({ success: false, message: 'Question not found' });
			}

			// ✅ Check permission: Admin, Manager, hoặc Staff được phân công làm moderator của topic này
			let canApprove = req.user.role === 'admin';
			
			// Manager (role_info.rank === 'manager') cũng có full quyền
			if (!canApprove && req.user.role === 'staff' && req.user.role_info?.rank === 'manager') {
				canApprove = true;
			}
			
			if (!canApprove && req.user.role === 'staff') {
				// ✅ Lấy topic để check moderatorIds
				const topic = question.topic || await models.Topic.findByPk(question.topicId);
				if (topic && topic.moderatorIds && topic.moderatorIds.includes(req.user.id)) {
					canApprove = true;
				}
			}

			if (!canApprove) {
				return res.status(403).json({ success: false, message: 'Bạn không có quyền duyệt câu hỏi này' });
			}

			// Update status
			question.status = 'approved';
			question.approvedAt = new Date();
			question.approvedBy = req.user.id;
			question.rejectionReason = null;
			await question.save();

			// Gửi thông báo cho tác giả
			if (question.authorId) {
				await models.Notification.create({
					userId: question.authorId,
					type: 'question_approved',
					title: 'Câu hỏi đã được duyệt',
					message: `Câu hỏi "${question.title}" của bạn đã được phê duyệt`,
					entityType: 'question',
					entityId: question.id,
					link: `/forum/questions/${question.id}`
				}).catch(err => console.error('Notification error:', err));
			}

			res.json({ success: true, message: 'Câu hỏi đã được duyệt', data: question });
		} catch (error) {
			next(error);
		}
	},

	//  NEW: Reject question
	rejectQuestion: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Unauthorized' });
			}

			const questionId = parseInt(req.params.id);
			const { reason } = req.body;

			if (isNaN(questionId)) {
				return res.status(400).json({ success: false, message: 'Invalid question ID' });
			}

			const question = await models.Question.findByPk(questionId, {
				include: [{ model: models.Topic, as: 'topic' }]
			});
			if (!question) {
				return res.status(404).json({ success: false, message: 'Question not found' });
			}

			// ✅ Check permission: Admin, Manager, hoặc Staff được phân công
			let canReject = req.user.role === 'admin';
			
			// Manager cũng có full quyền
			if (!canReject && req.user.role === 'staff' && req.user.role_info?.rank === 'manager') {
				canReject = true;
			}
			
			if (!canReject && req.user.role === 'staff') {
				// ✅ Lấy topic để check moderatorIds
				const topic = question.topic || await models.Topic.findByPk(question.topicId);
				if (topic && topic.moderatorIds && topic.moderatorIds.includes(req.user.id)) {
					canReject = true;
				}
			}

			if (!canReject) {
				return res.status(403).json({ success: false, message: 'Bạn không có quyền từ chối câu hỏi này' });
			}

			question.status = 'rejected';
			question.rejectionReason = reason || 'Không phù hợp';
			question.approvedAt = null;
			question.approvedBy = null;
			await question.save();

			// Thông báo cho tác giả
			if (question.authorId) {
				await models.Notification.create({
					userId: question.authorId,
					type: 'question_rejected',
					title: 'Câu hỏi bị từ chối',
					message: `Câu hỏi "${question.title}" của bạn bị từ chối. Lý do: ${reason || 'Không phù hợp'}`,
					entityType: 'question',
					entityId: question.id
				}).catch(err => console.error('Notification error:', err));
			}

			res.json({ success: true, message: 'Câu hỏi đã bị từ chối', data: question });
		} catch (error) {
			next(error);
		}
	},

	//  NEW: Get reports (Admin/Manager/Assigned Staff)
	getReports: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Unauthorized' });
			}

			const page = Math.max(1, parseInt(req.query.page) || 1);
			const limit = Math.min(100, parseInt(req.query.limit) || 20);
			const offset = (page - 1) * limit;
			const status = req.query.status; // 'pending', 'reviewed', 'resolved', 'dismissed'

			let whereCondition = {};
			// ✅ FIX: Chỉ filter khi status có giá trị thực sự (không phải chuỗi rỗng)
			if (status && status.trim() !== '') {
				whereCondition.status = status;
			}

			// Nếu là staff → Kiểm tra quyền
			if (req.user.role === 'staff') {
				const { rank, department, permissions } = req.user.role_info || {};
				const isManager = rank === 'manager' && (department === 'support' || department === 'content');
				const hasForumPerms = permissions && permissions.forum && Array.isArray(permissions.forum) && permissions.forum.length > 0;

				// NẾU KHÔNG CÓ QUYỀN TỔNG -> Mới chạy logic khóa dữ liệu theo Topic
				if (!(isManager || hasForumPerms)) {
					const allTopics = await models.Topic.findAll({
						attributes: ['id', 'moderatorIds']
					});
					
					// Filter topics mà staff này là moderator
					const assignedTopicIds = allTopics
						.filter(topic => {
							const moderatorIds = topic.moderatorIds || [];
							return moderatorIds.includes(req.user.id);
						})
						.map(t => t.id);

					if (assignedTopicIds.length > 0) {
						// Lấy questions thuộc các topics được phân công
						const assignedQuestions = await models.Question.findAll({
							where: {
								topicId: { [Op.in]: assignedTopicIds }
							},
							attributes: ['id']
						});
						const assignedQuestionIds = assignedQuestions.map(q => q.id);

						// Filter reports chỉ trong assigned questions
						if (assignedQuestionIds.length > 0) {
							whereCondition[Op.or] = [
								{ entityType: 'question', entityId: { [Op.in]: assignedQuestionIds } }
							];
						} else {
							// Không có question nào → trả về rỗng
							whereCondition.id = -1;
						}
					} else {
						// Staff không được phân công topic nào → trả về rỗng
						whereCondition.id = -1;
					}
				}
			}

			const result = await models.Report.findAndCountAll({
				where: whereCondition,
				include: [
					{ 
						model: models.User, 
						as: 'reporter', 
						attributes: ['id', 'full_name', 'avatar_url'] 
					}
				],
				order: [['created_at', 'DESC']],
				limit,
				offset
			});

			res.json({
				success: true,
				data: {
					reports: result.rows,
					total: result.count,
					page,
					limit
				}
			});
		} catch (error) {
			next(error);
		}
	},
	//  NEW: Handle report (Hide or Delete content)
	handleReport: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Unauthorized' });
			}

			const reportId = parseInt(req.params.id);
			const { action, adminNote } = req.body; // action: 'hide', 'delete', 'dismiss'

			if (isNaN(reportId)) {
				return res.status(400).json({ success: false, message: 'Invalid report ID' });
			}

			if (!['hide', 'delete', 'dismiss'].includes(action)) {
				return res.status(400).json({ success: false, message: 'Invalid action' });
			}

			const report = await models.Report.findByPk(reportId);
			if (!report) {
				return res.status(404).json({ success: false, message: 'Report not found' });
			}

			// Check permission: Admin hoặc staff được phân công
			let canHandle = req.user.role === 'admin';
			
			if (!canHandle && req.user.role === 'staff') {
				if (report.entityType === 'question') {
					const question = await models.Question.findByPk(report.entityId);
					if (question && question.moderatorIds && question.moderatorIds.includes(req.user.id)) {
						canHandle = true;
					}
				}
				// Thêm logic cho answer nếu cần
			}

			if (!canHandle) {
				return res.status(403).json({ success: false, message: 'Bạn không có quyền xử lý báo cáo này' });
			}

			// Thực hiện action
			if (action === 'hide') {
				if (report.entityType === 'question') {
					await models.Question.update(
						{ status: 'hidden' },
						{ where: { id: report.entityId } }
					);
				} else if (report.entityType === 'answer') {
					await models.Answer.update(
						{ isDeleted: true },
						{ where: { id: report.entityId } }
					);
				}
				report.status = 'resolved';
				report.adminNote = adminNote || 'Đã ẩn nội dung';
			} else if (action === 'delete') {
				if (report.entityType === 'question') {
					await models.Question.destroy({ where: { id: report.entityId } });
				} else if (report.entityType === 'answer') {
					await models.Answer.destroy({ where: { id: report.entityId } });
				}
				report.status = 'resolved';
				report.adminNote = adminNote || 'Đã xóa nội dung';
			} else if (action === 'dismiss') {
				report.status = 'dismissed';
				report.adminNote = adminNote || 'Báo cáo không phù hợp';
			}

			report.reviewedBy = req.user.id;
			report.reviewedAt = new Date();
			await report.save();

			res.json({ success: true, message: `Đã ${action === 'hide' ? 'ẩn' : action === 'delete' ? 'xóa' : 'bỏ qua'} nội dung`, data: report });
		} catch (error) {
			next(error);
		}
	},

	// ========== TOPIC MANAGEMENT ==========
	getTopics: async (req, res, next) => {
		try {
			const topics = await models.Topic.findAll({
				where: { isActive: true },
				order: [
					['display_order', 'ASC'],  // Dùng snake_case cho DB column
					['created_at', 'DESC']      // Dùng snake_case cho DB column
				]
			});

			res.json({
				success: true,
				data: topics
			});
		} catch (error) {
			console.error(' Error in getTopics:', error.message);
			next(error);
		}
	},

	//  NEW: Create/Update Topic (Cần quyền create_topic hoặc edit_topic)
	createOrUpdateTopic: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Unauthorized' });
			}

			const { id } = req.body; // Nếu có ID → Update, không có → Create
			
			// ✅ Routes đã check quyền rồi, không cần check lại ở đây

			const { 
				title, 
				description, 
				requiresApproval = true, 
				autoApprove = false,
				moderatorIds = [],
				isActive = true,
				icon = 'FaComments',
				color = '#3498db'
			} = req.body;

			if (!title || !title.trim()) {
				return res.status(400).json({ success: false, message: 'Title là bắt buộc' });
			}

			// Validate: Chỉ chọn 1 trong 2 (requiresApproval hoặc autoApprove)
			if (requiresApproval && autoApprove) {
				return res.status(400).json({ 
					success: false, 
					message: 'Không thể vừa yêu cầu phê duyệt vừa tự động duyệt. Chọn 1 trong 2.' 
				});
			}

			// Validate moderatorIds (max 2, chỉ từ phòng Content hoặc Support)
			if (moderatorIds.length > 2) {
				return res.status(400).json({ success: false, message: 'Tối đa 2 moderators cho 1 topic' });
			}

		// Validate moderators phải thuộc phòng Content hoặc Support
		if (moderatorIds.length > 0) {
			const moderators = await models.Staff.findAll({
				where: { 
					user_id: { [Op.in]: moderatorIds },
					department: { [Op.in]: ['content', 'support'] },
					work_status: 'active'
				}
			});

			if (moderators.length !== moderatorIds.length) {
				return res.status(400).json({ 
					success: false, 
					message: 'Moderators phải là staff thuộc phòng Content hoặc CSKH' 
				});
			}
		}			// Generate slug
			const slug = title.toLowerCase()
				.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
				.replace(/đ/g, 'd').replace(/Đ/g, 'D')
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '');

			let topic;
			if (id) {
				// Update existing topic
				topic = await models.Topic.findByPk(id);
				if (!topic) {
					return res.status(404).json({ success: false, message: 'Topic không tồn tại' });
				}
				topic.title = title.trim();
				topic.description = description ? description.trim() : '';
				topic.slug = slug;
				topic.requiresApproval = autoApprove ? false : requiresApproval;  // Logic đúng
				topic.autoApprove = autoApprove;
				topic.moderatorIds = Array.isArray(moderatorIds) ? moderatorIds : [];
				topic.isActive = isActive;
				topic.icon = icon;
				topic.color = color;
				await topic.save();
			} else {
				// Create new topic
				const maxOrder = await models.Topic.max('display_order') || 0;
				topic = await models.Topic.create({
					title: title.trim(),
					description: description ? description.trim() : '',
					slug,
					requiresApproval: autoApprove ? false : requiresApproval,  // Logic đúng
					autoApprove,
					moderatorIds: Array.isArray(moderatorIds) ? moderatorIds : [],
					isActive,
					icon,
					color,
					displayOrder: maxOrder + 1,
					creatorId: req.user.id
				});
			}

			res.json({ 
				success: true, 
				message: id ? 'Topic đã được cập nhật' : 'Topic đã được tạo',
				data: topic 
			});
		} catch (error) {
			next(error);
		}
	},

	// Toggle topic visibility (Cần quyền toggle_topic)
	toggleTopic: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Unauthorized' });
			}

			// ✅ Routes đã check quyền rồi

			const topicId = parseInt(req.params.id);
			if (isNaN(topicId)) {
				return res.status(400).json({ success: false, message: 'Invalid topic ID' });
			}

			const topic = await models.Topic.findByPk(topicId);
			if (!topic) {
				return res.status(404).json({ success: false, message: 'Topic không tồn tại' });
			}

			// Toggle isActive
			topic.isActive = !topic.isActive;
			await topic.save();

			res.json({
				success: true,
				message: `Topic đã được ${topic.isActive ? 'hiện' : 'ẩn'}`,
				data: { isActive: topic.isActive }
			});
		} catch (error) {
			next(error);
		}
	},

	// Delete topic (soft delete - Cần quyền delete_topic)
	deleteTopic: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Unauthorized' });
			}

			// ✅ Routes đã check quyền rồi

			const topicId = parseInt(req.params.id);
			if (isNaN(topicId)) {
				return res.status(400).json({ success: false, message: 'Invalid topic ID' });
			}

			const topic = await models.Topic.findByPk(topicId);
			if (!topic) {
				return res.status(404).json({ success: false, message: 'Topic không tồn tại' });
			}

			// Soft delete
			await topic.destroy();

			res.json({
				success: true,
				message: 'Topic đã được xóa'
			});
		} catch (error) {
			next(error);
		}
	},

	// Assign moderators to topic (Cần quyền assign_moderators)
	assignModerators: async (req, res, next) => {
		try {
			if (!req.user || !req.user.id) {
				return res.status(401).json({ success: false, message: 'Unauthorized' });
			}

			// ✅ Routes đã check quyền rồi

			const topicId = parseInt(req.params.id);
			if (isNaN(topicId)) {
				return res.status(400).json({ success: false, message: 'Invalid topic ID' });
			}

			const { moderatorIds = [] } = req.body;

			// Validate: Tối đa 2 moderators
			if (moderatorIds.length > 2) {
				return res.status(400).json({ 
					success: false, 
					message: 'Mỗi topic chỉ được phân công tối đa 2 moderators' 
				});
			}

			// Validate: Moderators phải là staff từ phòng Content hoặc Support
			if (moderatorIds.length > 0) {
				const moderators = await models.Staff.findAll({
					where: { 
						user_id: { [Op.in]: moderatorIds },
						department: { [Op.in]: ['content', 'support'] },
						work_status: 'active'
					}
				});

				if (moderators.length !== moderatorIds.length) {
					return res.status(400).json({ 
						success: false, 
						message: 'Moderators phải là staff active thuộc phòng Content hoặc CSKH' 
					});
				}
			}

			const topic = await models.Topic.findByPk(topicId);
			if (!topic) {
				return res.status(404).json({ success: false, message: 'Topic không tồn tại' });
			}

			// Update moderatorIds
			topic.moderatorIds = moderatorIds;
			await topic.save();

			// TODO: Gửi thông báo cho các moderators được phân công

			res.json({
				success: true,
				message: 'Đã phân công moderators thành công',
				data: { moderatorIds: topic.moderatorIds }
			});
		} catch (error) {
			next(error);
		}
	},

	// ✅ CRUD Topics Management
	getAllTopics: async (req, res, next) => {
		try {
			const includeHidden = req.query.includeHidden === 'true';
			const where = {};
			
			if (!includeHidden) {
				where.isActive = true;
			}

		// ✅ Sửa: Bỏ createdAt, updatedAt khỏi attributes vì model dùng underscored: true
		// Sequelize sẽ tự động map created_at -> createdAt trong response
		const topics = await models.Topic.findAll({
			where,
			order: [['created_at', 'DESC']], // ✅ Dùng snake_case cho ORDER BY
			attributes: ['id', 'title', 'description', 'icon', 'color', 'requiresApproval', 'autoApprove', 'isActive', 'moderatorIds']
		});			res.json({ success: true, data: topics });
		} catch (error) {
			console.error('❌ Error in getAllTopics:', error);
			res.status(500).json({ 
				success: false, 
				message: 'Lỗi khi lấy danh sách topics',
				error: error.message 
			});
		}
	},

	createTopic: async (req, res, next) => {
		try {
			const { name, title, description, icon, avatar, coverImage, cover_image, color, requiresApproval, autoApprove, moderatorIds } = req.body;

			console.log('[ForumController] Creating topic with data:', { title: title || name, moderatorIds });

			const topicTitle = title || name; // Support both 'title' and 'name'
			if (!topicTitle || !description) {
				return res.status(400).json({ success: false, message: 'Title and description are required' });
			}

			const topic = await models.Topic.create({
				title: topicTitle.trim(),
				description: description.trim(),
				icon: icon || '📝',
				avatar: avatar || null,
				coverImage: coverImage || cover_image || null,
				color: color || '#2fbf71',
				requiresApproval: requiresApproval !== false, // default true
				autoApprove: autoApprove === true, // default false
				moderatorIds: Array.isArray(moderatorIds) ? moderatorIds : [], // ✅ Lưu moderatorIds
				isActive: true
			});

			console.log('[ForumController] Topic created with moderatorIds:', topic.moderatorIds);

			res.status(201).json({ success: true, data: topic, message: 'Topic created successfully' });
		} catch (error) {
			console.error('[ForumController] Error creating topic:', error);
			next(error);
		}
	},

	updateTopic: async (req, res, next) => {
		try {
			const { id } = req.params;
			const { name, title, description, icon, avatar, coverImage, cover_image, color, requiresApproval, autoApprove, isActive, moderatorIds } = req.body;

			console.log('[ForumController] Updating topic', id, 'with moderatorIds:', moderatorIds);

			const topic = await models.Topic.findByPk(id);
			if (!topic) {
				return res.status(404).json({ success: false, message: 'Topic not found' });
			}

			// Update fields
			if (name !== undefined) topic.title = name.trim();
			if (title !== undefined) topic.title = title.trim(); // Support both 'title' and 'name'
			if (description !== undefined) topic.description = description.trim();
			if (icon !== undefined) topic.icon = icon;
			if (avatar !== undefined) topic.avatar = avatar;
			if (coverImage !== undefined || cover_image !== undefined) topic.coverImage = coverImage || cover_image;
			if (color !== undefined) topic.color = color;
			if (requiresApproval !== undefined) topic.requiresApproval = requiresApproval;
			if (autoApprove !== undefined) topic.autoApprove = autoApprove;
			if (isActive !== undefined) topic.isActive = isActive;
			if (moderatorIds !== undefined) topic.moderatorIds = Array.isArray(moderatorIds) ? moderatorIds : []; // ✅ Cập nhật moderatorIds

			await topic.save();

			console.log('[ForumController] Topic updated with moderatorIds:', topic.moderatorIds);

			res.json({ success: true, data: topic, message: 'Topic updated successfully' });
		} catch (error) {
			console.error('[ForumController] Error updating topic:', error);
			next(error);
		}
	},

	toggleTopicStatus: async (req, res, next) => {
		try {
			const { id } = req.params;
			const topic = await models.Topic.findByPk(id);
			
			if (!topic) {
				return res.status(404).json({ success: false, message: 'Topic not found' });
			}

			topic.isActive = !topic.isActive;
			await topic.save();

			res.json({ 
				success: true, 
				data: { id: topic.id, isActive: topic.isActive },
				message: `Topic ${topic.isActive ? 'activated' : 'deactivated'} successfully` 
			});
		} catch (error) {
			next(error);
		}
	},

	deleteTopic: async (req, res, next) => {
		try {
			const { id } = req.params;
			
			// Check if topic has questions
			const questionCount = await models.Question.count({ where: { topicId: id } });
			
			if (questionCount > 0) {
				return res.status(400).json({ 
					success: false, 
					message: `Cannot delete topic with ${questionCount} questions. Please reassign questions first or deactivate the topic.` 
				});
			}

			await models.Topic.destroy({ where: { id } });

			res.json({ success: true, message: 'Topic deleted successfully' });
		} catch (error) {
			next(error);
		}
	}
};

