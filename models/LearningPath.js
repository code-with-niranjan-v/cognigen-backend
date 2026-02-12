// cognigen-ba
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const CellSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      default: uuidv4,
    },
    type: {
      type: String,
      enum: ["markdown", "code", "resource", "image", "diagram", "separator"],
      required: true,
    },

    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    title: String,
    language: String,
    meta: mongoose.Schema.Types.Mixed,
  },
  { _id: false },
);

const SubmoduleSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  summary: String,

  cells: [CellSchema],

  miniQuiz: [
    {
      question: String,
      options: [String],
      answer: String,
      difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
      },
    },
  ],

  contentVersion: {
    type: Number,
    default: 2,
  },

  completed: { type: Boolean, default: false },
  generatedAt: { type: Date },
});

const TopicSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard"] },
  estimatedTimeMinutes: Number,
  submodules: [SubmoduleSchema],
  completedSubmodules: { type: Number, default: 0 },
  contentGenerated: { type: Boolean, default: false },
});

const LearningPathSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: { type: String, required: true },
  courseName: { type: String, required: true },
  experienceLevel: {
    type: String,
    enum: ["beginner", "intermediate", "advanced"],
    required: true,
  },
  goal: {
    type: String,
    enum: ["placement", "mastery", "revision"],
    required: true,
  },
  preferredLearningStyle: {
    type: String,
    enum: ["theory", "practical", "mixed"],
    required: true,
  },
  timeAvailability: {
    perDayHours: { type: Number, min: 1, max: 10 },
  },
  customTopics: [String],
  topics: [TopicSchema],
  overallProgress: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["draft", "active", "completed"],
    default: "draft",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

LearningPathSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model("LearningPath", LearningPathSchema);
