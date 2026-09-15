const mongoose = require("mongoose");

/**
 * CONVERSATION SCHEMA
 *
 * Represents either a 1-to-1 (direct) or group conversation. Both share
 * the same underlying shape — a set of members and a stream of messages —
 * so one schema with a `type` discriminator field is simpler than two
 * separate models. Messages reference a Conversation by ID regardless of
 * its type, so message queries never need to know or care which kind of
 * conversation they belong to.
 *
 * Fields:
 * - type: "direct" | "group"
 * - name: only meaningful for group conversations (a direct conversation's
 *   "name" in the UI is just the other person's name, derived on the
 *   frontend from `members`, not stored here)
 * - members: array of User ObjectIds. For "direct", always exactly 2.
 *   For "group", 2+.
 * - admin: the user who created a GROUP conversation. Only relevant for
 *   groups (e.g. only the admin can add/remove members) — null for direct.
 * - lastMessage: denormalized reference to the most recent Message, so the
 *   conversation list (sidebar) can show a preview without a separate
 *   query per conversation. This is a deliberate denormalization for
 *   read performance — see the note below.
 */
const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: [50, "Group name cannot exceed 50 characters"],
      // Only required for group conversations — enforced in a custom
      // validator below rather than a plain `required: true`, since the
      // requirement is conditional on `type`.
    },
    members: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      validate: {
        validator: function (members) {
          if (this.type === "direct") return members.length === 2;
          return members.length >= 2;
        },
        message: "Direct conversations need exactly 2 members; groups need at least 2",
      },
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  { timestamps: true }
);

// Conditional "name required for groups" validation
conversationSchema.path("name").validate(function (value) {
  if (this.type === "group") return !!value;
  return true;
}, "Group conversations require a name");

/**
 * INDEX: every "list my conversations" query filters by `members`
 * containing the current user's ID. This index makes that lookup fast
 * even as the conversations collection grows.
 */
conversationSchema.index({ members: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
