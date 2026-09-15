const asyncHandler = require("../utils/asyncHandler");
const messageService = require("../services/messageService");

/**
 * @desc    Send a message in a conversation
 * @route   POST /api/conversations/:conversationId/messages
 * @access  Private (members only)
 */
const sendMessage = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const { conversationId } = req.params;

  if (!content || !content.trim()) {
    res.status(400);
    throw new Error("Message content cannot be empty");
  }

  const result = await messageService.createMessage(conversationId, req.user._id, content.trim());

  if (result.error === "not_found") {
    res.status(404);
    throw new Error("Conversation not found");
  }
  if (result.error === "not_member") {
    // Same "don't leak existence" reasoning as conversationController —
    // a non-member gets the same 404 as a truly nonexistent conversation.
    res.status(404);
    throw new Error("Conversation not found");
  }

  res.status(201).json({ success: true, data: { message: result.message } });
});

/**
 * @desc    Get messages for a conversation (paginated)
 * @route   GET /api/conversations/:conversationId/messages?before=<id>&limit=30
 * @access  Private (members only)
 */
const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { before, limit } = req.query;

  const result = await messageService.getMessagesForConversation(conversationId, req.user._id, {
    before,
    limit,
  });

  if (result.error === "not_found" || result.error === "not_member") {
    res.status(404);
    throw new Error("Conversation not found");
  }

  res.status(200).json({ success: true, data: { messages: result.messages } });
});

module.exports = { sendMessage, getMessages };
