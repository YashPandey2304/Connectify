const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

/**
 * @desc    Get all users except the logged-in user
 * @route   GET /api/users
 * @access  Private
 */
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }).select(
    "name email profilePicture isOnline lastSeen"
  );
  res.status(200).json({ success: true, data: { users } });
});

/**
 * @desc    Search users by name or email (case-insensitive partial match)
 * @route   GET /api/users/search?q=...
 * @access  Private
 */
const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || !q.trim()) {
    return res.status(200).json({ success: true, data: { users: [] } });
  }

  // Escape regex special characters in user input before building a RegExp
  // from it — otherwise a query like "a.*" would be interpreted as a
  // wildcard pattern instead of a literal string (a minor but real
  // injection-style concern with user-supplied regex).
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, "i");

  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [{ name: pattern }, { email: pattern }],
  }).select("name email profilePicture isOnline lastSeen");

  res.status(200).json({ success: true, data: { users } });
});

/**
 * @desc    Get a single user's public profile by ID
 * @route   GET /api/users/:id
 * @access  Private
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    "name email profilePicture isOnline lastSeen"
  );

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.status(200).json({ success: true, data: { user } });
});

/**
 * @desc    Update the logged-in user's own profile
 * @route   PATCH /api/users/profile
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, profilePicture } = req.body;

  if (name) req.user.name = name;
  if (profilePicture !== undefined) req.user.profilePicture = profilePicture;

  await req.user.save();

  res.status(200).json({ success: true, data: { user: req.user.toSafeObject() } });
});

module.exports = { getUsers, searchUsers, getUserById, updateProfile };
