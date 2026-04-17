const router = require("express").Router();
const msg = require("../controllers/messageController");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

router.post("/send", auth, upload.array('files', 10), msg.sendMessage);
router.get("/:convId", auth, msg.getMessages);
router.post("/recall", auth, msg.recallMessage);
router.post("/delete", auth, msg.deleteMessage);

// router.post(
//  "/upload",
//  auth,
//  upload("file"),
//  msg.uploadFile
// );

module.exports = router;