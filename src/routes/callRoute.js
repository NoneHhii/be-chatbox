const router = require("express").Router();
const auth  = require("../controllers/authController");

router.post("/start", auth, callController.startCall);
router.post("/end", auth, callController.endCall);
router.get("/history", auth, callController.history);