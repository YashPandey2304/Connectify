import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import { useCall } from "../hooks/useCall";
import conversationService from "../services/conversationService";
import messageService from "../services/messageService";
import Avatar from "../components/common/Avatar";
import ConversationList from "../components/conversation/ConversationList";
import NewConversationSearch from "../components/conversation/NewConversationSearch";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";
import TypingIndicator from "../components/chat/TypingIndicator";
import NewGroupModal from "../components/conversation/NewGroupModal";
import GroupInfoPanel from "../components/conversation/GroupInfoPanel";
import "./Chat.css";

/**
 * Chat.jsx is the orchestrator: it owns the state that multiple child
 * components need to share (which conversation is active, the message
 * list for it) and passes data + callbacks down. The children themselves
 * stay "dumb" — they render what they're given and report events upward,
 * rather than each fetching their own data independently.
 *
 * NOTE: this phase is REST-only. Sending a message updates the current
 * user's own view immediately, but another logged-in user in a different
 * browser won't see it appear until Socket.IO is wired up in Phase 10/11.
 */
export default function Chat() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const { startCall } = useCall();

  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [mobileView, setMobileView] = useState("list"); // "list" | "chat" — mobile only

  // Set of user IDs currently typing in the ACTIVE conversation only —
  // we only receive these events for whichever room we're currently
  // joined to, so there's no need to key this by conversation ID.
  const [typingUserIds, setTypingUserIds] = useState(new Set());

  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const loadConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const data = await conversationService.getConversations();
      setConversations(data);
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /**
   * Joins the Socket.IO room for whichever conversation is currently
   * open, and leaves the previous one — so this socket only receives
   * real-time events for the conversation actually on screen. Runs
   * whenever `activeConversation` OR `socket` changes (the socket won't
   * exist yet on the very first render, before SocketContext connects).
   */
  useEffect(() => {
    if (!socket || !activeConversation) return;

    setTypingUserIds(new Set()); // reset when switching conversations

    socket.emit("join_conversation", activeConversation._id, (response) => {
      if (!response?.success) {
        console.error("Failed to join conversation room:", response?.message);
      }
    });

    return () => {
      socket.emit("leave_conversation", activeConversation._id);
    };
  }, [socket, activeConversation]);

  /**
   * REAL-TIME MESSAGE LISTENER (Phase 11)
   *
   * This is the piece that was missing before: without this listener,
   * messages only ever appeared for whoever sent them (via the old REST
   * response), never for the other person in the conversation.
   *
   * Re-subscribes whenever `activeConversation` changes so the closure
   * inside `handleNewMessage` always compares against the CURRENT active
   * conversation, not a stale one captured on first render.
   */
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      if (message.conversation === activeConversation?._id) {
        setMessages((prev) => [...prev, message]);
      }
      // Refresh the sidebar so lastMessage previews stay current — this
      // only reflects conversations this socket is currently in a room
      // for (i.e. the one open right now). A conversation you're NOT
      // currently viewing won't live-update its preview until Phase 13
      // extends room membership — a known, documented scope boundary.
      loadConversations();
    };

    socket.on("new_message", handleNewMessage);
    return () => socket.off("new_message", handleNewMessage);
  }, [socket, activeConversation, loadConversations]);

  /**
   * PRESENCE LISTENER (Phase 12)
   *
   * Updates the `isOnline`/`lastSeen` fields on whichever conversation
   * member this event is about — in BOTH the sidebar list and the
   * currently active conversation, since either or both might contain
   * that user. We use functional state updates (`prev => ...`) instead
   * of reading `conversations`/`activeConversation` from the outer
   * closure, which means this effect doesn't need either in its
   * dependency array and only needs to subscribe once per socket
   * instance rather than re-subscribing on every conversation switch.
   */
  useEffect(() => {
    if (!socket) return;

    const handleUserStatus = ({ userId, isOnline, lastSeen }) => {
      const updateMembers = (conversation) => ({
        ...conversation,
        members: conversation.members.map((member) =>
          member._id === userId ? { ...member, isOnline, lastSeen } : member
        ),
      });

      setConversations((prev) => prev.map(updateMembers));
      setActiveConversation((prev) => (prev ? updateMembers(prev) : prev));
    };

    socket.on("user_status", handleUserStatus);
    return () => socket.off("user_status", handleUserStatus);
  }, [socket]);

  /**
   * TYPING INDICATOR LISTENER (Phase 13)
   *
   * Only meaningful for the currently active conversation — we only
   * receive these events for the one room we're joined to anyway, but
   * we also double-check conversationId to be safe against any brief
   * overlap during a room switch.
   */
  useEffect(() => {
    if (!socket) return;

    const handleTypingStart = ({ userId, conversationId }) => {
      if (conversationId !== activeConversation?._id) return;
      setTypingUserIds((prev) => new Set(prev).add(userId));
    };

    const handleTypingStop = ({ userId, conversationId }) => {
      if (conversationId !== activeConversation?._id) return;
      setTypingUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    socket.on("user_typing", handleTypingStart);
    socket.on("user_stopped_typing", handleTypingStop);
    return () => {
      socket.off("user_typing", handleTypingStart);
      socket.off("user_stopped_typing", handleTypingStop);
    };
  }, [socket, activeConversation]);

  const handleSelectConversation = async (conversation) => {
    setActiveConversation(conversation);
    setMobileView("chat");
    setMessagesLoading(true);
    try {
      const data = await messageService.getMessages(conversation._id);
      setMessages(data);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSelectUser = async (targetUser) => {
    const conversation = await conversationService.startDirectConversation(targetUser._id);
    await loadConversations();
    handleSelectConversation(conversation);
  };

  /**
   * Sends via Socket.IO, not REST. We deliberately do NOT call
   * setMessages here — the message will arrive back through the
   * "new_message" listener above (since our own socket is in the room),
   * which is what prevents the sender from seeing their own message
   * twice. See the socketHandler.js comments for the full reasoning.
   */
  const handleSend = (content) => {
    if (!socket || !activeConversation) return;

    socket.emit(
      "send_message",
      { conversationId: activeConversation._id, content },
      (response) => {
        if (!response?.success) {
          console.error("Failed to send message:", response?.message);
        }
      }
    );
  };

  const handleTyping = () => {
    if (!socket || !activeConversation) return;
    socket.emit("typing", activeConversation._id);
  };

  const handleStopTyping = () => {
    if (!socket || !activeConversation) return;
    socket.emit("stop_typing", activeConversation._id);
  };

  /**
   * Creates the group, then immediately opens it — same pattern as
   * handleSelectUser for direct conversations. Throws on failure so
   * NewGroupModal's own try/catch can show the error inline rather than
   * this component needing to know about the modal's internal state.
   */
  const handleCreateGroup = async (name, memberIds) => {
    const conversation = await conversationService.createGroupConversation(name, memberIds);
    await loadConversations();
    setShowNewGroupModal(false);
    handleSelectConversation(conversation);
  };

  const handleAddMember = async (memberId) => {
    const updated = await conversationService.addMember(activeConversation._id, memberId);
    setActiveConversation(updated);
    loadConversations();
  };

  const handleRemoveMember = async (memberId) => {
    const updated = await conversationService.removeMember(activeConversation._id, memberId);
    setActiveConversation(updated);
    loadConversations();
  };

  const handleStartVoiceCall = () => {
    if (!activeConversation || activeConversation.type !== "direct") return;
    const other = activeConversation.members.find((m) => m._id !== user?.id);
    if (!other) return;
    startCall(activeConversation._id, other._id, other.name, "voice");
  };

  const handleStartVideoCall = () => {
    if (!activeConversation || activeConversation.type !== "direct") return;
    const other = activeConversation.members.find((m) => m._id !== user?.id);
    if (!other) return;
    startCall(activeConversation._id, other._id, other.name, "video");
  };

  return (
    <div className="chat-layout">
      <aside className={`chat-sidebar ${mobileView === "list" ? "" : "mobile-hidden"}`}>
        <div className="chat-sidebar-header">
          <div className="chat-current-user">
            <Avatar name={user?.name} profilePicture={user?.profilePicture} size={36} />
            <span className="chat-current-user-name">{user?.name}</span>
          </div>
          <button className="chat-logout-btn" onClick={logout} title="Log out">
            Log out
          </button>
        </div>

        <button className="chat-new-group-btn" onClick={() => setShowNewGroupModal(true)}>
          + New group
        </button>

        <NewConversationSearch onSelectUser={handleSelectUser} />

        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversation?._id}
          currentUserId={user?.id}
          onSelect={handleSelectConversation}
          loading={conversationsLoading}
        />
      </aside>

      <main className={`chat-main ${mobileView === "chat" ? "" : "mobile-hidden"}`}>
        {activeConversation ? (
          <>
            <div className="chat-main-header">
              <button className="chat-back-btn" onClick={() => setMobileView("list")}>
                &larr;
              </button>
              <ChatHeader
                conversation={activeConversation}
                currentUserId={user?.id}
                onClick={() => setShowGroupInfo(true)}
                onVoiceCall={handleStartVoiceCall}
                onVideoCall={handleStartVideoCall}
              />
            </div>
            <MessageList messages={messages} currentUserId={user?.id} loading={messagesLoading} />
            <TypingIndicator text={getTypingText(activeConversation, typingUserIds, user?.id)} />
            <MessageInput
              onSend={handleSend}
              onTyping={handleTyping}
              onStopTyping={handleStopTyping}
              disabled={messagesLoading}
            />
          </>
        ) : (
          <div className="chat-empty-state">
            <p>Select a conversation or search for someone to start chatting.</p>
          </div>
        )}
      </main>

      {showNewGroupModal && (
        <NewGroupModal onClose={() => setShowNewGroupModal(false)} onCreate={handleCreateGroup} />
      )}

      {showGroupInfo && activeConversation?.type === "group" && (
        <GroupInfoPanel
          conversation={activeConversation}
          currentUserId={user?.id}
          onClose={() => setShowGroupInfo(false)}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
        />
      )}
    </div>
  );
}

/**
 * Turns a Set of typing user IDs into a readable string, e.g.
 * "Bob is typing..." or "Bob and Carol are typing..." for a group.
 * Excludes the current user defensively (shouldn't normally be in the
 * set at all, since socket.to() excludes the sender server-side — but
 * this keeps the UI correct even if that ever changes).
 */
function getTypingText(conversation, typingUserIds, currentUserId) {
  if (!conversation || typingUserIds.size === 0) return null;

  const typingNames = conversation.members
    .filter((m) => typingUserIds.has(m._id) && m._id !== currentUserId)
    .map((m) => m.name);

  if (typingNames.length === 0) return null;
  if (typingNames.length === 1) return `${typingNames[0]} is typing...`;
  if (typingNames.length === 2) return `${typingNames[0]} and ${typingNames[1]} are typing...`;
  return "Several people are typing...";
}
