const router = require("express").Router();
const auth  = require("../controllers/authController");

router.get("/", auth, friendController.getFriends);
router.post("/request", auth, friendController.sendRequest);
router.put("/accept/:id", auth, friendController.acceptRequest);
router.delete("/:id", auth, friendController.removeFriend);