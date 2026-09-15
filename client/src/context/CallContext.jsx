import { createContext, useState, useRef, useEffect, useCallback } from "react";
import { useSocket } from "../hooks/useSocket";
import callService from "../services/callService";

export const CallContext = createContext(null);

/**
 * Used only as a last-resort fallback if the backend's TURN-credential
 * endpoint itself is unreachable (network error, backend down) — NOT
 * the normal path. The normal path fetches fresh ICE servers (including
 * short-lived TURN credentials minted by Cloudflare) from our own
 * backend right before each call — see fetchIceServers() below and
 * server/src/services/turnService.js for why this has to be server-side.
 */
const FALLBACK_STUN_ONLY = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/**
 * Turns a getUserMedia rejection into a message a non-technical user can
 * actually act on, instead of a raw DOMException. Distinguishing
 * "permission denied" from "no device found" matters because the fix is
 * different for each (check browser settings vs. plug in a mic/camera).
 */
function getMediaErrorMessage(error) {
  if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
    return "Camera/microphone permission was denied. Check your browser's site settings.";
  }
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return "No camera or microphone was found on this device.";
  }
  return "Could not access your camera/microphone.";
}

/**
 * CALL STATES: "idle" | "calling" | "ringing" | "in-call" | "failed"
 * CALL TYPES:  "voice" | "video"
 *
 * "failed" is DISTINCT from a normal decline/hangup — it exists
 * specifically so a network/permission failure doesn't look identical to
 * the other person simply declining. Without this, a failed connection
 * silently resets straight to "idle", which is indistinguishable from a
 * decline from the user's point of view — exactly the confusing bug this
 * state fixes.
 */
export function CallProvider({ children }) {
  const { socket } = useSocket();

  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState("voice");
  const [remoteUserName, setRemoteUserName] = useState(null);
  const [callError, setCallError] = useState(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const otherUserIdRef = useRef(null);
  const conversationIdRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCallTypeRef = useRef("voice");
  const failureTimeoutRef = useRef(null);

  // ICE CANDIDATE QUEUE: WebRTC requires setRemoteDescription() to
  // complete before addIceCandidate() calls for that connection can
  // succeed. But candidates can arrive over the socket before that
  // exchange finishes — especially with real network latency (unlike
  // two tabs on one machine, which is why this bug is easy to miss
  // testing locally). Candidates that arrive too early get queued here
  // instead of failing, then flushed the moment the remote description
  // is actually set.
  const iceQueueRef = useRef([]);
  const remoteDescSetRef = useRef(false);

  /**
   * `reason`, when provided, means "this ended because something went
   * wrong" rather than a normal hangup/decline. In that case we show a
   * brief "failed" state with a message instead of jumping straight to
   * silent idle, then auto-return to idle after a few seconds.
   */
  const cleanup = useCallback((reason) => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

    otherUserIdRef.current = null;
    conversationIdRef.current = null;
    pendingOfferRef.current = null;
    iceQueueRef.current = [];
    remoteDescSetRef.current = false;

    clearTimeout(failureTimeoutRef.current);

    if (reason) {
      setCallError(reason);
      setCallState("failed");
      failureTimeoutRef.current = setTimeout(() => {
        setCallState("idle");
        setCallError(null);
        setRemoteUserName(null);
      }, 4000);
    } else {
      setCallState("idle");
      setCallError(null);
      setRemoteUserName(null);
    }
  }, []);

  /**
   * Called immediately after setRemoteDescription succeeds, in BOTH
   * acceptCall (callee side) and handleCallAnswered (caller side) — the
   * only two places a remote description gets set. Any candidates that
   * arrived and were queued before that point get applied now, in order.
   */
  const flushIceQueue = useCallback(async () => {
    remoteDescSetRef.current = true;
    const queued = iceQueueRef.current;
    iceQueueRef.current = [];

    for (const candidate of queued) {
      try {
        await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Failed to add queued ICE candidate:", error);
      }
    }
  }, []);

  /**
   * Asks OUR backend for fresh ICE servers — which internally means
   * fresh, short-lived Cloudflare TURN credentials (or STUN-only if
   * Cloudflare isn't configured server-side). Called right before EVERY
   * call attempt (both starting and accepting), rather than once and
   * cached, since short-lived credentials are the whole point of using
   * Cloudflare's model — a credential fetched when the app first loaded
   * could easily have expired by the time someone actually starts a
   * call an hour later.
   */
  const fetchIceServers = useCallback(async () => {
    try {
      const result = await callService.getIceServers();
      return { iceServers: result.iceServers };
    } catch (error) {
      console.error("Failed to fetch TURN credentials from backend, falling back to STUN-only:", error);
      return FALLBACK_STUN_ONLY;
    }
  }, []);

  const createPeerConnection = useCallback(
    (otherUserId, type, iceServers) => {
      const pc = new RTCPeerConnection(iceServers);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice_candidate", { toUserId: otherUserId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        if (type === "video") {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
        } else if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      /**
       * WHY distinguish "failed" from "disconnected"/"closed" here?
       * "closed" happens on every normal hangup (we call pc.close()
       * ourselves in cleanup) — that's expected and shouldn't show an
       * error. "failed" specifically means ICE could not establish or
       * maintain a connection at all — exactly the symptom of two
       * networks that STUN alone couldn't bridge. That's the case that
       * deserves a visible message instead of silently vanishing.
       */
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          cleanup("Call failed — could not establish a connection. Check your network and try again.");
        } else if (["disconnected", "closed"].includes(pc.connectionState)) {
          cleanup();
        }
      };

      return pc;
    },
    [socket, cleanup]
  );

  const startCall = useCallback(
    async (conversationId, calleeId, calleeName, type = "voice") => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === "video",
        });
      } catch (error) {
        console.error(`getUserMedia failed for ${type} call:`, error);
        setRemoteUserName(calleeName);
        cleanup(getMediaErrorMessage(error));
        return;
      }

      try {
        localStreamRef.current = stream;
        if (type === "video" && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const iceServers = await fetchIceServers();
        const pc = createPeerConnection(calleeId, type, iceServers);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        peerConnectionRef.current = pc;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        otherUserIdRef.current = calleeId;
        conversationIdRef.current = conversationId;
        setRemoteUserName(calleeName);
        setCallType(type);
        setCallState("calling");

        socket.emit("call_user", { conversationId, offer, callType: type }, (response) => {
          if (!response?.success) {
            cleanup(response?.message || "Could not reach that user.");
          }
        });
      } catch (error) {
        console.error(`Could not start ${type} call:`, error);
        cleanup("Could not start the call. Please try again.");
      }
    },
    [socket, createPeerConnection, cleanup, fetchIceServers]
  );

  const acceptCall = useCallback(async () => {
    const type = pendingCallTypeRef.current;
    let stream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });
    } catch (error) {
      console.error("getUserMedia failed while accepting call:", error);
      socket.emit("reject_call", { toUserId: otherUserIdRef.current });
      cleanup(getMediaErrorMessage(error));
      return;
    }

    try {
      localStreamRef.current = stream;
      if (type === "video" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const iceServers = await fetchIceServers();
      const pc = createPeerConnection(otherUserIdRef.current, type, iceServers);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      peerConnectionRef.current = pc;

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      await flushIceQueue();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer_call", { toUserId: otherUserIdRef.current, answer });
      setCallState("in-call");
    } catch (error) {
      console.error("Could not accept call:", error);
      socket.emit("reject_call", { toUserId: otherUserIdRef.current });
      cleanup("Could not connect the call. Please try again.");
    }
  }, [socket, createPeerConnection, cleanup, flushIceQueue, fetchIceServers]);

  const rejectCall = useCallback(() => {
    socket.emit("reject_call", { toUserId: otherUserIdRef.current });
    cleanup();
  }, [socket, cleanup]);

  const endCall = useCallback(() => {
    if (otherUserIdRef.current) {
      socket.emit("end_call", { toUserId: otherUserIdRef.current });
    }
    cleanup();
  }, [socket, cleanup]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = ({ conversationId, offer, callType: incomingType, fromUserId, fromUserName }) => {
      otherUserIdRef.current = fromUserId;
      conversationIdRef.current = conversationId;
      pendingOfferRef.current = offer;
      pendingCallTypeRef.current = incomingType || "voice";
      setCallType(incomingType || "voice");
      setRemoteUserName(fromUserName);
      setCallState("ringing");
    };

    const handleCallAnswered = async ({ answer }) => {
      try {
        await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIceQueue();
        setCallState("in-call");
      } catch (error) {
        console.error("Failed to apply remote answer:", error);
        cleanup("Could not connect the call. Please try again.");
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      // If the remote description isn't set yet, this candidate arrived
      // "too early" relative to the offer/answer exchange — queue it
      // instead of letting addIceCandidate fail. flushIceQueue (called
      // right after setRemoteDescription succeeds, above and in
      // acceptCall) will apply it once it's safe to do so.
      if (!remoteDescSetRef.current) {
        iceQueueRef.current.push(candidate);
        return;
      }

      try {
        await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Failed to add ICE candidate:", error);
      }
    };

    const handleCallRejected = () => cleanup();
    const handleCallEnded = () => cleanup();

    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_answered", handleCallAnswered);
    socket.on("ice_candidate", handleIceCandidate);
    socket.on("call_rejected", handleCallRejected);
    socket.on("call_ended", handleCallEnded);

    return () => {
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_answered", handleCallAnswered);
      socket.off("ice_candidate", handleIceCandidate);
      socket.off("call_rejected", handleCallRejected);
      socket.off("call_ended", handleCallEnded);
    };
  }, [socket, cleanup, flushIceQueue]);

  const value = {
    callState,
    callType,
    callError,
    remoteUserName,
    remoteAudioRef,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
