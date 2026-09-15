import "./Avatar.css";

/**
 * Renders a profile picture if one exists, otherwise falls back to a
 * colored circle with the user's initials. Optionally shows a small
 * online-status dot (used once Phase 12 wires up real presence data —
 * the `isOnline` prop is already plumbed through now so that phase is a
 * drop-in, not a redesign).
 */
export default function Avatar({ name, profilePicture, isOnline, size = 40 }) {
  const initials = getInitials(name);

  return (
    <div className="avatar-wrap" style={{ width: size, height: size }}>
      {profilePicture ? (
        <img src={profilePicture} alt={name} className="avatar-img" />
      ) : (
        <div className="avatar-fallback" style={{ fontSize: size * 0.4 }}>
          {initials}
        </div>
      )}
      {isOnline !== undefined && (
        <span className={`avatar-status ${isOnline ? "online" : "offline"}`} />
      )}
    </div>
  );
}

function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
