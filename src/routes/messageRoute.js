const router = require("express").Router();
const msg = require("../controllers/messageController");
const auth = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

router.post("/send", auth, msg.sendMessage);
router.get("/:convId", auth, msg.getMessages);

// router.post(
//  "/upload",
//  auth,
//  upload("file"),
//  msg.uploadFile
// );

module.exports = router;