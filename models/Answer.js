const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Answer = sequelize.define('Answer', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    questionId: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      field: 'question_id'
    },
    authorId: { 
      type: DataTypes.BIGINT, 
      allowNull: false,
      field: 'user_id'
    },
    content: { type: DataTypes.TEXT, allowNull: false },
    isPinned: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: false,
      field: 'is_pinned'
    },
    isVerified: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: false,
      field: 'is_verified'
    },
    verifiedBy: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'verified_by'
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at'
    },
    likesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'likes_count'
    },
    likedBy: {
      type: DataTypes.JSON,
      defaultValue: [],
      field: 'liked_by'
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_deleted'
    },
  }, {
    tableName: 'answers',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Answer.associate = (models) => {
    Answer.belongsTo(models.Question, { foreignKey: 'questionId', as: 'question' });
    Answer.belongsTo(models.User, { foreignKey: 'authorId', as: 'author' });
    Answer.hasMany(models.Interaction, { foreignKey: 'entity_id', constraints: false, scope: { entity_type: 'answer' } });
  };

  console.log('SUCCESS: Model Answer đã được định nghĩa.');
  return Answer;
};