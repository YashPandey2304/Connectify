import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * PROTECTED ROUTE
 *
 * Wraps any route that requires authentication. This is where the
 * "loading" flag from AuthContext actually gets used to avoid the
 * flash-of-login-page bug:
 *
 * - loading === true  -> render nothing (or a spinner) — we don't know
 *   yet whether the user is authenticated, so we must NOT redirect yet.
 * - loading === false && user exists -> render the protected page
 * - loading === false && no user -> redirect to /login
 *
 * If we skipped the loading check and just did `user ? children : <Navigate />`,
 * every refresh would render "no user" for a split second (before the
 * /me call resolves) and briefly bounce an already-logged-in user to
 * the login page.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
