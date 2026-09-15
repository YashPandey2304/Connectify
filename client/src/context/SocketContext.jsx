import { createContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../hooks/useAuth";

export const SocketContext = createContext(null);

const TOKEN_KEY = "connectify_token";

/**
 * SOCKET CONTEXT
 *
 * WHY one shared connection at this level, instead of each component
 * creating its own socket?
 * A Socket.IO connection is a persistent, stateful thing — opening one
 * per component that needs it would mean multiple redundant connections
 * to the same server for the same user, wasting resources on both ends
 * and complicating "did I already join this room?" bookkeeping. One
 * connection, shared via context, mirrors exactly how AuthContext shares
 * one source of truth for the current user.
 *
 * WHY connect/disconnect based on the `user` from AuthContext instead of
 * always keeping a socket open?
 * There's no reason to hold a real-time connection open for someone who
 * isn't logged in — and just as importantly, when a user logs out, we
 * MUST tear down the old socket. Otherwise a stale, still-authenticated
 * connection could keep receiving events after logout.
 */
export function SocketProvider({ children }) {
  const { user, loading } = useAuth();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Don't connect until we know for sure who's logged in (or that
    // nobody is) — same "wait for loading to resolve" principle as
    // ProtectedRoute in Phase 5.
    if (loading) return;

    if (!user) {
      // Logged out (or never logged in) — make sure any previous socket
      // is fully closed.
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      auth: { token }, // read by the server's io.use() middleware
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      // Common cause: an expired/invalid token. We don't auto-logout
      // here — a transient network blip shouldn't log someone out — but
      // this is a natural place to add reconnect-with-fresh-token logic
      // if you extend this project later.
      console.error("Socket connection error:", err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [user, loading]);

  const value = { socket: socketRef.current, connected };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
