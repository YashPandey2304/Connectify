/**
 * Wraps an async Express route handler so that any thrown error (or
 * rejected promise) is automatically passed to next(error) — which our
 * centralized error middleware (Phase 15) will catch.
 *
 * WHY does this exist?
 * Without it, every single controller needs its own try/catch block that
 * calls next(error) manually, or Express won't know an async error
 * happened (it silently becomes an unhandled promise rejection instead of
 * a 500 response). This wrapper removes that repetition — a good example
 * of DRY (Don't Repeat Yourself) applied to error handling.
 *
 * Usage:
 *   const getMe = asyncHandler(async (req, res) => { ... });
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
