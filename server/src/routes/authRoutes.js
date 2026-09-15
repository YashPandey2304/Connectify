const express = require("express");
const { register, login, logout, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimiter");
const { registerValidation, loginValidation } = require("../middleware/validationMiddleware");

const router = express.Router();

// Public routes — no token required. authLimiter applies specifically
// here (in addition to the general apiLimiter already applied to every
// route in app.js) because these are the highest-value targets for
// automated brute-force/credential-stuffing attacks. Validation chains
// run before the controller, rejecting malformed input with a clean 400
// before any database work happens.
router.post("/register", authLimiter, registerValidation, register);
router.post("/login", authLimiter, loginValidation, login);

// Private routes — protect middleware runs first, verifying the JWT
// before getMe/logout ever execute
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);

module.exports = router;
