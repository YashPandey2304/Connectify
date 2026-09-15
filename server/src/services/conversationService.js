const Conversation = require("../models/Conversation");

/**
 * CONVERSATION SERVICE
 *
 * Holds the actual business logic for conversations, kept separate from
 * the controller (which only deals with req/res). Why does this matter
 * here specifically? Socket.IO handlers (Phase 10+) will ALSO need to
 * check "is this user a member of this conversation?" before letting them
 * join a room or send a message. Putting that logic in a service means
 * both the REST controller and the socket handler call the same function
 * instead of duplicating the membership check in two places (and risking
 * them drifting out of sync).
 */

/**
 * Finds an existing direct conversation between exactly these two users,
 * or creates a new one if none exists.
 *
 * WHY check-then-create instead of a unique compound index?
 * MongoDB indexes can't easily express "these two ObjectIds in either
 * order, only among documents where type=direct" without also storing a
 * separate sorted/canonical field. For a portfolio-scale app, an explicit
 * query is simpler to read and reason about. The trade-off: like the
 * User email case, there's a small race-condition window between the
 * check and the insert if two requests fire at the exact same instant.
 * For a chat app, the worst case is a harmless duplicate direct thread —
 * an acceptable trade-off given the simplicity gained. This is worth
 * mentioning as a known limitation in an interview.
 */
const findOrCreateDirectConversation = async (userIdA, userIdB) => {
  let conversation = await Conversation.findOne({
    type: "direct",
    members: { $all: [userIdA, userIdB], $size: 2 },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      type: "direct",
      members: [userIdA, userIdB],
    });
  }

  return conversation.populate("members", "name email profilePicture isOnline lastSeen");
};

/**
 * Creates a new group conversation.
 */
const createGroupConversation = async (creatorId, name, memberIds) => {
  // Ensure the creator is always included as a member, even if the
  // frontend forgot to add them to the member list.
  const uniqueMembers = Array.from(new Set([creatorId.toString(), ...memberIds.map(String)]));

  const conversation = await Conversation.create({
    type: "group",
    name,
    members: uniqueMembers,
    admin: creatorId,
  });

  return conversation.populate("members", "name email profilePicture isOnline lastSeen");
};

/**
 * Returns all conversations a user belongs to, most recently active first.
 */
const getUserConversations = async (userId) => {
  return Conversation.find({ members: userId })
    .populate("members", "name email profilePicture isOnline lastSeen")
    .populate("lastMessage")
    .sort({ updatedAt: -1 });
};

/**
 * Fetches a single conversation, but ONLY if the requesting user is
 * actually a member. Returns null otherwise so the controller can
 * respond with a 403/404 rather than leaking conversation data to
 * non-members.
 */
const getConversationForUser = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId).populate(
    "members",
    "name email profilePicture isOnline lastSeen"
  );

  if (!conversation) return null;

  const isMember = conversation.members.some((m) => m._id.toString() === userId.toString());
  if (!isMember) return null;

  return conversation;
};

/**
 * Adds a member to a group conversation. Only the group's admin may do
 * this — enforced here, not just hidden in the frontend UI.
 */
const addMember = async (conversationId, requesterId, newMemberId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return { error: "not_found" };
  if (conversation.type !== "group") return { error: "not_a_group" };
  if (conversation.admin.toString() !== requesterId.toString()) return { error: "not_admin" };

  if (!conversation.members.some((m) => m.toString() === newMemberId)) {
    conversation.members.push(newMemberId);
    await conversation.save();
  }

  return { conversation: await conversation.populate("members", "name email profilePicture isOnline lastSeen") };
};

/**
 * Removes a member from a group conversation. Only the admin may do this.
 */
const removeMember = async (conversationId, requesterId, memberIdToRemove) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return { error: "not_found" };
  if (conversation.type !== "group") return { error: "not_a_group" };
  if (conversation.admin.toString() !== requesterId.toString()) return { error: "not_admin" };

  conversation.members = conversation.members.filter((m) => m.toString() !== memberIdToRemove);
  await conversation.save();

  return { conversation: await conversation.populate("members", "name email profilePicture isOnline lastSeen") };
};

module.exports = {
  findOrCreateDirectConversation,
  createGroupConversation,
  getUserConversations,
  getConversationForUser,
  addMember,
  removeMember,
};
