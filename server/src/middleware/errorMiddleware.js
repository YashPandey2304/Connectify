/**
 * CENTRALIZED ERROR MIDDLEWARE
 *
 * Express recognizes an error-handling middleware by its 4 arguments
 * (err, req, res, next). Any error thrown inside an asyncHandler-wrapped
 * controller ends up here via next(error).
 *
 * WHY centralize this instead of try/catch + res.json in every controller?
 * - One consistent response shape across the entire API: { success: false, message }
 * - One place to decide what's safe to expose to the client vs. what to
 *   only log server-side (we never want to leak a raw MongoDB stack trace
 *   or connection string to a user).
 * - Controllers stay focused on business logic, not response formatting.
 */
const errorMiddleware = (err, req, res, next) => {
  console.error(err.stack);

  // If a controller set a specific status code via res.status(400) before
  // throwing, respect it. Otherwise default to 500 (unexpected server error).
  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || "Server error";

  // Mongoose-specific error translations, so raw driver errors never leak.
  if (err.name === "CastError") {
    // Happens when an invalid MongoDB ObjectId is passed in a route param,
    // e.g. GET /api/users/not-a-real-id
    statusCode = 400;
    message = "Invalid ID format";
  }

  if (err.code === 11000) {
    // MongoDB duplicate key error (race-condition fallback for unique email)
    statusCode = 409;
    message = "Duplicate value entered for a unique field";
  }

  if (err.name === "ValidationError") {
    // Mongoose schema validation failure (required/minlength/match, etc.)
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Stack traces only in development — never expose them in production
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

/**
 * 404 handler for routes that don't match anything — must be registered
 * AFTER all real routes but BEFORE errorMiddleware.
 */
const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
};

module.exports = { errorMiddleware, notFound };
