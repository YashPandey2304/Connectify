import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { CallProvider } from "./context/CallContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import CallOverlay from "./components/chat/CallOverlay";

/**
 * CallProvider is nested inside SocketProvider (needs the socket for
 * signaling) and rendered alongside the routes rather than inside Chat.jsx
 * specifically — an incoming call needs to be visible/answerable no
 * matter what's currently on screen, not just while the chat page happens
 * to be mounted with a specific conversation open.
 */
function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <CallProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
          <CallOverlay />
        </CallProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
