// cognigen-backend/controllers/learningPathController.js
const LearningPath = require("../models/LearningPath");
const {
  generateLearningPath,
  generateTopicContent,
} = require("../services/aiService");

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
      aiResult = await generateLearningPath(aiPayload);
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
          difficulty: t.difficulty,
          estimatedTimeMinutes: (t.estimated_time_hours || 1) * 60,
          submodules: t.submodules.map((s) => ({
            id: s.id,
            title: s.title,
            summary: s.summary,
            content: {},
            completed: false,
          })),
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

exports.generateTopicContent = async (req, res) => {
  try {
    const { pathId, topicId } = req.params;
    const { submodules } = req.body;

    const learningPath = await LearningPath.findOne({
      _id: pathId,
      user: req.user._id,
    });

    if (!learningPath) {
      return res.status(404).json({ message: "Learning path not found" });
    }

    const topic = learningPath.topics.find((t) => t.id === topicId);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    const aiPayload = {
      topic_id: topicId,
      topic_name: topic.name,
      course_name: learningPath.courseName,
      experience_level: learningPath.experienceLevel,
      submodules:
        submodules ||
        topic.submodules.map((sm) => ({
          id: sm.id,
          title: sm.title,
          summary: sm.summary || "",
        })),
    };

    const aiResult = await generateTopicContent(aiPayload);

    console.log(
      "[DEBUG] Topic Content Response:",
      JSON.stringify(aiResult, null, 2),
    );

    const generatedMap = {};
    aiResult.content.forEach((c) => {
      generatedMap[c.submodule_id] = c;
    });

    topic.submodules = topic.submodules.map((sub) => {
      const g = generatedMap[sub.id];
      if (g) {
        return {
          ...sub,
          content: g.content,
          generatedAt: new Date(),
        };
      }
      return sub;
    });

    topic.contentGenerated = true;

    await learningPath.save();

    return res.json({ success: true, updatedTopic: topic });
  } catch (error) {
    console.error("[ERROR] generateTopicContent:", error);
    return res.status(500).json({ message: "Content generation failed" });
  }
};

exports.markSubmoduleComplete = async (req, res) => {
  try {
    const { pathId, topicId, submoduleId } = req.params;

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
          id: require("uuid").v4(),
          title: name.trim(),
          summary: `Default submodule for "${name.trim()}"`,
          content: {},
          completed: false,
        },
      ];
    }

    const newTopic = {
      id: require("uuid").v4(),
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
        id: sub.id || require("uuid").v4(), // ensure ID exists
      }));

      if (topic.submodules.length === 0) {
        topic.submodules = [
          {
            id: require("uuid").v4(),
            title: topic.name,
            summary: `Default submodule for "${topic.name}"`,
            content: {},
            completed: false,
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

exports.deleteTopic = async (req, res) => {
  try {
    const path = await LearningPath.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!path) return res.status(404).json({ message: "Path not found" });

    path.topics = path.topics.filter((t) => t.id !== req.params.topicId);
    await path.save();

    res.json({ message: "Topic deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete topic" });
  }
};

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
      id: require("uuid").v4(),
      title,
      summary,
      content: {},
      completed: false,
    };

    topic.submodules.push(newSub);
    await path.save();

    res.status(201).json(newSub);
  } catch (err) {
    res.status(500).json({ message: "Failed to add submodule" });
  }
};

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

    await path.save();

    res.json({ message: "Submodule deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete submodule" });
  }
};

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

// ─── REORDER SUBMODULES IN A TOPIC ───

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
