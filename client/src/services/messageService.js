import api from "./api";

const getMessages = async (conversationId, before) => {
  const params = before ? { before } : {};
  const res = await api.get(`/conversations/${conversationId}/messages`, { params });
  return res.data.data.messages;
};

const sendMessage = async (conversationId, content) => {
  const res = await api.post(`/conversations/${conversationId}/messages`, { content });
  return res.data.data.message;
};

export default { getMessages, sendMessage };
