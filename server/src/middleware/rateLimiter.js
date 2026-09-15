const rateLimit = require("express-rate-limit");

/**
 * RATE LIMITING
 *
 * WHY two different limiters instead of one blanket rule for the whole API?
 * Auth endpoints (login especially) are a much higher-value target for
 * automated attacks — a script trying thousands of password guesses per
 * minute against one account. A strict limiter there (few attempts per
 * window) meaningfully blocks brute-forcing without affecting normal use
 * (nobody legitimately logs in 20 times in 15 minutes). The general API
 * limiter is much looser — its job is guarding against broader abuse/DoS,
 * not specifically brute-forcing, so normal chat usage (many message
 * sends, conversation loads) shouldn't ever come close to hitting it.
 */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window across register+login combined
  message: { success: false, message: "Too many attempts. Please try again later." },
  standardHeaders: true, // adds RateLimit-* headers so clients can see their remaining quota
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // generous — this guards against abuse/DoS, not normal usage patterns
  message: { success: false, message: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * TURN credential requests are authenticated (so this isn't about
 * anonymous abuse), but each request still costs real Cloudflare API
 * calls and counts against that account's usage — a compromised or
 * malicious authenticated account spamming this endpoint could still
 * run up real cost. A moderate limit (a handful of calls per minute is
 * far more than any real user would ever need) closes that off cheaply.
 */
const turnCredentialLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many call attempts. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter, turnCredentialLimiter };
