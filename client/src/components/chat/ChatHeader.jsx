import Avatar from "../common/Avatar";
import { PhoneIcon, CameraIcon } from "../common/icons";
import { formatLastSeen } from "../../utils/formatTime";
import "./ChatHeader.css";

export default function ChatHeader({ conversation, currentUserId, onClick, onVoiceCall, onVideoCall }) {
  if (!conversation) return null;

  const isGroup = conversation.type === "group";
  const other = isGroup
    ? null
    : conversation.members.find((m) => m._id !== currentUserId) || conversation.members[0];

  const displayName = isGroup ? conversation.name : other?.name;
  const subtitle = isGroup
    ? `${conversation.members.length} members`
    : other?.isOnline
    ? "Online"
    : formatLastSeen(other?.lastSeen);

  const identity = (
    <>
      <Avatar
        name={displayName}
        profilePicture={isGroup ? null : other?.profilePicture}
        isOnline={isGroup ? undefined : other?.isOnline}
        size={38}
      />
      <div>
        <div className="chat-header-name">{displayName}</div>
        <div className="chat-header-subtitle">{subtitle}</div>
      </div>
    </>
  );

  // Only groups have a member-management panel to open — direct chats
  // instead get call buttons. Both call types are 1-to-1 only (see
  // Phase 15/17 notes on why group calls need a media server we don't
  // have). Video button sits LEFT of the voice button, per design.
  return (
    <div className="chat-header">
      {isGroup ? (
        <button className="chat-header-identity chat-header-clickable" onClick={onClick}>
          {identity}
        </button>
      ) : (
        <>
          <div className="chat-header-identity">{identity}</div>
          <div className="chat-header-call-btns">
            <button className="chat-call-icon-btn" onClick={onVoiceCall} title="Start voice call">
              <PhoneIcon size={16} />
            </button>
            <button className="chat-call-icon-btn" onClick={onVideoCall} title="Start video call">
              <CameraIcon size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
