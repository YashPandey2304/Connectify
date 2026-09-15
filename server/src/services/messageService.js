const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

/**
 * MESSAGE SERVICE
 */

/**
 * Checks whether a user is a member of a given conversation.
 * Shared by both the controller here AND, later, Socket.IO's
 * send_message handler (Phase 11) — one implementation, used everywhere
 * a message-related action needs an authorization check.
 */
const isConversationMember = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return { conversation: null, isMember: false };

  const isMember = conversation.members.some((m) => m.toString() === userId.toString());
  return { conversation, isMember };
};

/**
 * Creates a new message in a conversation, then updates that
 * conversation's `lastMessage` pointer in the same operation — so the
 * denormalized field can never drift out of sync with reality.
 */
const createMessage = async (conversationId, senderId, content) => {
  const { conversation, isMember } = await isConversationMember(conversationId, senderId);

  if (!conversation) return { error: "not_found" };
  if (!isMember) return { error: "not_member" };

  const message = await Message.create({
    conversation: conversationId,
    sender: senderId,
    content,
  });

  conversation.lastMessage = message._id;
  await conversation.save();

  return { message: await message.populate("sender", "name email profilePicture") };
};

/**
 * Fetches messages for a conversation, oldest-to-newest, with simple
 * cursor-based pagination via `before` (a message ID) + `limit`.
 *
 * WHY cursor-based pagination instead of page numbers (?page=2)?
 * Messages are constantly being inserted at the "bottom" of the list. If
 * you paginated by page number, inserting a new message would shift what
 * "page 2" means between requests, causing skipped or duplicated results.
 * Cursor-based pagination ("give me messages before this specific ID")
 * is stable regardless of how many new messages arrive in between calls —
 * the standard approach for chat/feed-style infinite scroll.
 */
const getMessagesForConversation = async (conversationId, userId, { before, limit = 30 } = {}) => {
  const { conversation, isMember } = await isConversationMember(conversationId, userId);

  if (!conversation) return { error: "not_found" };
  if (!isMember) return { error: "not_member" };

  const query = { conversation: conversationId };
  if (before) {
    // Fetch messages created strictly before the cursor message's
    // createdAt timestamp — requires looking that message up first.
    const cursorMessage = await Message.findById(before);
    if (cursorMessage) {
      query.createdAt = { $lt: cursorMessage.createdAt };
    }
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 }) // newest first for pagination...
    .limit(Number(limit))
    .populate("sender", "name email profilePicture");

  // ...then reverse to chronological order for display, since chat UIs
  // read top-to-bottom, oldest-to-newest.
  return { messages: messages.reverse() };
};

module.exports = { createMessage, getMessagesForConversation, isConversationMember };
