const router = require("express").Router();
const auth  = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

router.post('/register-request', auth.sendRegistrationOTP);
router.post('/verify-register', auth.verifyAndRegister);
router.post("/login", auth.login);
router.get("/me", authMiddleware, auth.me);
router.put("/update", authMiddleware, upload.single("avatar"), auth.updateProfile);
router.post("/logout", authMiddleware, auth.logout);
router.post("/find", auth.findAccount);
router.post("/forgot-password", auth.forgotPasswordRequest);
router.post("/reset-password", auth.resetPassword);

module.exports = router;
