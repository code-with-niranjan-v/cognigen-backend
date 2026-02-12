// routes/learningPathRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  generateLearningPath,
  getUserLearningPaths,
  getLearningPathById,
  generateTopicContent,
  markSubmoduleComplete,
  deleteLearningPath,
  updateLearningPath,
  addTopic,
  updateTopic,
  deleteTopic,
  addSubmodule,
  updateSubmodule,
  deleteSubmodule,
  reorderTopics,
  reorderSubmodules,
  generateMiniQuiz,
  // NEW cell CRUD endpoints
  addCell,
  updateCell,
  deleteCell,
  reorderCells,
} = require("../controllers/learningPathController");

router.use(protect);

// ─── Core Learning Path ────────────────────────────────────────────────
router.post("/generate", generateLearningPath);
router.get("/", getUserLearningPaths);
router.get("/:id", getLearningPathById);
router.delete("/:id", deleteLearningPath);
router.patch("/:id", updateLearningPath);

// ─── Topics CRUD ────────────────────────────────────────────────────────
router.post("/:id/topics", addTopic);
router.patch("/:id/topics/:topicId", updateTopic);
router.delete("/:id/topics/:topicId", deleteTopic);

// ─── Submodules CRUD ────────────────────────────────────────────────────
router.post("/:id/topics/:topicId/submodules", addSubmodule);
router.patch("/:id/topics/:topicId/submodules/:subId", updateSubmodule);
router.delete("/:id/topics/:topicId/submodules/:subId", deleteSubmodule);

// ─── Reorder ────────────────────────────────────────────────────────────
router.patch("/:id/reorder-topics", reorderTopics);
router.patch("/:id/topics/:topicId/reorder-submodules", reorderSubmodules);

// ─── Content Generation ─────────────────────────────────────────────────
router.post("/:pathId/topics/:topicId/generate-content", generateTopicContent);
router.post(
  "/:pathId/topics/:topicId/submodules/:submoduleId/generate-quiz",
  generateMiniQuiz,
);
router.patch(
  "/:pathId/topics/:topicId/submodules/:submoduleId/complete",
  markSubmoduleComplete,
);

// ─── Cell CRUD (Notebook-like editing) ──────────────────────────────────
router.post("/:pathId/topics/:topicId/submodules/:submoduleId/cells", addCell);

router.patch(
  "/:pathId/topics/:topicId/submodules/:submoduleId/cells/:cellIndex",
  updateCell,
);

router.delete(
  "/:pathId/topics/:topicId/submodules/:submoduleId/cells/:cellIndex",
  deleteCell,
);

module.exports = router;
