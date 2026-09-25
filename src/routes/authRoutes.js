const express = require("express");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");
const { validateRegister, validateLogin } = require("../validators/authValidator");
const authController = require("../controllers/authController");

const router = express.Router();

router.use(authLimiter);
router.post("/register", validate(validateRegister), authController.register);
router.post("/login", validate(validateLogin), authController.login);

module.exports = router;
