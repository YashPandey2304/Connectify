const asyncHandler = require("../utils/asyncHandler");
const conversationService = require("../services/conversationService");

/**
 * @desc    Get all conversations for the logged-in user
 * @route   GET /api/conversations
 * @access  Private
 */
const getConversations = asyncHandler(async (req, res) => {
  const conversations = await conversationService.getUserConversations(req.user._id);
  res.status(200).json({ success: true, data: { conversations } });
});

/**
 * @desc    Create a conversation (direct or group)
 * @route   POST /api/conversations
 * @access  Private
 * @body    For direct: { type: "direct", recipientId }
 *          For group:  { type: "group", name, memberIds: [...] }
 */
const createConversation = asyncHandler(async (req, res) => {
  const { type, recipientId, name, memberIds } = req.body;

  if (type === "direct") {
    if (!recipientId) {
      res.status(400);
      throw new Error("recipientId is required to start a direct conversation");
    }
    if (recipientId === req.user._id.toString()) {
      res.status(400);
      throw new Error("You cannot start a conversation with yourself");
    }

    const conversation = await conversationService.findOrCreateDirectConversation(
      req.user._id,
      recipientId
    );
    return res.status(200).json({ success: true, data: { conversation } });
  }

  if (type === "group") {
    if (!name || !memberIds || memberIds.length < 1) {
      res.status(400);
      throw new Error("Group conversations require a name and at least one other member");
    }

    const conversation = await conversationService.createGroupConversation(
      req.user._id,
      name,
      memberIds
    );
    return res.status(201).json({ success: true, data: { conversation } });
  }

  res.status(400);
  throw new Error("type must be 'direct' or 'group'");
});

/**
 * @desc    Get a single conversation by ID
 * @route   GET /api/conversations/:id
 * @access  Private (members only)
 */
const getConversationById = asyncHandler(async (req, res) => {
  const conversation = await conversationService.getConversationForUser(
    req.params.id,
    req.user._id
  );

  if (!conversation) {
    // We deliberately return the SAME 404 whether the conversation truly
    // doesn't exist or the user just isn't a member — see the note in
    // authController about not leaking information via different error
    // responses. A non-member shouldn't be able to distinguish "doesn't
    // exist" from "exists but I can't see it."
    res.status(404);
    throw new Error("Conversation not found");
  }

  res.status(200).json({ success: true, data: { conversation } });
});

/**
 * @desc    Add a member to a group conversation
 * @route   POST /api/conversations/:id/members
 * @access  Private (group admin only)
 */
const addMember = asyncHandler(async (req, res) => {
  const { memberId } = req.body;
  if (!memberId) {
    res.status(400);
    throw new Error("memberId is required");
  }

  const result = await conversationService.addMember(req.params.id, req.user._id, memberId);
  handleMemberMutationResult(result, res);
});

/**
 * @desc    Remove a member from a group conversation
 * @route   DELETE /api/conversations/:id/members/:userId
 * @access  Private (group admin only)
 */
const removeMember = asyncHandler(async (req, res) => {
  const result = await conversationService.removeMember(
    req.params.id,
    req.user._id,
    req.params.userId
  );
  handleMemberMutationResult(result, res);
});

/**
 * Shared error-mapping for the two member-mutation endpoints above —
 * avoids duplicating the same if/else chain twice.
 */
function handleMemberMutationResult(result, res) {
  if (result.error === "not_found") {
    res.status(404);
    throw new Error("Conversation not found");
  }
  if (result.error === "not_a_group") {
    res.status(400);
    throw new Error("Members can only be added to or removed from group conversations");
  }
  if (result.error === "not_admin") {
    res.status(403);
    throw new Error("Only the group admin can manage members");
  }
  res.status(200).json({ success: true, data: { conversation: result.conversation } });
}

module.exports = {
  getConversations,
  createConversation,
  getConversationById,
  addMember,
  removeMember,
};
