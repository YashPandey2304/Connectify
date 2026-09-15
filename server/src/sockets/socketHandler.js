const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { isConversationMember, createMessage } = require("../services/messageService");
const { getUserConversations } = require("../services/conversationService");

/**
 * SOCKET.IO SETUP AND AUTHENTICATION
 *
 * WHAT problem does this solve?
 * REST APIs are request/response — the client always asks first. Chat
 * needs the SERVER to push data to clients the moment something happens
 * (a new message, someone coming online) without the client polling
 * "anything new?" every few seconds. Socket.IO keeps a persistent,
 * two-way connection open for exactly this.
 *
 * HOW does authentication work here, and why not just trust query params?
 * Socket.IO's handshake lets the client attach an `auth` payload when
 * connecting (see SocketContext.jsx on the frontend — it sends the JWT
 * there, not as a URL query param, which could end up logged in server
 * access logs or browser history). `io.use()` registers a middleware
 * that runs once, before the connection is accepted, mirroring exactly
 * what Express's `protect` middleware does for HTTP requests: verify the
 * JWT, look up the real user, and reject the connection outright if
 * either fails — before any event handlers can even run.
 *
 * WHY track user ID -> socket ID(s) in memory?
 * When we want to send someone a message via Socket.IO, we need to know
 * which live socket connection(s) belong to them. A single user might
 * have multiple tabs/devices open, so we map to a Set of socket IDs, not
 * just one. This in-memory map is intentionally simple for a portfolio
 * project — a production system with multiple server instances would
 * need this shared via Redis instead, since each server process would
 * otherwise only know about its own local connections.
 */

// userId (string) -> Set of socket IDs currently connected for that user
const userSockets = new Map();

/**
 * Broadcasts a user's online/offline status to every conversation room
 * they belong to. We broadcast to ROOMS (not globally to every connected
 * client) for the same reason message delivery does — only sockets that
 * have that conversation open actually receive it. Someone who has this
 * user's conversation in their sidebar but not open won't see a live
 * update; they'll get the correct status next time they load it via
 * REST (where User.isOnline is already accurate in the database). This
 * mirrors the exact same documented scope boundary as Phase 11.
 */
const broadcastPresence = async (io, userId, isOnline, lastSeen) => {
  const conversations = await getUserConversations(userId);
  conversations.forEach((conversation) => {
    io.to(`conversation:${conversation._id}`).emit("user_status", {
      userId,
      isOnline,
      lastSeen,
    });
  });
};

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // --- Authentication middleware: runs once per connection attempt ---
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error("User no longer exists"));
      }

      // Attach the authenticated user to the socket so every event
      // handler below can trust socket.user without re-verifying.
      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`Socket connected: ${socket.user.name} (${socket.id})`);

    // WHY check size BEFORE adding this socket?
    // If this is the user's FIRST connected socket (no prior tabs/devices
    // open), we need to flip them online and tell their contacts. If
    // they already have another tab open, they're already marked online
    // and everyone already knows — connecting a second tab shouldn't
    // re-broadcast or redo that work.
    const isFirstConnectionForUser = !userSockets.has(userId) || userSockets.get(userId).size === 0;

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // A personal room, distinct from conversation rooms. A CALL isn't
    // tied to a conversation being open — you call a PERSON, who might
    // not have that conversation open at all right now. Joining every
    // socket to its own user:<id> room lets us target "this specific
    // person, on whichever device(s) they're connected from" without
    // needing them to have joined anything conversation-specific first.
    socket.join(`user:${userId}`);

    if (isFirstConnectionForUser) {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      await broadcastPresence(io, userId, true, null);
    }

    // Tracks which conversation rooms THIS socket has an active "typing"
    // status in — used only to clean up stuck indicators if this socket
    // disconnects mid-type (see the disconnect handler below).
    socket.typingConversations = new Set();

    /**
     * SEND_MESSAGE
     *
     * THIS is the core of real-time messaging (Phase 11). The client no
     * longer POSTs to the REST endpoint to send a message — it emits
     * this event instead. The full lifecycle, matching the spec exactly:
     *   1. Client emits send_message with { conversationId, content }
     *   2. Server verifies the socket's user is actually a member
     *      (reusing the SAME messageService function the REST layer
     *      uses — one source of truth for this check, see Phase 7 notes)
     *   3. Server saves the message to MongoDB (and updates the parent
     *      conversation's lastMessage, inside createMessage)
     *   4. Server emits "new_message" to EVERY socket in that
     *      conversation's room — including the sender's own socket,
     *      since they joined that room in Phase 10 when they opened it
     *   5. Every client's "new_message" listener updates its UI
     *
     * WHY does the sender not just update their own UI immediately
     * instead of waiting for the broadcast?
     * Waiting for the broadcast means there's exactly ONE code path that
     * ever adds a message to the UI, for everyone, sender included. If
     * the sender also appended locally, they'd see their message twice
     * the moment the broadcast arrived a few milliseconds later.
     */
    socket.on("send_message", async ({ conversationId, content }, callback) => {
      const trimmed = typeof content === "string" ? content.trim() : "";

      if (!trimmed) {
        if (callback) callback({ success: false, message: "Message content cannot be empty" });
        return;
      }

      // Mirrors the REST endpoint's express-validator rule (Phase 16) —
      // the socket path bypasses that middleware entirely, so the same
      // constraint has to be enforced here too. The Message model's own
      // schema maxlength would eventually catch this on save anyway, but
      // failing fast here avoids an unnecessary database round-trip for
      // input we already know is invalid.
      if (trimmed.length > 2000) {
        if (callback) callback({ success: false, message: "Message cannot exceed 2000 characters" });
        return;
      }

      const result = await createMessage(conversationId, userId, trimmed);

      if (result.error === "not_found" || result.error === "not_member") {
        // Same non-leaking reasoning as the REST controller: don't tell
        // a non-member whether the conversation exists or not.
        if (callback) callback({ success: false, message: "Conversation not found" });
        return;
      }

      // Broadcast to the room — this is what makes it "real-time."
      // Every socket that called socket.join(`conversation:${conversationId}`)
      // in Phase 10 receives this event immediately.
      io.to(`conversation:${conversationId}`).emit("new_message", result.message);

      if (callback) callback({ success: true, message: result.message });
    });

    /**
     * JOIN_CONVERSATION
     *
     * A client emits this when the user opens a conversation in the UI.
     * We verify membership again here — never trust that a client only
     * asks to join rooms it's actually allowed in.
     *
     * Room naming convention: `conversation:<conversationId>`. Example:
     * conversation ID 64abc123 becomes room "conversation:64abc123".
     * Once joined, io.to("conversation:64abc123").emit(...) reaches only
     * sockets that called socket.join() on that exact room name.
     */
    socket.on("join_conversation", async (conversationId, callback) => {
      const { isMember } = await isConversationMember(conversationId, userId);

      if (!isMember) {
        if (callback) callback({ success: false, message: "Not a member of this conversation" });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      if (callback) callback({ success: true });
    });

    /**
     * LEAVE_CONVERSATION
     *
     * A client emits this when the user closes/switches away from a
     * conversation, so the socket stops receiving events for rooms it's
     * no longer actively viewing. Not strictly required for correctness
     * (a socket could stay in every room it ever joined), but it keeps
     * room membership accurate and avoids unnecessary event delivery.
     */
    socket.on("leave_conversation", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    /**
     * TYPING / STOP_TYPING
     *
     * Purely ephemeral, in-memory events — nothing about typing status
     * is ever written to MongoDB. There's no value in persisting "user X
     * was typing at 3:04pm"; it's stale information within seconds, so
     * this is a good contrast against messages/presence which DO need
     * a database record.
     *
     * WHY socket.to(room) here instead of io.to(room) like send_message
     * uses?
     * `io.to(room)` broadcasts to every socket in the room, INCLUDING the
     * sender. `socket.to(room)` broadcasts to everyone in the room
     * EXCEPT the sender. You already know you're typing — there's no
     * reason to send that event back to yourself.
     */
    socket.on("typing", (conversationId) => {
      socket.typingConversations.add(conversationId);
      socket.to(`conversation:${conversationId}`).emit("user_typing", {
        userId,
        conversationId,
      });
    });

    socket.on("stop_typing", (conversationId) => {
      socket.typingConversations.delete(conversationId);
      socket.to(`conversation:${conversationId}`).emit("user_stopped_typing", {
        userId,
        conversationId,
      });
    });

    /**
     * VOICE CALL SIGNALING (Phase 15)
     *
     * WHAT problem does this solve?
     * WebRTC lets two browsers stream audio DIRECTLY to each other,
     * peer-to-peer — our server never touches the actual audio. But
     * before that direct connection can exist, both sides need to
     * exchange some setup information: an SDP "offer"/"answer" (what
     * audio codecs each side supports, etc.) and ICE candidates
     * (possible network paths to reach each browser). That exchange has
     * to happen through SOME already-working channel — that's exactly
     * what our existing Socket.IO connection is used for here. This is
     * called "signaling," and it's the only part of a WebRTC call that
     * touches our backend at all.
     *
     * CALL_USER: the caller has created an SDP offer locally and sends
     * it here. We verify the caller is actually a member of the given
     * DIRECT conversation (reusing isConversationMember — same
     * authorization pattern as messages), find the other member as the
     * callee, and relay the offer to that person's personal room.
     */
    socket.on("call_user", async ({ conversationId, offer, callType }, callback) => {
      const { conversation, isMember } = await isConversationMember(conversationId, userId);

      if (!conversation || !isMember || conversation.type !== "direct") {
        if (callback) callback({ success: false, message: "Cannot start this call" });
        return;
      }

      const calleeId = conversation.members
        .find((m) => m.toString() !== userId)
        ?.toString();

      io.to(`user:${calleeId}`).emit("incoming_call", {
        conversationId,
        offer,
        callType: callType === "video" ? "video" : "voice", // default defensively to voice
        fromUserId: userId,
        fromUserName: socket.user.name,
      });

      if (callback) callback({ success: true });
    });

    /**
     * ANSWER_CALL: the callee accepted, created an SDP answer locally,
     * and sends it here. We relay it straight back to the original
     * caller so their browser can complete the connection setup.
     */
    socket.on("answer_call", ({ toUserId, answer }) => {
      io.to(`user:${toUserId}`).emit("call_answered", {
        answer,
        fromUserId: userId,
      });
    });

    /**
     * ICE_CANDIDATE: WebRTC discovers possible network paths
     * incrementally, sending each one as it's found (rather than all at
     * once). Both sides relay every candidate they discover to the
     * other, throughout call setup.
     */
    socket.on("ice_candidate", ({ toUserId, candidate }) => {
      io.to(`user:${toUserId}`).emit("ice_candidate", {
        candidate,
        fromUserId: userId,
      });
    });

    socket.on("reject_call", ({ toUserId }) => {
      io.to(`user:${toUserId}`).emit("call_rejected", { fromUserId: userId });
    });

    socket.on("end_call", ({ toUserId }) => {
      io.to(`user:${toUserId}`).emit("call_ended", { fromUserId: userId });
    });

    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: ${socket.user.name} (${socket.id})`);

      // Clean up any "typing..." indicators this socket left active — a
      // hard disconnect (closed tab, lost connection) never gets a
      // chance to fire stop_typing itself, so without this, the other
      // person would see a stuck "typing..." indicator indefinitely.
      socket.typingConversations.forEach((conversationId) => {
        socket.to(`conversation:${conversationId}`).emit("user_stopped_typing", {
          userId,
          conversationId,
        });
      });

      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);

          // Only NOW — the user's LAST active socket just closed — do we
          // mark them offline. If they still have another tab/device
          // connected, `sockets.size` would be > 0 here and we'd skip
          // this entirely, exactly matching the spec's requirement to
          // never blindly mark a user offline while another session
          // is still active.
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
          await broadcastPresence(io, userId, false, lastSeen);
        }
      }
    });
  });

  return io;
};

module.exports = { initSocket, userSockets };
