import api from "./api";

/**
 * Fetches fresh ICE servers (STUN + short-lived TURN credentials, minted
 * server-side) for a call about to start. Called right before creating
 * each RTCPeerConnection — since Cloudflare's credentials are
 * short-lived by design, we deliberately fetch new ones per call rather
 * than caching them, so a call started an hour after the app loaded
 * doesn't try to use expired credentials.
 */
const getIceServers = async () => {
  const res = await api.get("/calls/turn-credentials");
  return res.data.data; // { iceServers, turnConfigured }
};

export default { getIceServers };
