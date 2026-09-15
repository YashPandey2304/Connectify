const express = require("express");
const {
  getConversations,
  createConversation,
  getConversationById,
  addMember,
  removeMember,
} = require("../controllers/conversationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Every conversation route requires authentication — applied once here
// rather than repeating `protect` on each individual route.
router.use(protect);

router.get("/", getConversations);
router.post("/", createConversation);
router.get("/:id", getConversationById);
router.post("/:id/members", addMember);
router.delete("/:id/members/:userId", removeMember);

module.exports = router;
