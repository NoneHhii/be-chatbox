const router = require("express").Router();
const auth  = require("../middleware/authMiddleware");
const conversationController = require("../controllers/conversationController")
const upload = require("../middleware/uploadMiddleware");

router.get("/", auth, conversationController.getConversations);
router.post("/", auth, conversationController.createConversation);
router.post("/merge", auth, conversationController.getOrCreateConversation);
router.get("/:id", auth, conversationController.getConversations);
router.post("/:id/add", auth, conversationController.addMember);
// router.delete("/:id/member/:userId", auth, conversationController.removeMember);

module.exports = router;