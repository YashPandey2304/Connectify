import api from "./api";

/**
 * All auth-related API calls live here, isolated from components.
 * Components/context call these functions; they never call axios directly.
 * This means if our API shape ever changes, we fix it in ONE file.
 */

const register = async (name, email, password) => {
  const res = await api.post("/auth/register", { name, email, password });
  return res.data.data; // { user, token }
};

const login = async (email, password) => {
  const res = await api.post("/auth/login", { email, password });
  return res.data.data; // { user, token }
};

const logout = async () => {
  const res = await api.post("/auth/logout");
  return res.data;
};

const getMe = async () => {
  const res = await api.get("/auth/me");
  return res.data.data.user;
};

export default { register, login, logout, getMe };
