import ConversationItem from "./ConversationItem";
import "./ConversationList.css";

export default function ConversationList({
  conversations,
  activeConversationId,
  currentUserId,
  onSelect,
  loading,
}) {
  if (loading) {
    return <div className="conv-list-empty">Loading conversations...</div>;
  }

  if (conversations.length === 0) {
    return (
      <div className="conv-list-empty">
        No conversations yet. Search for someone above to start chatting.
      </div>
    );
  }

  return (
    <div className="conv-list">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation._id}
          conversation={conversation}
          currentUserId={currentUserId}
          isActive={conversation._id === activeConversationId}
          onClick={() => onSelect(conversation)}
        />
      ))}
    </div>
  );
}
