// cognigen-backend/controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const LearningPath = require("../models/LearningPath");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

//  Register user
exports.signup = async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ name, email, password });

    const token = generateToken(user._id);

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//  Login user
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user._id);

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { name, email } = req.body;

  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update name if provided
    if (name && name.trim() !== "") {
      user.name = name.trim();
    }

    // Update email if provided and different
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res
          .status(400)
          .json({ message: "Email already in use by another account" });
      }
      user.email = email.toLowerCase();
    }

    await user.save();

    const updatedUser = {
      id: user._id,
      name: user.name,
      email: user.email,
    };

    res.json({
      success: true,
      user: updatedUser,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error while updating profile" });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "Current password and new password are required" });
  }

  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error while changing password" });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    await LearningPath.deleteMany({ user: req.user.id });

    res.cookie("token", "", { httpOnly: true, expires: new Date(0) });
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await User.aggregate([
      {
        $lookup: {
          from: "learningpaths",
          localField: "_id",
          foreignField: "user",
          as: "learningData",
        },
      },
      {
        $addFields: {
          coursesCreated: { $size: "$learningData" },

          totalProgress: {
            $sum: {
              $map: {
                input: "$learningData",
                as: "lp",
                in: "$$lp.overallProgress",
              },
            },
          },

          avgProgress: {
            $cond: [
              { $gt: [{ $size: "$learningData" }, 0] },
              {
                $avg: {
                  $map: {
                    input: "$learningData",
                    as: "lp",
                    in: "$$lp.overallProgress",
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          score: {
            $add: [{ $multiply: ["$coursesCreated", 100] }, "$totalProgress"],
          },
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          coursesCreated: 1,
          avgProgress: { $round: ["$avgProgress", 1] },
          score: 1,
        },
      },
      {
        $sort: { score: -1 },
      },
      {
        $limit: 50,
      },
    ]);

    res.json({
      success: true,
      leaderboard,
    });
  } catch (error) {
    console.error("Leaderboard ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leaderboard",
    });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const mongoose = require("mongoose");
    const objectId = new mongoose.Types.ObjectId(userId);

    const stats = await LearningPath.aggregate([
      { $match: { user: objectId } },
      {
        $group: {
          _id: null,
          totalCourses: { $sum: 1 },
          completedCourses: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          totalProgressSum: { $sum: "$overallProgress" },
        },
      },
    ]);

    const result = stats[0] || {
      totalCourses: 0,
      completedCourses: 0,
      totalProgressSum: 0,
    };

    res.json({
      success: true,
      stats: {
        coursesCreated: result.totalCourses,
        completedCourses: result.completedCourses,
        inProgressCourses: result.totalCourses - result.completedCourses,
        averageProgress:
          result.totalCourses > 0
            ? Math.round(result.totalProgressSum / result.totalCourses)
            : 0,
      },
    });
  } catch (error) {
    console.error("getUserStats ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

//  Get current user
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json({ success: true, user });
};

//  Logout
exports.logout = (req, res) => {
  res.cookie("token", "", { httpOnly: true, expires: new Date(0) });
  res.json({ success: true, message: "Logged out" });
};
