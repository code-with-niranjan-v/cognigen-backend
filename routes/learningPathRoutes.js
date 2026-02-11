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
} = require("../controllers/learningPathController");

router.use(protect);

router.post("/generate", generateLearningPath);
router.get("/", getUserLearningPaths);
router.get("/:id", getLearningPathById);
router.delete("/:id", deleteLearningPath);
router.patch("/:id", updateLearningPath);

// Topics CRUD
router.post("/:id/topics", addTopic);
router.patch("/:id/topics/:topicId", updateTopic);
router.delete("/:id/topics/:topicId", deleteTopic);

// Submodules CRUD
router.post("/:id/topics/:topicId/submodules", addSubmodule);
router.patch("/:id/topics/:topicId/submodules/:subId", updateSubmodule);
router.delete("/:id/topics/:topicId/submodules/:subId", deleteSubmodule);

// Reorder
router.patch("/:id/reorder-topics", reorderTopics);
router.patch("/:id/topics/:topicId/reorder-submodules", reorderSubmodules);

router.post("/:pathId/topics/:topicId/generate-content", generateTopicContent);
router.patch(
  "/:pathId/topics/:topicId/submodules/:submoduleId/complete",
  markSubmoduleComplete,
);

module.exports = router;
