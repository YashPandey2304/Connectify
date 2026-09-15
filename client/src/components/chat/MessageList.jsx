import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import "./MessageList.css";

/**
 * WHY auto-scroll on new messages?
 * A chat UI that doesn't keep the latest message in view defeats the
 * point of real-time delivery. We use a ref + useEffect keyed on the
 * messages array — every time `messages` changes (new message sent or
 * received), scroll the container to the bottom.
 */
export default function MessageList({ messages, currentUserId, loading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) {
    return <div className="msg-list-status">Loading messages...</div>;
  }

  if (messages.length === 0) {
    return <div className="msg-list-status">No messages yet. Say hello!</div>;
  }

  return (
    <div className="msg-list">
      {messages.map((message) => (
        <MessageBubble
          key={message._id}
          message={message}
          isOwn={message.sender._id === currentUserId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
