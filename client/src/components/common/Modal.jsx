import "./Modal.css";

/**
 * A minimal, reusable modal shell — just the overlay, centered panel,
 * title bar, and close button. NewGroupModal and GroupInfoPanel both
 * render their own content inside this, rather than each implementing
 * their own overlay/positioning/close-button logic from scratch.
 */
export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
