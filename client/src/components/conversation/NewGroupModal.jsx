import { useState, useEffect } from "react";
import Modal from "../common/Modal";
import Avatar from "../common/Avatar";
import userService from "../../services/userService";
import "./NewGroupModal.css";

export default function NewGroupModal({ onClose, onCreate }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    userService
      .getUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  const toggleUser = (userId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    setError("");

    if (!name.trim()) {
      setError("Give your group a name.");
      return;
    }
    if (selectedIds.size < 1) {
      // Matches the backend rule from Phase 6: a group needs the creator
      // plus at least one other member.
      setError("Pick at least one other person to add.");
      return;
    }

    setCreating(true);
    try {
      await onCreate(name.trim(), Array.from(selectedIds));
    } catch (err) {
      setError(err.response?.data?.message || "Could not create the group.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal title="New group" onClose={onClose}>
      <div className="new-group-field">
        <label htmlFor="group-name">Group name</label>
        <input
          id="group-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekend Trip"
        />
      </div>

      <div className="new-group-field">
        <label>Add members</label>
        {loading ? (
          <p className="new-group-status">Loading people...</p>
        ) : (
          <div className="new-group-user-list">
            {users.map((u) => (
              <label key={u._id} className="new-group-user-row">
                <input
                  type="checkbox"
                  checked={selectedIds.has(u._id)}
                  onChange={() => toggleUser(u._id)}
                />
                <Avatar name={u.name} profilePicture={u.profilePicture} size={30} />
                <span>{u.name}</span>
              </label>
            ))}
            {users.length === 0 && <p className="new-group-status">No other users yet.</p>}
          </div>
        )}
      </div>

      {error && <p className="new-group-error">{error}</p>}

      <button className="new-group-submit" onClick={handleCreate} disabled={creating}>
        {creating ? "Creating..." : "Create group"}
      </button>
    </Modal>
  );
}
