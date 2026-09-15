/**
 * Formats a timestamp for message bubbles: just the time (e.g. "3:45 PM")
 * since messages within an open conversation are almost always from
 * today or very recent. Kept as a small pure utility function so it's
 * easy to unit test and reuse (sidebar previews use it too).
 */
export function formatMessageTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Formats a timestamp for the conversation sidebar preview: today shows
 * a time, this week shows a weekday, older shows a short date. This
 * mirrors how most real chat apps (WhatsApp, Slack) format list timestamps.
 */
export function formatConversationTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Formats a "last seen" timestamp for a chat header subtitle, e.g.
 * "Last seen just now", "Last seen 5m ago", "Last seen yesterday".
 * Falls back to a short date for anything older than a week.
 */
export function formatLastSeen(dateString) {
  if (!dateString) return "Offline";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Last seen just now";
  if (diffMins < 60) return `Last seen ${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Last seen yesterday";
  if (diffDays < 7) return `Last seen ${diffDays}d ago`;

  return `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}
