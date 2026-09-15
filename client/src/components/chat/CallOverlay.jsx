import { useCall } from "../../hooks/useCall";
import "./CallOverlay.css";

/**
 * Renders nothing when callState is "idle". For voice calls, shows the
 * avatar-circle layout from Phase 15. For video calls, shows the remote
 * peer full-panel with a small local self-view in the corner — the
 * standard "picture-in-picture" layout most video call UIs use.
 */
export default function CallOverlay() {
  const {
    callState,
    callType,
    callError,
    remoteUserName,
    remoteAudioRef,
    localVideoRef,
    remoteVideoRef,
    acceptCall,
    rejectCall,
    endCall,
  } = useCall();

  const isVideo = callType === "video" && callState !== "failed";

  return (
    <>
      {/* Always present, but only actually carries audio for voice calls
          (video calls play their audio through the remote <video> tag
          instead — see CallContext's ontrack handler). */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={remoteAudioRef} autoPlay />

      {callState !== "idle" && (
        <div className={`call-overlay ${isVideo ? "call-overlay-video" : ""}`}>
          {isVideo ? (
            <div className="call-video-stage">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline />
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={localVideoRef} className="call-local-video" autoPlay playsInline muted />

              <div className="call-video-info">
                <p className="call-remote-name">{remoteUserName}</p>
                <p className="call-status-text">
                  {callState === "calling" && "Calling..."}
                  {callState === "ringing" && "Incoming video call"}
                  {callState === "in-call" && "Connected"}
                </p>
              </div>

              <div className="call-actions call-actions-video">
                {callState === "ringing" && (
                  <>
                    <button className="call-btn call-btn-accept" onClick={acceptCall}>
                      Accept
                    </button>
                    <button className="call-btn call-btn-decline" onClick={rejectCall}>
                      Decline
                    </button>
                  </>
                )}
                {(callState === "calling" || callState === "in-call") && (
                  <button className="call-btn call-btn-decline" onClick={endCall}>
                    {callState === "calling" ? "Cancel" : "End call"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="call-panel">
              {callState === "failed" ? (
                <div className="call-failed-icon">!</div>
              ) : (
                <div className="call-avatar-ring">
                  <span className="call-avatar-initial">{remoteUserName?.[0]?.toUpperCase()}</span>
                </div>
              )}

              <p className="call-remote-name">{remoteUserName}</p>
              <p className="call-status-text">
                {callState === "calling" && "Calling..."}
                {callState === "ringing" && "Incoming call"}
                {callState === "in-call" && "Connected"}
                {callState === "failed" && (callError || "Call failed")}
              </p>

              <div className="call-actions">
                {callState === "ringing" && (
                  <>
                    <button className="call-btn call-btn-accept" onClick={acceptCall}>
                      Accept
                    </button>
                    <button className="call-btn call-btn-decline" onClick={rejectCall}>
                      Decline
                    </button>
                  </>
                )}
                {(callState === "calling" || callState === "in-call") && (
                  <button className="call-btn call-btn-decline" onClick={endCall}>
                    {callState === "calling" ? "Cancel" : "End call"}
                  </button>
                )}
                {/* No buttons for "failed" — it auto-dismisses itself
                    after a few seconds (see cleanup()'s timeout) */}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
