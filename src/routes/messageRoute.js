const router = require("express").Router();
const msg = require("../controllers/messageController");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

router.post("/send", msg.sendMessage);
router.get("/:id", auth, msg.getMessages);

router.post(
 "/upload",
 auth,
 upload.single("file"),
 msg.uploadFile
);

module.exports = router;