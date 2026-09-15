import axios from "axios";

/**
 * WHAT changed from Phase 1?
 * We now attach the JWT (read from localStorage) to every outgoing
 * request via an Axios request interceptor.
 *
 * WHY an interceptor instead of manually adding the header in every
 * service function?
 * One place to implement "attach auth" — every future service file
 * (conversationService, messageService, etc.) automatically gets
 * authenticated requests for free, with zero repeated code.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("connectify_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
