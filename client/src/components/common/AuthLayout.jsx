import "./AuthLayout.css";

/**
 * Shared visual shell for Login and Register. Keeping this separate
 * means both pages stay focused on their form logic, and any future
 * branding tweak happens in exactly one place.
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-layout">
      <div className="auth-brand">
        <div className="auth-brand-content">
          <span className="auth-wordmark">Connectify</span>
          <p className="auth-tagline">Real-time conversations, one and group, in sync everywhere.</p>
          <NodeGraphic />
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-wrap">
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * A simple node/connection graphic — literal to "Connectify" (people as
 * nodes, messages as the connecting lines) rather than decorative
 * stock-art. This is the one bold/memorable visual element; everything
 * else on the page stays quiet.
 */
function NodeGraphic() {
  return (
    <svg
      className="auth-node-graphic"
      viewBox="0 0 320 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <line x1="60" y1="60" x2="160" y2="110" stroke="#2f8f82" strokeWidth="1.5" opacity="0.6" />
      <line x1="160" y1="110" x2="260" y2="50" stroke="#2f8f82" strokeWidth="1.5" opacity="0.6" />
      <line x1="160" y1="110" x2="150" y2="190" stroke="#2f8f82" strokeWidth="1.5" opacity="0.6" />
      <line x1="150" y1="190" x2="250" y2="170" stroke="#2f8f82" strokeWidth="1.5" opacity="0.4" />
      <line x1="60" y1="60" x2="70" y2="160" stroke="#2f8f82" strokeWidth="1.5" opacity="0.4" />
      <circle cx="60" cy="60" r="7" fill="#dceeec" />
      <circle cx="260" cy="50" r="9" fill="#2f8f82" />
      <circle cx="160" cy="110" r="11" fill="#2f8f82" />
      <circle cx="150" cy="190" r="7" fill="#dceeec" />
      <circle cx="250" cy="170" r="6" fill="#dceeec" opacity="0.8" />
      <circle cx="70" cy="160" r="5" fill="#dceeec" opacity="0.6" />
    </svg>
  );
}
