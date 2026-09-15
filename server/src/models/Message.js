const mongoose = require("mongoose");

/**
 * MESSAGE SCHEMA
 *
 * Represents a single chat message inside a conversation.
 *
 * Fields:
 * - conversation: which Conversation this message belongs to. Every
 *   message query is scoped by this (e.g. "get all messages for
 *   conversation X"), so it's indexed below.
 * - sender: the User who sent it.
 * - content: the message text itself.
 * - messageType: "text" for now — kept as an enum so image/file
 *   attachments can be added later (Phase 7 notes) without a schema
 *   migration, just a new allowed value.
 * - readBy: array of User IDs who have seen this message — enables a
 *   simple read-receipt feature without a separate collection.
 *
 * WHY does Conversation.js reference this model via `ref: "Message"`
 * even though this file didn't exist until now?
 * Mongoose's `ref` is just a string label used at populate() time — it
 * doesn't require the referenced schema to exist yet AT DEFINITION time,
 * only by the time a populate() call actually runs. That's exactly why
 * this bug appeared: the reference was declared correctly, but the
 * Message schema itself was never registered anywhere in the app until
 * this file's module is required.
 */
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "Message content cannot be empty"],
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    messageType: {
      type: String,
      enum: ["text", "image", "file"],
      default: "text",
    },
    readBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  { timestamps: true }
);

/**
 * INDEX: nearly every message query is "give me messages for conversation
 * X, ordered by time" — this compound index makes that fast even as the
 * messages collection grows into the millions.
 */
messageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
