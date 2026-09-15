const express = require("express");
const {
  getUsers,
  searchUsers,
  getUserById,
  updateProfile,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

// IMPORTANT: /search must be declared BEFORE /:id. Express matches routes
// top-to-bottom, and /:id would otherwise treat the literal string
// "search" as a user ID and try (and fail) to look it up.
router.get("/search", searchUsers);
router.patch("/profile", updateProfile);
router.get("/", getUsers);
router.get("/:id", getUserById);

module.exports = router;
