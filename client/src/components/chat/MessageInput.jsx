import { useState, useRef } from "react";
import "./MessageInput.css";

// How long to wait after the last keystroke before announcing "stopped
// typing". Long enough that brief pauses (thinking, glancing away) don't
// flicker the indicator on and off; short enough that it still feels
// responsive when someone actually stops.
const TYPING_TIMEOUT_MS = 2000;

export default function MessageInput({ onSend, onTyping, onStopTyping, disabled }) {
  const [content, setContent] = useState("");
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const handleChange = (e) => {
    setContent(e.target.value);

    // Only emit "typing" on the FIRST keystroke of a burst, not on every
    // single character — isTypingRef tracks whether we've already told
    // the server "typing" is in progress for this burst.
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTyping?.();
    }

    // Reset the "stopped typing" timer on every keystroke — it only
    // actually fires once the user pauses for TYPING_TIMEOUT_MS.
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onStopTyping?.();
    }, TYPING_TIMEOUT_MS);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setContent("");

    // Sending a message is itself a clear "stopped typing" signal —
    // no need to wait out the timeout in this case.
    clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    onStopTyping?.();
  };

  return (
    <form className="msg-input-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Type a message..."
        value={content}
        onChange={handleChange}
        disabled={disabled}
        className="msg-input"
      />
      <button type="submit" className="msg-send-btn" disabled={disabled || !content.trim()}>
        Send
      </button>
    </form>
  );
}
