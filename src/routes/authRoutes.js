const router = require("express").Router();
const auth  = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/register", auth.register);
router.post("/login", auth.login);
router.get("/me", authMiddleware, auth.me);
router.put("/update", authMiddleware, auth.updateProfile);
router.post("/logout", authMiddleware, auth.logout);
router.post("/find", auth.findAccount);

module.exports = router;
