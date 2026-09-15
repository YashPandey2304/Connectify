const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

/**
 * PROTECT MIDDLEWARE
 *
 * Runs before any protected controller. Its job:
 *   1. Read the JWT from the Authorization header
 *   2. Verify it's valid and not expired
 *   3. Look up the user it belongs to
 *   4. Attach that user to req.user so controllers can use it
 *
 * WHY re-fetch the user from the DB on every request instead of trusting
 * the token's payload?
 * The token only contains the user ID (see generateToken.js). Fetching
 * fresh data means if the user's profile changed, or — importantly — if
 * we ever needed to ban/deactivate an account, the very next request
 * reflects that. Trusting stale data baked into the token would mean a
 * banned user's existing token still "works" until it expires.
 *
 * WHERE does the frontend put the token?
 * As an `Authorization: Bearer <token>` header on every request (set up
 * in Phase 5 via an Axios interceptor). We are NOT using cookies here —
 * see the Phase 5 write-up for why we chose header-based auth.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token provided");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded.id is the user ID we embedded in generateToken.js
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401);
      throw new Error("Not authorized, user no longer exists");
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401);
    // jwt.verify throws distinct errors for expired vs malformed tokens —
    // we normalize both into one message so we don't leak implementation
    // details, but you could branch on error.name === "TokenExpiredError"
    // if the frontend wanted to show a specific "session expired" message.
    throw new Error("Not authorized, invalid or expired token");
  }
});

module.exports = { protect };
