const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const userStore = require("../data/users");
const { jwtSecret } = require("../config/env");

module.exports = function authenticate(req, _res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token, ...extraParts] = authorization.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token || extraParts.length > 0) {
    return next(new AppError("Not authenticated. Provide a valid Bearer token.", 401));
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const userId = Number(decoded.sub || decoded.id);
    const user = userStore.findUserById(userId);

    if (!user || !Number.isSafeInteger(userId)) {
      return next(new AppError("Invalid token.", 401));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new AppError("Token expired. Please log in again.", 401));
    }

    return next(new AppError("Invalid token.", 401));
  }
};
