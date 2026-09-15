import { formatMessageTime } from "../../utils/formatTime";
import "./MessageBubble.css";

/**
 * Renders a single message. `isOwn` controls which side it aligns to and
 * which color it uses — the same visual language (teal for "yours", a
 * neutral card for "theirs") is what most chat apps use to make skimming
 * a conversation fast without reading every sender name.
 *
 * This component doesn't care whether the message came from the initial
 * REST fetch or a live Socket.IO event (Phase 11) — it just renders
 * whatever message object it's given. That's deliberate: keeping
 * rendering logic decoupled from data-source logic.
 */
export default function MessageBubble({ message, isOwn }) {
  return (
    <div className={`msg-row ${isOwn ? "own" : ""}`}>
      <div className={`msg-bubble ${isOwn ? "own" : "other"}`}>
        <p className="msg-content">{message.content}</p>
        <span className="msg-time">{formatMessageTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
