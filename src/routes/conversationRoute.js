const router = require("express").Router();
const auth  = require("../middleware/authMiddleware");
const conversationController = require("../controllers/conversationController")
const upload = require("../middleware/uploadMiddleware");

router.get("/", auth, conversationController.getConversations);
router.post("/", auth, conversationController.createConversation);
router.post("/merge", auth, conversationController.getOrCreateConversation);
router.delete('/:id/delete-group', auth, conversationController.deleteGroup);
router.get("/:id", auth, conversationController.getConversations);
router.post('/:id/add-members', auth, conversationController.addMember);
router.delete('/group/remove-member', auth, conversationController.removeMember);
router.put('/group/info', auth, upload.single('avatar'), conversationController.updateGroupInfo);
router.put('/group/set-admin', auth, conversationController.setAdmin);
router.get('/:id/members', auth, conversationController.getMembers);
router.get('/search', auth, conversationController.searchMessages);
router.get('/meadia', auth, conversationController.getCloudMedia);
router.get('/toggle-pin', auth, conversationController.togglePinConversation);
router.get('/hide', auth, conversationController.hideConversation);
router.get('/toggle-mute', auth, conversationController.toggleMuteConversation);
router.get('/unfriend', auth, conversationController.unfriend);
router.get('/block', auth, conversationController.blockUser);
// router.delete("/:id/member/:userId", auth, conversationController.removeMember);

module.exports = router;