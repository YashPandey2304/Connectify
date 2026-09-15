/**
 * CLOUDFLARE TURN CREDENTIAL SERVICE
 *
 * WHY does this need to be server-side at all, instead of just putting
 * TURN credentials in a VITE_* env var like a normal static TURN
 * provider?
 * Cloudflare's TURN credentials are short-lived by design (a security
 * feature — a leaked credential is only useful for a limited window).
 * Minting them requires a secret API token, and that token must NEVER
 * reach the browser — anyone who obtained it could mint unlimited
 * credentials against your Cloudflare account and run up your bill.
 * So the flow is: browser asks OUR backend for credentials -> our
 * backend (holding the real secret) asks Cloudflare -> we hand back
 * only the short-lived, limited-use result to the browser.
 *
 * Uses Node's built-in fetch (available in Node 18+, which is why
 * server/package.json's engines field requires it) rather than adding
 * an HTTP client dependency for a single API call.
 */

const CLOUDFLARE_TURN_ENDPOINT_BASE = "https://rtc.live.cloudflare.com/v1/turn/keys";
const CREDENTIAL_TTL_SECONDS = 3600; // 1 hour — long enough for any realistic call

/**
 * Returns an ICE servers array. If Cloudflare isn't configured (missing
 * env vars, or the API call fails), falls back to STUN-only rather than
 * throwing — a call without TURN still works on the same network, so we
 * degrade gracefully instead of breaking calling entirely.
 */
const getIceServers = async () => {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;

  const stunOnly = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }], turnConfigured: false };

  if (!keyId || !apiToken) {
    return stunOnly;
  }

  try {
    // A short timeout — if Cloudflare is unreachable, fail fast and fall
    // back rather than hanging the call-setup flow indefinitely.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${CLOUDFLARE_TURN_ENDPOINT_BASE}/${keyId}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Cloudflare TURN credential request failed: ${response.status}`);
      return stunOnly;
    }

    const data = await response.json();

    // Cloudflare's generate-ice-servers endpoint returns `iceServers` as
    // an ARRAY already containing both a STUN entry and a TURN entry
    // (with urls/username/credential) — it's already exactly the shape
    // RTCPeerConnection expects, so we pass it through directly rather
    // than treating it as one object to wrap.
    if (!Array.isArray(data.iceServers)) {
      console.error("Unexpected Cloudflare TURN response shape:", JSON.stringify(data));
      return stunOnly;
    }

    return {
      iceServers: data.iceServers,
      turnConfigured: true,
    };
  } catch (error) {
    console.error("Failed to fetch Cloudflare TURN credentials:", error.message);
    return stunOnly;
  }
};

module.exports = { getIceServers };
