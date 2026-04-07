const router = require("express").Router();
const auth  = require("../middleware/authMiddleware");
const friendController = require("../controllers/friendController");

router.get("/", auth, friendController.getFriends);
router.get("/request", auth, friendController.getRequests);
router.post("/request", auth, friendController.sendRequest);
router.post("/accept/:id", auth, friendController.acceptRequest);
router.delete("/:id", auth, friendController.rejectFriendRequest);

module.exports = router;