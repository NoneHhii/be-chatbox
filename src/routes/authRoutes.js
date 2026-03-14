const router = require("express").Router();
const auth  = require("../controllers/authController");

router.post("/register", auth.register);
router.post("/login", auth.login);
router.get("/me", authMiddleware, authController.me);
router.put("/update", authMiddleware, authController.updateProfile);
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;
