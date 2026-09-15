const mongoose = require("mongoose");

/**
 * Connects to MongoDB using the connection string in MONGO_URI.
 *
 * WHY a separate config file?
 * Keeping DB connection logic out of server.js means:
 *  - server.js stays focused on "start the HTTP/socket server"
 *  - we can unit-test or swap the DB layer without touching server startup code
 *  - it's the pattern real Node backends use (separation of concerns)
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // Exit the process — there is no point running an API server
    // that can't reach its database.
    process.exit(1);
  }
};

module.exports = connectDB;
