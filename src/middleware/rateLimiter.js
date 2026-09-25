const rateLimit = require("express-rate-limit");

const responseHandler = (message) => (_req, res) => {
  res.status(429).json({
    success: false,
    message,
  });
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: responseHandler("Too many requests. Please try again later."),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: responseHandler("Too many attempts. Please try again later."),
});

module.exports = {
  generalLimiter,
  authLimiter,
};
