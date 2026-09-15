import api from "./api";

const getConversations = async () => {
  const res = await api.get("/conversations");
  return res.data.data.conversations;
};

const getConversationById = async (id) => {
  const res = await api.get(`/conversations/${id}`);
  return res.data.data.conversation;
};

const startDirectConversation = async (recipientId) => {
  const res = await api.post("/conversations", { type: "direct", recipientId });
  return res.data.data.conversation;
};

const createGroupConversation = async (name, memberIds) => {
  const res = await api.post("/conversations", { type: "group", name, memberIds });
  return res.data.data.conversation;
};

const addMember = async (conversationId, memberId) => {
  const res = await api.post(`/conversations/${conversationId}/members`, { memberId });
  return res.data.data.conversation;
};

const removeMember = async (conversationId, memberId) => {
  const res = await api.delete(`/conversations/${conversationId}/members/${memberId}`);
  return res.data.data.conversation;
};

export default {
  getConversations,
  getConversationById,
  startDirectConversation,
  createGroupConversation,
  addMember,
  removeMember,
};
