const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const userRepository = require("../repositories/userRepository");
const { jwtSecret } = require("../config/env");

module.exports = function authenticate(req, _res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token, ...extraParts] = authorization.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token || extraParts.length > 0) {
    return next(new AppError("Not authenticated. Provide a valid Bearer token.", 401));
  }

  let decoded;

  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new AppError("Token expired. Please log in again.", 401));
    }

    return next(new AppError("Invalid token.", 401));
  }

  return asyncHandler(async (req2, _res2, next2) => {
    const userId = Number(decoded.sub || decoded.id);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      return next2(new AppError("Invalid token.", 401));
    }

    const user = await userRepository.findUserById(userId);

    if (!user) {
      return next2(new AppError("Invalid token.", 401));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return next2();
  })(req, _res, next);
};