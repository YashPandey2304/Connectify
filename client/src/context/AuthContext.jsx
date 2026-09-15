import { createContext, useState, useEffect } from "react";
import authService from "../services/authService";

const TOKEN_KEY = "connectify_token";

export const AuthContext = createContext(null);

/**
 * AUTH CONTEXT — the single source of truth for "who is logged in?"
 * across the entire app.
 *
 * WHY Context API instead of prop-drilling or Redux?
 * The current user needs to be readable from many unrelated places —
 * the chat header, the sidebar, ProtectedRoute, the message input (to
 * know whose message is "yours" for styling). Prop-drilling that through
 * every layer would be painful. Redux would work too, but for a single
 * piece of shared state like this, Context is simpler and has zero
 * extra dependencies — the right-sized tool for this job.
 *
 * THE SESSION PERSISTENCE LOGIC LIVES HERE:
 * On mount (app load / refresh), we check localStorage for a token.
 * If found, we call GET /api/auth/me to verify it's still valid and
 * fetch the current user. We track a `loading` flag so consumers
 * (specifically ProtectedRoute) know not to make redirect decisions
 * until this check has finished — this is what prevents the
 * "flash of login page" bug.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until initial check finishes

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Token exists — verify it's still valid and get fresh user data.
        // We do NOT trust a decoded/cached user object here; we ask the
        // server, since the server is the source of truth (e.g. the
        // token could be expired, or the user could no longer exist).
        const currentUser = await authService.getMe();
        setUser(currentUser);
      } catch (error) {
        // Token was invalid/expired — clean up so we don't keep retrying
        // with a dead token on every future request.
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []); // empty dependency array = runs once, on initial mount only

  const login = async (email, password) => {
    const { user: loggedInUser, token } = await authService.login(email, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (name, email, password) => {
    const { user: newUser, token } = await authService.register(name, email, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(newUser);
    return newUser;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      // Clear client-side state regardless of whether the server call
      // succeeded — the user should always be able to log out locally,
      // even if the network request fails.
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  };

  const value = { user, loading, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
