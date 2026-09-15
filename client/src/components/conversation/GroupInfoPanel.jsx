import { useState, useEffect } from "react";
import Modal from "../common/Modal";
import Avatar from "../common/Avatar";
import userService from "../../services/userService";
import "./GroupInfoPanel.css";

/**
 * Shows the member list for a group conversation. If the current user is
 * the group's admin, they also get "remove" buttons and a way to add
 * someone new — mirroring exactly what the backend already enforces
 * (Phase 6's addMember/removeMember only succeed for the admin), so the
 * UI just doesn't offer controls that would fail anyway.
 */
export default function GroupInfoPanel({ conversation, currentUserId, onClose, onAddMember, onRemoveMember }) {
  const isAdmin = conversation.admin === currentUserId;
  const [allUsers, setAllUsers] = useState([]);
  const [showAddList, setShowAddList] = useState(false);

  useEffect(() => {
    if (showAddList) {
      userService.getUsers().then(setAllUsers);
    }
  }, [showAddList]);

  const memberIds = new Set(conversation.members.map((m) => m._id));
  const nonMembers = allUsers.filter((u) => !memberIds.has(u._id));

  return (
    <Modal title={conversation.name} onClose={onClose}>
      <p className="group-info-subtitle">{conversation.members.length} members</p>

      <ul className="group-info-member-list">
        {conversation.members.map((member) => (
          <li key={member._id} className="group-info-member-row">
            <Avatar
              name={member.name}
              profilePicture={member.profilePicture}
              isOnline={member.isOnline}
              size={34}
            />
            <div className="group-info-member-info">
              <span className="group-info-member-name">
                {member.name}
                {member._id === conversation.admin && (
                  <span className="group-info-admin-badge">Admin</span>
                )}
              </span>
            </div>
            {isAdmin && member._id !== currentUserId && (
              <button
                className="group-info-remove-btn"
                onClick={() => onRemoveMember(member._id)}
                title="Remove from group"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="group-info-add-section">
          {!showAddList ? (
            <button className="group-info-add-toggle" onClick={() => setShowAddList(true)}>
              + Add member
            </button>
          ) : (
            <div className="group-info-add-list">
              {nonMembers.length === 0 && (
                <p className="group-info-subtitle">Everyone is already in this group.</p>
              )}
              {nonMembers.map((u) => (
                <button
                  key={u._id}
                  className="group-info-add-row"
                  onClick={() => {
                    onAddMember(u._id);
                    setShowAddList(false);
                  }}
                >
                  <Avatar name={u.name} profilePicture={u.profilePicture} size={28} />
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
