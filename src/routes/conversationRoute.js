const router = require("express").Router();
const auth  = require("../middleware/authMiddleware");
const conversationController = require("../controllers/conversationController")
const upload = require("../middleware/uploadMiddleware");

router.use(auth);

router.put('/transfer-admin', conversationController.transferAdminRole);
router.get('/:id/join-code', conversationController.getGroupJoinCode);
router.post('/generate-code', conversationController.generateJoinCode);
router.post('/join-by-code', conversationController.joinGroupByCode);
router.post('/polls', conversationController.createPoll);
router.get('/:conversationId/polls', conversationController.getPolls);
router.post('/polls/vote', conversationController.voteOption);
router.post('/:id/reminders', conversationController.createReminder);
router.delete('/reminders/:reminderId', conversationController.deleteReminder);
router.get("/", auth, conversationController.getConversations);
router.post("/", auth, conversationController.createConversation);
router.post("/merge", auth, conversationController.getOrCreateConversation);
router.delete('/:id/delete-group', auth, conversationController.deleteGroup);
router.delete('/group/remove-member', auth, conversationController.removeMember);
router.put('/group/info', auth, upload.single('avatar'), conversationController.updateGroupInfo);
router.put('/group/set-admin', auth, conversationController.setAdmin);
router.get('/:id/members', auth, conversationController.getMembers);
router.get('/search', auth, conversationController.searchMessages);
router.get('/media', auth, conversationController.getCloudMedia);
router.put('/toggle-pin', auth, conversationController.togglePinConversation);
router.put('/hide', auth, conversationController.hideConversation);
router.put('/toggle-mute', auth, conversationController.toggleMuteConversation);
router.delete('/unfriend', auth, conversationController.unfriend);
router.get('/block', auth, conversationController.blockUser);
router.get("/:id", auth, conversationController.getConversations);
router.post('/:id/add-members', auth, conversationController.addMember);
// router.delete("/:id/member/:userId", auth, conversationController.removeMember);

module.exports = router;