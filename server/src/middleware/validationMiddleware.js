const { body, validationResult } = require("express-validator");

/**
 * VALIDATION MIDDLEWARE
 *
 * WHY centralize validation here instead of the ad-hoc `if (!field)`
 * checks we had directly in controllers (Phase 4)?
 * Those manual checks worked, but they're scattered, inconsistent in
 * their error messages, and don't compose well (e.g., "is this a valid
 * email format" was left entirely to the Mongoose schema, which only
 * runs AFTER a database write attempt). Centralizing validation rules
 * here means:
 *   1. Invalid requests are rejected before touching the database at all
 *   2. Every route gets consistent, well-formatted error messages
 *   3. Validation logic is declarative and easy to read/extend
 *
 * `runValidation` is the actual middleware that runs after a validation
 * chain — it checks whether express-validator found any problems and,
 * if so, responds with a clean 400 instead of letting the request reach
 * the controller at all.
 */
const runValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg, // first error is usually enough for the user to act on
    });
  }
  next();
};

const registerValidation = [
  body("name").trim().isLength({ min: 2, max: 50 }).withMessage("Name must be 2-50 characters"),
  body("email").trim().isEmail().withMessage("Please provide a valid email address").normalizeEmail(),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  runValidation,
];

const loginValidation = [
  body("email").trim().isEmail().withMessage("Please provide a valid email address").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  runValidation,
];

const messageValidation = [
  body("content")
    .trim()
    .notEmpty()
    .withMessage("Message content cannot be empty")
    .isLength({ max: 2000 })
    .withMessage("Message cannot exceed 2000 characters"),
  runValidation,
];

module.exports = { registerValidation, loginValidation, messageValidation, runValidation };
