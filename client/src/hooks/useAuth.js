import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * Small wrapper hook so components write:
 *   const { user, login } = useAuth();
 * instead of:
 *   const { user, login } = useContext(AuthContext);
 *
 * Also gives us one place to throw a helpful error if someone forgets
 * to wrap their component tree in <AuthProvider>, instead of a cryptic
 * "cannot read property 'user' of null" error.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
