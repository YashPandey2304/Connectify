require("dotenv").config();
const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");

/**
 * STARTUP SAFETY CHECK
 *
 * This exists because of a real mistake that's easy to make: copying
 * .env.example to .env and forgetting to actually replace placeholder
 * values like JWT_SECRET. A placeholder secret is PUBLIC — it's sitting
 * in this very codebase — so anyone who's seen this project could forge
 * a valid login token for any user, for any account, without ever
 * knowing a password. Rather than relying on remembering to change it,
 * the server now refuses to start at all with an unsafe secret.
 */
const PLACEHOLDER_SECRETS = ["replace_with_a_long_random_secret", "your_secret", "secret"];

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error(
    "FATAL: JWT_SECRET is missing or too short. Generate one with:\n" +
      "  node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"\n" +
      "and set it in server/.env before starting the server."
  );
  process.exit(1);
}

if (PLACEHOLDER_SECRETS.includes(process.env.JWT_SECRET)) {
  console.error(
    "FATAL: JWT_SECRET is still set to a placeholder value from .env.example. " +
      "This is a real security vulnerability — replace it with a random secret before starting the server."
  );
  process.exit(1);
}

// Registers every Mongoose schema up front — see models/index.js for why
// this matters (populate() calls need referenced models registered).
require("./models");

/**
 * WHAT is this file?
 * The single entry point for the backend. It:
 *   1. Loads environment variables
 *   2. Connects to MongoDB
 *   3. Wraps the Express app in a raw Node http.Server
 *      (Socket.IO needs to attach to the same http.Server instance
 *       Express uses — this is why we don't just call app.listen()
 *       directly once Socket.IO is added in Phase 10)
 *   4. Starts listening
 */

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Attaches Socket.IO to the SAME http.Server instance Express uses —
// this is exactly why server.js wraps app in http.createServer() instead
// of calling app.listen() directly (see the Phase 1 notes on this).
const { initSocket } = require("./sockets/socketHandler");
initSocket(server);

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Connectify server running on port ${PORT}`);
  });
};

startServer();
