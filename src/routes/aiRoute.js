const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const aiController = require("../controllers/aiController");

router.post(
    "/summary",
    auth,
    aiController.summarizeUnreadMessages
);

module.exports = router;