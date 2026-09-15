import Avatar from "../common/Avatar";
import { formatConversationTime } from "../../utils/formatTime";
import "./ConversationList.css";

/**
 * Renders a single conversation row. For direct conversations, we derive
 * the displayed name/avatar from "the other member" (not the logged-in
 * user) since a direct conversation has no `name` field of its own —
 * see the Conversation model comments for why.
 */
export default function ConversationItem({ conversation, currentUserId, isActive, onClick }) {
  const { displayName, displayAvatar, isOnline } = getDisplayInfo(conversation, currentUserId);

  return (
    <button className={`conv-item ${isActive ? "active" : ""}`} onClick={onClick}>
      <Avatar name={displayName} profilePicture={displayAvatar} isOnline={isOnline} size={44} />
      <div className="conv-item-info">
        <div className="conv-item-top">
          <span className="conv-item-name">{displayName}</span>
          {conversation.lastMessage && (
            <span className="conv-item-time">
              {formatConversationTime(conversation.lastMessage.createdAt || conversation.updatedAt)}
            </span>
          )}
        </div>
        <p className="conv-item-preview">
          {conversation.lastMessage ? conversation.lastMessage.content : "No messages yet"}
        </p>
      </div>
    </button>
  );
}

function getDisplayInfo(conversation, currentUserId) {
  if (conversation.type === "group") {
    return {
      displayName: conversation.name,
      displayAvatar: null,
      isOnline: undefined, // groups don't have a single online status
    };
  }

  const other = conversation.members.find((m) => m._id !== currentUserId) || conversation.members[0];
  return {
    displayName: other?.name || "Unknown user",
    displayAvatar: other?.profilePicture,
    isOnline: other?.isOnline,
  };
}
