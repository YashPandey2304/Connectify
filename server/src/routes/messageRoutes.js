const express = require("express");
const { sendMessage, getMessages } = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");
const { messageValidation } = require("../middleware/validationMiddleware");

// mergeParams: true is required because this router is mounted at a path
// like /api/conversations/:conversationId/messages in app.js — without
// this option, req.params.conversationId would be undefined inside this
// file's controllers, since Express routers don't inherit parent params
// by default.
const router = express.Router({ mergeParams: true });

router.use(protect);

router.get("/", getMessages);
router.post("/", messageValidation, sendMessage);

module.exports = router;
