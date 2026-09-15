import api from "./api";

const getUsers = async () => {
  const res = await api.get("/users");
  return res.data.data.users;
};

const searchUsers = async (query) => {
  const res = await api.get("/users/search", { params: { q: query } });
  return res.data.data.users;
};

export default { getUsers, searchUsers };
