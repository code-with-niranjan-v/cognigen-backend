// cognigen-backend/routes/authRoutes.js
const express = require("express");
const {
  signup,
  login,
  getMe,
  logout,
  updateProfile,
  changePassword,
  deleteAccount,
  getLeaderboard,
  getUserStats,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.put("/update-profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.delete("/delete-account", protect, deleteAccount);
router.get("/leaderboard", getLeaderboard);
router.get("/stats", protect, getUserStats);
router.get("/me", protect, getMe);
router.post("/logout", logout);

module.exports = router;
