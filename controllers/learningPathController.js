// cognigen-backend/controllers/learningPathController.js
const LearningPath = require("../models/LearningPath");
const {
  generateLearningPath: callAILearningPath,
  generateTopicContent: callAITopicContent,
  generateMiniQuiz: callAIMiniQuiz,
} = require("../services/aiService");
const { v4: uuidv4 } = require("uuid");

// Helper: Recalculate topic & overall path progress
const recalculateProgress = async (path) => {
  let totalSubmodules = 0;
  let completedSubmodules = 0;

  path.topics.forEach((topic) => {
    topic.completedSubmodules = 0;

    topic.submodules.forEach((sub) => {
      totalSubmodules++;
      if (sub.completed) {
        completedSubmodules++;
        topic.completedSubmodules++;
      }
    });

    // Topic-level progress (0-100%)
    topic.progress =
      topic.submodules.length > 0
        ? Math.round(
            (topic.completedSubmodules / topic.submodules.length) * 100,
          )
        : 0;
  });

  // Overall path progress
  path.overallProgress =
    totalSubmodules > 0
      ? Math.round((completedSubmodules / totalSubmodules) * 100)
      : 0;

  if (path.overallProgress === 100) {
    path.status = "completed";
  }

  path.markModified("topics"); // Required for nested array updates
  await path.save();
};

// 1. Generate full learning path (AI → DB)
exports.generateLearningPath = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      course_name,
      experience_level,
      goal,
      preferred_learning_style,
      time_availability,
      custom_topics = [],
    } = req.body;

    console.log(
      "\n[DEBUG] Incoming LP request:",
      JSON.stringify(req.body, null, 2),
    );

    const aiPayload = {
      user_id: userId.toString(),
      course_name,
      experience_level,
      goal,
      preferred_learning_style,
      time_availability,
      custom_topics,
    };

    let aiResult;
    try {
      aiResult = await callAILearningPath(aiPayload);
      console.log(
        "[DEBUG] FastAPI LP Response:",
        JSON.stringify(aiResult, null, 2),
      );
    } catch (err) {
      console.error("[AI ERROR] FastAPI failed:", err.message);
      aiResult = {
        title: `${course_name} Learning Path (Partial)`,
        topics: [],
      };
    }

    const learningPath = new LearningPath({
      user: userId,
      title: aiResult.title || `${course_name} Learning Path`,
      courseName: course_name,
      experienceLevel: experience_level,
      goal,
      preferredLearningStyle: preferred_learning_style,
      timeAvailability: {
        perDayHours: time_availability?.per_day_hours || 1,
      },
      customTopics: custom_topics,
      topics:
        aiResult.topics?.map((t) => ({
          id: t.id,
          name: t.name,
          difficulty: t.difficulty || "easy",
          estimatedTimeMinutes: (t.estimated_time_hours || 1) * 60,
          submodules: t.submodules.map((s) => ({
            id: s.id,
            title: s.title,
            summary: s.summary || "",
            cells: [],
            miniQuiz: [],
            contentVersion: 2,
            completed: false,
            generatedAt: null,
          })),
          completedSubmodules: 0,
          contentGenerated: false,
        })) || [],
      overallProgress: 0,
      status: aiResult.topics?.length > 0 ? "active" : "draft",
    });

    await learningPath.save();
    return res.status(201).json(learningPath);
  } catch (error) {
    console.error("\n[CRITICAL] generateLearningPath Error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// 2. Get all user's learning paths
exports.getUserLearningPaths = async (req, res) => {
  try {
    const paths = await LearningPath.find({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .select(
        "title courseName experienceLevel overallProgress status updatedAt topics",
      );
    return res.json(paths);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch learning paths" });
  }
};

// 3. Get single learning path by ID
exports.getLearningPathById = async (req, res) => {
  try {
    const lp = await LearningPath.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!lp)
      return res.status(404).json({ message: "Learning path not found" });

    return res.json(lp);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

// 4. Generate content for a topic (cells)
exports.generateTopicContent = async (req, res) => {
  const { pathId, topicId } = req.params;

  try {
    const path = await LearningPath.findOne({
      _id: pathId,
      user: req.user._id,
    });

    if (!path) {
      return res.status(404).json({ message: "Learning path not found" });
    }

    const topic = path.topics.find((t) => t.id === topicId);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    const aiPayload = {
      topic_id: topicId,
      topic_name: topic.name,
      course_name: path.courseName,
      experience_level: path.experienceLevel,
      submodules: topic.submodules.map((sub) => ({
        id: sub.id,
        title: sub.title,
        summary: sub.summary || "",
      })),
    };

    const aiResponse = await callAITopicContent(aiPayload);

    if (!aiResponse.content || !Array.isArray(aiResponse.content)) {
      throw new Error("Invalid AI response format");
    }

    // Map AI cells to matching submodules
    topic.submodules = topic.submodules.map((sub) => {
      const aiSub = aiResponse.content.find((c) => c.id === sub.id);

      if (aiSub) {
        sub.cells = aiSub.cells || [];
        sub.miniQuiz = aiSub.miniQuiz || [];
        sub.contentVersion = aiSub.contentVersion || 2;
        sub.generatedAt = aiSub.generatedAt
          ? new Date(aiSub.generatedAt)
          : new Date();
      }

      return sub;
    });

    topic.contentGenerated = true;

    await recalculateProgress(path);

    res.json({
      success: true,
      topic,
      message: "Content generated and saved successfully",
    });
  } catch (error) {
    console.error("[ERROR] generateTopicContent:", error);
    res.status(500).json({
      message: error.message || "Content generation failed",
    });
  }
};

// 5. Generate mini quiz for a submodule
exports.generateMiniQuiz = async (req, res) => {
  const { pathId, topicId, submoduleId } = req.params;

  try {
    const path = await LearningPath.findOne({
      _id: pathId,
      user: req.user._id,
    });

    if (!path)
      return res.status(404).json({ message: "Learning path not found" });

    const topic = path.topics.find((t) => t.id === topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    const sub = topic.submodules.find((s) => s.id === submoduleId);
    if (!sub) return res.status(404).json({ message: "Submodule not found" });

    const optimizedCells =
      sub.cells
        ?.filter((c) => c.type === "markdown" || c.type === "code")
        ?.slice(0, 8)
        ?.map((c) => ({
          type: c.type,
          content: c.content?.slice(0, 2000),
        })) || [];

    const aiPayload = {
      submodule_id: submoduleId,
      submodule_title: sub.title,
      cells: optimizedCells, // ✅ REQUIRED by your FastAPI graph
    };

    const aiQuizResponse = await callAIMiniQuiz(aiPayload);

    if (!aiQuizResponse?.quiz || !Array.isArray(aiQuizResponse.quiz)) {
      throw new Error("Invalid quiz response from AI");
    }

    sub.miniQuiz = aiQuizResponse.quiz;
    sub.generatedAt = new Date();

    await path.save();

    res.json({
      success: true,
      miniQuiz: sub.miniQuiz,
      message: "Mini quiz generated and saved",
    });
  } catch (error) {
    console.error("Generate quiz error:", error);

    res.status(500).json({
      message: "Quiz generation failed. Please try again.",
    });
  }
};

// 6. Mark submodule as complete
exports.markSubmoduleComplete = async (req, res) => {
  const { pathId, topicId, submoduleId } = req.params;

  try {
    const path = await LearningPath.findOne({
      _id: pathId,
      user: req.user._id,
    });

    if (!path) return res.status(404).json({ message: "Path not found" });

    const topic = path.topics.find((t) => t.id === topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    const sub = topic.submodules.find((s) => s.id === submoduleId);
    if (!sub) return res.status(404).json({ message: "Submodule not found" });

    if (!sub.completed) {
      sub.completed = true;
      topic.completedSubmodules += 1;

      const totalSubs = topic.submodules.length;
      topic.progress =
        totalSubs > 0
          ? Math.round((topic.completedSubmodules / totalSubs) * 100)
          : 0;

      let totalSubsAll = 0;
      let completedAll = 0;

      path.topics.forEach((t) => {
        totalSubsAll += t.submodules.length;
        completedAll += t.completedSubmodules;
      });

      path.overallProgress =
        totalSubsAll > 0 ? Math.round((completedAll / totalSubsAll) * 100) : 0;

      if (path.overallProgress === 100) {
        path.status = "completed";
      }

      await path.save();
    }

    return res.json(path);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update completion" });
  }
};

// 7. Update learning path (title, etc.)
exports.updateLearningPath = async (req, res) => {
  try {
    const { title, description } = req.body;
    const path = await LearningPath.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { title, description, updatedAt: Date.now() },
      { new: true },
    );
    if (!path) return res.status(404).json({ message: "Path not found" });
    res.json(path);
  } catch (err) {
    res.status(500).json({ message: "Failed to update path" });
  }
};

// 8. Add new topic
exports.addTopic = async (req, res) => {
  try {
    const {
      name,
      difficulty = "medium",
      estimatedTimeMinutes = 60,
      submodules = [],
    } = req.body;

    const path = await LearningPath.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!path) return res.status(404).json({ message: "Path not found" });

    let finalSubmodules = submodules;
    if (finalSubmodules.length === 0) {
      finalSubmodules = [
        {
          id: uuidv4(),
          title: name.trim(),
          summary: `Default submodule for "${name.trim()}"`,
          cells: [],
          miniQuiz: [],
          contentVersion: 2,
          completed: false,
          generatedAt: null,
        },
      ];
    }

    const newTopic = {
      id: uuidv4(),
      name,
      difficulty,
      estimatedTimeMinutes,
      submodules: finalSubmodules,
      completedSubmodules: 0,
      contentGenerated: false,
    };

    path.topics.push(newTopic);
    await path.save();

    res.status(201).json(newTopic);
  } catch (err) {
    console.error("Add topic error:", err);
    res.status(500).json({ message: "Failed to add topic" });
  }
};

// 9. Update existing topic
exports.updateTopic = async (req, res) => {
  try {
    const { name, difficulty, estimatedTimeMinutes, submodules } = req.body;

    const path = await LearningPath.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!path) return res.status(404).json({ message: "Path not found" });

    const topic = path.topics.find((t) => t.id === req.params.topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    if (name) topic.name = name;
    if (difficulty) topic.difficulty = difficulty;
    if (estimatedTimeMinutes) topic.estimatedTimeMinutes = estimatedTimeMinutes;

    if (submodules && Array.isArray(submodules)) {
      topic.submodules = submodules.map((sub) => ({
        ...sub,
        id: sub.id || uuidv4(),
        cells: sub.cells || [],
        miniQuiz: sub.miniQuiz || [],
        contentVersion: sub.contentVersion || 2,
      }));

      if (topic.submodules.length === 0) {
        topic.submodules = [
          {
            id: uuidv4(),
            title: topic.name,
            summary: `Default submodule for "${topic.name}"`,
            cells: [],
            miniQuiz: [],
            contentVersion: 2,
            completed: false,
            generatedAt: null,
          },
        ];
      }
    }

    await path.save();
    res.json(topic);
  } catch (err) {
    console.error("Update topic error:", err);
    res.status(500).json({ message: "Failed to update topic" });
  }
};

// 10. Delete topic
exports.deleteTopic = async (req, res) => {
  try {
    const path = await LearningPath.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!path) return res.status(404).json({ message: "Path not found" });

    path.topics = path.topics.filter((t) => t.id !== req.params.topicId);
    await recalculateProgress(path);
    res.json({ message: "Topic deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete topic" });
  }
};

// 11. Add submodule
exports.addSubmodule = async (req, res) => {
  try {
    const { title, summary = "" } = req.body;

    const path = await LearningPath.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!path) return res.status(404).json({ message: "Path not found" });

    const topic = path.topics.find((t) => t.id === req.params.topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    const newSub = {
      id: uuidv4(),
      title,
      summary,
      cells: [],
      miniQuiz: [],
      contentVersion: 2,
      completed: false,
      generatedAt: null,
    };

    topic.submodules.push(newSub);
    await path.save();

    res.status(201).json(newSub);
  } catch (err) {
    res.status(500).json({ message: "Failed to add submodule" });
  }
};

// 12. Update submodule
exports.updateSubmodule = async (req, res) => {
  try {
    const { title, summary } = req.body;

    const path = await LearningPath.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!path) return res.status(404).json({ message: "Path not found" });

    const topic = path.topics.find((t) => t.id === req.params.topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    const sub = topic.submodules.find((s) => s.id === req.params.subId);
    if (!sub) return res.status(404).json({ message: "Submodule not found" });

    if (title) sub.title = title;
    if (summary) sub.summary = summary;

    await path.save();
    res.json(sub);
  } catch (err) {
    res.status(500).json({ message: "Failed to update submodule" });
  }
};

// 13. Delete submodule
exports.deleteSubmodule = async (req, res) => {
  try {
    const path = await LearningPath.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!path) return res.status(404).json({ message: "Path not found" });

    const topic = path.topics.find((t) => t.id === req.params.topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    topic.submodules = topic.submodules.filter(
      (s) => s.id !== req.params.subId,
    );

    await recalculateProgress(path);
    res.json({ message: "Submodule deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete submodule" });
  }
};

// 14. Reorder topics
exports.reorderTopics = async (req, res) => {
  try {
    const { orderedTopicIds } = req.body;

    const path = await LearningPath.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!path) return res.status(404).json({ message: "Path not found" });

    const reordered = orderedTopicIds
      .map((id) => path.topics.find((t) => t.id === id))
      .filter(Boolean);

    if (reordered.length !== path.topics.length) {
      return res.status(400).json({ message: "Invalid topic IDs" });
    }

    path.topics = reordered;
    await path.save();

    res.json(path);
  } catch (err) {
    res.status(500).json({ message: "Failed to reorder topics" });
  }
};

// 15. Reorder submodules in a topic
exports.reorderSubmodules = async (req, res) => {
  try {
    const pathId = req.params.id;
    const topicId = req.params.topicId;
    const { orderedSubmoduleIds } = req.body;

    const path = await LearningPath.findOne({
      _id: pathId,
      user: req.user._id,
    });
    if (!path) return res.status(404).json({ message: "Path not found" });

    const topic = path.topics.find((t) => t.id === topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    const reordered = orderedSubmoduleIds
      .map((id) => topic.submodules.find((s) => s.id === id))
      .filter(Boolean);

    if (reordered.length !== topic.submodules.length) {
      return res.status(400).json({ message: "Invalid submodule IDs" });
    }

    topic.submodules = reordered;
    await path.save();

    res.json(topic);
  } catch (err) {
    console.error("Reorder submodules error:", err);
    res.status(500).json({ message: "Failed to reorder submodules" });
  }
};

// 16. Delete entire learning path
exports.deleteLearningPath = async (req, res) => {
  try {
    const path = await LearningPath.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!path) {
      return res
        .status(404)
        .json({ message: "Learning path not found or not yours" });
    }

    console.log(
      `[DELETED] Learning path "${path.title}" by user ${req.user._id}`,
    );
    res.json({ message: "Learning path deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Failed to delete learning path" });
  }
};

exports.addCell = async (req, res) => {
  const { pathId, topicId, submoduleId } = req.params;
  const { type = "markdown", content = "" } = req.body;

  try {
    const path = await LearningPath.findOne({
      _id: pathId,
      user: req.user._id,
    });

    if (!path) return res.status(404).json({ message: "Path not found" });

    const topic = path.topics.find((t) => t.id === topicId);
    const sub = topic?.submodules.find((s) => s.id === submoduleId);

    if (!sub) return res.status(404).json({ message: "Submodule not found" });

    const newCell = {
      type,
      content,
    };

    sub.cells.push(newCell);

    await path.save();

    res.status(201).json(newCell);
  } catch (err) {
    res.status(500).json({ message: "Failed to add cell" });
  }
};

exports.updateCell = async (req, res) => {
  const { pathId, topicId, submoduleId, cellIndex } = req.params;
  const { content } = req.body;

  try {
    const path = await LearningPath.findOne({
      _id: pathId,
      user: req.user._id,
    });

    const topic = path?.topics.find((t) => t.id === topicId);
    const sub = topic?.submodules.find((s) => s.id === submoduleId);

    if (!sub || !sub.cells[cellIndex])
      return res.status(404).json({ message: "Cell not found" });

    sub.cells[cellIndex].content = content;

    await path.save();

    res.json(sub.cells[cellIndex]);
  } catch (err) {
    res.status(500).json({ message: "Failed to update cell" });
  }
};

exports.deleteCell = async (req, res) => {
  const { pathId, topicId, submoduleId, cellIndex } = req.params;

  try {
    const path = await LearningPath.findOne({
      _id: pathId,
      user: req.user._id,
    });

    const topic = path?.topics.find((t) => t.id === topicId);
    const sub = topic?.submodules.find((s) => s.id === submoduleId);

    if (!sub) return res.status(404).json({ message: "Submodule not found" });

    sub.cells.splice(cellIndex, 1);

    await path.save();

    res.json({ message: "Cell deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete cell" });
  }
};
