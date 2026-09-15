const jwt = require("jsonwebtoken");

/**
 * Generates a signed JWT for a given user ID.
 *
 * WHAT goes inside the token?
 * Only the user's ID (the "payload"). We deliberately do NOT put the
 * user's name, email, or role inside the token. Anyone can base64-decode
 * a JWT payload and read it (it's signed, not encrypted) — so nothing
 * sensitive belongs in there. The ID is just a lookup key; the middleware
 * fetches the real, current user data from MongoDB on every request.
 *
 * WHY a separate util instead of inlining jwt.sign() in controllers?
 * Single source of truth for token shape and expiry. If we ever change
 * the secret, algorithm, or expiry policy, there's exactly one place to
 * change it, and register/login both automatically stay in sync.
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

module.exports = generateToken;
