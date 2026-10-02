const express = require("express");
const validate = require("../middleware/validate");
const authenticate = require("../middleware/authenticate");
const { createLimiters } = require("../middleware/rateLimiter");
const userController = require("../controllers/userController");
const {
  validateProfileUpdate,
  validatePasswordChange,
} = require("../validators/userValidator");

module.exports = function createUserRoutes(options = {}) {
  const { sensitiveLimiter } = createLimiters(options);
  const router = express.Router();

  router.use(authenticate);

  router.get("/me", userController.getMe);
  router.patch("/me", sensitiveLimiter, validate(validateProfileUpdate), userController.updateMe);
  router.put(
    "/me/password",
    sensitiveLimiter,
    validate(validatePasswordChange),
    userController.changePassword
  );
  router.delete("/me", userController.deleteMe);

  return router;
};