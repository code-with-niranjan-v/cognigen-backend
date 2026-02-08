// cognigen-backend/models/LearningPath.js
const mongoose = require("mongoose");

const SubmoduleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    summary: String,
    order: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastGeneratedAt: Date,
    content: {
      explanation: String,
      code_examples: [
        {
          title: String,
          code: String,
          explanation: String,
        },
      ],
      real_world_examples: [String],
      step_by_step: [String],
      mini_quiz: [
        {
          question: String,
          options: [String],
          answer: String,
        },
      ],
      project_suggestion: String,
    },
  },
  { timestamps: true },
);

const TopicSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    order: { type: Number, required: true },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
    },
    estimated_time_hours: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    lastGeneratedAt: Date,
    submodules: [SubmoduleSchema],
  },
  { timestamps: true },
);

const LearningPathSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: String,
    course_name: { type: String, required: true },
    goal: String,
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
    },
    student_profile: {
      user_id: String, // redundant but useful for quick queries
      course_name: String,
      experience_level: String,
      custom_topics: [String],
      goal: String,
      preferred_learning_style: String,
      time_availability: {
        per_day_hours: Number,
      },
    },
    topics: [TopicSchema],
    progress: {
      topics_completed: { type: Number, default: 0 },
      total_topics: Number,
      submodules_completed: { type: Number, default: 0 },
      total_submodules: Number,
      percentage: { type: Number, default: 0 },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Index for fast user-specific listing
LearningPathSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("LearningPath", LearningPathSchema);
