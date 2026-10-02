const express = require("express");
const validate = require("../middleware/validate");
const { createLimiters } = require("../middleware/rateLimiter");
const { validateRegister, validateLogin } = require("../validators/authValidator");
const authController = require("../controllers/authController");

module.exports = function createAuthRoutes(options = {}) {
  const { authLimiter } = createLimiters(options);
  const router = express.Router();

  router.use(authLimiter);
  router.post("/register", validate(validateRegister), authController.register);
  router.post("/login", validate(validateLogin), authController.login);

  return router;
};