// models/LearningPath.js
const mongoose = require("mongoose");

const CellSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "explanation",
        "markdown", // future extension
        "code",
        "steps",
        "video",
        "image",
        "diagram", // mermaid / plantuml later
        "separator", // visual break
      ],
      required: true,
    },
    content: {
      // main payload — string, array, or object depending on type
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    title: String, // optional — mostly for code & video cells
    language: String, // for code cells: "javascript", "python", "html", …
    meta: mongoose.Schema.Types.Mixed, // e.g. { thumbnail: "...", duration: "4:20" }
  },
  { _id: false },
);

const SubmoduleSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  summary: { type: String },

  // ─── OLD FORMAT (still supported in Phase 0) ───
  content: {
    explanation: String,
    codeExamples: [String],
    realWorldExamples: [String],
    stepByStepGuide: [String],
    miniQuiz: [{ question: String, options: [String], answer: String }],
    projectSuggestion: String,
  },

  // ─── NEW FORMAT (Phase 0 → future default) ───
  cells: [CellSchema], // ← the new notebook-style content
  miniQuiz: [
    {
      // ← generated separately, later
      question: String,
      options: [String],
      answer: String, // or answerIndex: Number
    },
  ],

  // Metadata to help migration & rendering
  contentVersion: {
    type: Number,
    default: 1, // 1 = old format, 2 = cells format
    min: 1,
    max: 3,
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
  // optional: lastGeneratedAt, generationStatus, errorMessage, …
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
