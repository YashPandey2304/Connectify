const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const { apiLimiter } = require("./middleware/rateLimiter");

/**
 * WHAT is this file?
 * app.js configures the Express application itself: middleware, routes,
 * and error handling. It does NOT start the server or connect sockets —
 * that happens in server.js.
 *
 * WHY split app.js from server.js?
 * This is a very common interview talking point. Separating "app config"
 * from "server bootstrapping" lets us:
 *   1. Import `app` directly in tests (e.g. supertest) without opening a
 *      real port or a real socket connection.
 *   2. Keep server.js tiny and readable — it just wires app + http + io together.
 */
const app = express();

// --- Security middleware (Phase 16) ---
// helmet() sets a batch of security-related HTTP response headers
// (X-Content-Type-Options, X-Frame-Options, etc.) that Express doesn't
// set by default — one line covering many small, well-known hardening
// measures at once.
app.use(helmet());

// Applies to every route below this line. Auth routes get an ADDITIONAL,
// stricter limiter on top of this one — see authRoutes.js.
app.use(apiLimiter);

// --- Core middleware ---
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// A 10kb limit instead of the unbounded default — chat messages and auth
// payloads are small; there's no legitimate reason for this API to
// accept a multi-megabyte JSON body, and capping it costs nothing for
// real usage while blocking a trivial memory-exhaustion attack vector.
app.use(express.json({ limit: "10kb" }));

// Strips any request body/query keys starting with "$" or containing
// "." — e.g. turns { email: { $ne: null } } into { email: {} } before
// it ever reaches a Mongoose query. Without this, a crafted request
// body could inject MongoDB query operators instead of a plain value.
app.use(mongoSanitize());

// --- Health check route (Phase 1 sanity check) ---
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Connectify API is running" });
});

// --- Feature routes ---
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/conversations", require("./routes/conversationRoutes"));
app.use("/api/conversations/:conversationId/messages", require("./routes/messageRoutes"));
app.use("/api/calls", require("./routes/callRoutes"));

// --- Error handling (must be registered LAST, in this order) ---
const { notFound, errorMiddleware } = require("./middleware/errorMiddleware");
app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
