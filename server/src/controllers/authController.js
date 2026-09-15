const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const asyncHandler = require("../utils/asyncHandler");

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 *
 * Flow: validate input exists -> check for duplicate email -> create user
 * (password gets hashed automatically by the User model's pre-save hook)
 * -> sign a JWT -> respond with user data + token.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are all required");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  // Check for existing user ourselves first, purely to return a friendly
  // "email already in use" message instead of a raw MongoDB duplicate-key
  // error. The schema's unique index is still the real safety net against
  // race conditions (see Phase 3 notes).
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    res.status(409); // 409 Conflict is the correct status for "already exists"
    throw new Error("An account with this email already exists");
  }

  const user = await User.create({ name, email, password });
  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    data: {
      user: user.toSafeObject(),
      token,
    },
  });
});

/**
 * @desc    Log in an existing user
 * @route   POST /api/auth/login
 * @access  Public
 *
 * Flow: find user by email (explicitly including the normally-hidden
 * password field) -> compare submitted password against the stored hash
 * -> sign JWT -> respond.
 *
 * IMPORTANT: we intentionally return the SAME error message whether the
 * email doesn't exist OR the password is wrong ("Invalid email or
 * password"). This prevents user enumeration — an attacker probing emails
 * can't tell which ones are registered based on a different error message.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password"
  );

  if (!user) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    data: {
      user: user.toSafeObject(),
      token,
    },
  });
});

/**
 * @desc    Log out the current user
 * @route   POST /api/auth/logout
 * @access  Private
 *
 * WHY does a stateless JWT need a logout endpoint at all?
 * The server never "stores" the session, so there's nothing to invalidate
 * server-side by default. This endpoint exists mainly as a clear, explicit
 * contract for the frontend to hit (useful if we later add token
 * blocklisting or httpOnly cookies). Right now, the actual logout action —
 * deleting the token — happens on the CLIENT by removing it from storage.
 */
const logout = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

/**
 * @desc    Get the currently authenticated user's profile
 * @route   GET /api/auth/me
 * @access  Private
 *
 * This is THE endpoint that makes session persistence work. On every
 * page refresh, the frontend reads the token from storage and calls this
 * route to re-fetch the current user before rendering the app. See
 * authMiddleware.js for how req.user gets populated.
 */
const getMe = asyncHandler(async (req, res) => {
  // req.user was attached by authMiddleware after verifying the JWT
  res.status(200).json({
    success: true,
    data: { user: req.user.toSafeObject() },
  });
});

module.exports = { register, login, logout, getMe };
