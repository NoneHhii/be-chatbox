const router = require("express").Router();
const auth  = require("../controllers/authController");

router.get("/", auth, conversationController.getConversations);
router.post("/", auth, conversationController.createConversation);
router.get("/:id", auth, conversationController.getConversation);
router.post("/:id/add", auth, conversationController.addMember);
router.delete("/:id/member/:userId", auth, conversationController.removeMember);