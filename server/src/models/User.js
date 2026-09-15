const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * USER SCHEMA
 *
 * Represents a registered Connectify user.
 *
 * Fields explained:
 * - name: display name shown in the UI (conversation lists, message bubbles)
 * - email: used as the login identifier. Unique + lowercase-normalized so
 *   "Bob@Example.com" and "bob@example.com" are treated as the same account.
 * - password: bcrypt HASH only, never plaintext. `select: false` means it's
 *   excluded from query results by default — you must explicitly opt in
 *   with `.select("+password")` (we'll do this in the login controller).
 * - profilePicture: URL/path to an avatar image. Defaults to empty string;
 *   the frontend falls back to initials-based avatars when empty.
 * - isOnline / lastSeen: presence fields. isOnline is a live flag flipped by
 *   the Socket.IO connect/disconnect handlers (Phase 13). lastSeen records
 *   the timestamp of the most recent disconnect, so the UI can show
 *   "last seen 5 minutes ago" instead of just "offline".
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // never returned by default in queries
    },
    profilePicture: {
      type: String,
      default: "",
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

/**
 * INDEX
 * `unique: true` on the email field above already creates a unique index
 * on { email: 1 } — we don't declare it again here with schema.index(),
 * since doing both triggers a "duplicate schema index" warning at startup.
 * This IS the index that makes login lookups (User.findOne({ email }))
 * fast even as the users collection grows.
 */

/**
 * PRE-SAVE HOOK: hash the password before it's ever written to the DB.
 *
 * WHY check `isModified("password")`?
 * Without this check, every time a user document is saved for ANY reason
 * (e.g., updating `isOnline` status on every socket connect/disconnect),
 * we'd re-hash the already-hashed password — corrupting it and breaking
 * login. This guard ensures hashing only happens when the password field
 * itself was actually changed.
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * INSTANCE METHOD: compare a plaintext candidate password against the
 * stored hash. Used during login.
 *
 * WHY put this on the model instead of the controller?
 * Keeps bcrypt-specific logic co-located with the schema that owns the
 * password field — the controller just calls `user.comparePassword(pw)`
 * without needing to know bcrypt is even involved. This is a small
 * example of encapsulation: the model owns how its own data is validated.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * INSTANCE METHOD: return a safe, public-facing version of the user.
 * Used whenever we send user data back to the client (auth responses,
 * search results, conversation member lists) so we never leak the
 * password hash even if a query forgot to exclude it.
 */
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    profilePicture: this.profilePicture,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
