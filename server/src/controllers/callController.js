const asyncHandler = require("../utils/asyncHandler");
const turnService = require("../services/turnService");

/**
 * @desc    Get fresh ICE servers (STUN + short-lived TURN credentials)
 *          for starting or accepting a call
 * @route   GET /api/calls/turn-credentials
 * @access  Private
 *
 * Protected (requires a valid JWT) so this can't be hit anonymously —
 * without that, anyone on the internet could hammer this endpoint to
 * mint Cloudflare TURN credentials against OUR account, running up
 * usage/cost for free. Only logged-in users of this app can request them.
 */
const getTurnCredentials = asyncHandler(async (req, res) => {
  const result = await turnService.getIceServers();
  res.status(200).json({ success: true, data: result });
});

module.exports = { getTurnCredentials };
