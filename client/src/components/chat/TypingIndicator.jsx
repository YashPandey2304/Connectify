import "./TypingIndicator.css";

export default function TypingIndicator({ text }) {
  if (!text) return null;

  return (
    <div className="typing-indicator">
      <span className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </span>
      <span className="typing-text">{text}</span>
    </div>
  );
}
