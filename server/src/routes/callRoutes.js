const express = require("express");
const { getTurnCredentials } = require("../controllers/callController");
const { protect } = require("../middleware/authMiddleware");
const { turnCredentialLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.use(protect);

router.get("/turn-credentials", turnCredentialLimiter, getTurnCredentials);

module.exports = router;
